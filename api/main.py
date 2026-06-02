from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import anthropic as _anthropic
except Exception:  # pragma: no cover
    _anthropic = None  # type: ignore

import httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
OPENROUTER_MODEL = os.getenv(
    "OPENROUTER_MODEL",
    "nvidia/nemotron-3-nano-30b-a3b:free",
)
_extra_openrouter_models = os.getenv("OPENROUTER_FALLBACK_MODELS", "")
_chain_parts: list[str] = [OPENROUTER_MODEL]
if _extra_openrouter_models:
    _chain_parts.extend(m.strip() for m in _extra_openrouter_models.split(",") if m.strip())
_chain_parts.extend(
    [
        "nvidia/nemotron-3-nano-30b-a3b:free",
        "qwen/qwen3-next-80b-a3b-instruct:free",
        "google/gemma-4-26b-a4b-it:free",
        "liquid/lfm-2.5-1.2b-instruct:free",
        "deepseek/deepseek-v4-flash:free",
        "meta-llama/llama-3.3-70b-instruct:free",
    ]
)
_seen_models: set[str] = set()
OPENROUTER_MODEL_CHAIN: list[str] = []
for _model_id in _chain_parts:
    if _model_id not in _seen_models:
        _seen_models.add(_model_id)
        OPENROUTER_MODEL_CHAIN.append(_model_id)
OPENROUTER_HTTP_REFERER = os.getenv("OPENROUTER_HTTP_REFERER", "http://127.0.0.1:5173")
OPENROUTER_APP_TITLE = os.getenv("OPENROUTER_APP_TITLE", "ClariFi")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
VALID_HIGHLIGHTS = {"readiness", "finances", "hmda", "model"}
QUESTION_MARKET_ALIASES: list[tuple[str, str]] = [
    ("san diego", "San Diego"),
    ("los angeles", "Los Angeles"),
    ("la county", "Los Angeles"),
    ("sacramento", "Sacramento"),
    ("alameda", "Alameda"),
    ("oakland", "Alameda"),
    ("berkeley", "Alameda"),
]

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scripts.scenario_inference import build_scenario_features, features_dataframe, load_inference_config

try:
    import joblib
    import pandas as pd
except Exception:  # pragma: no cover - optional until ML deps are installed
    joblib = None
    pd = None

try:
    from pymongo import MongoClient
except Exception:  # pragma: no cover - optional until API deps are installed
    MongoClient = None

MONGO_CLIENT = None
MODEL_CACHE: Any = None
MODEL_LOAD_ERROR: str | None = None
MONGO_CONNECT_ERROR: str | None = None


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = PROJECT_ROOT / "public" / "data"
MODEL_PATH = PUBLIC_DATA / "model_outputs" / "hmda_2025_xgboost_calibrated_pipeline.joblib"
MONGODB_URI = (os.getenv("MONGODB_URI") or "").strip() or None
MONGODB_DB = os.getenv("MONGODB_DB", "clarifi")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "app_store")
LOCAL_STORE_PATH = PUBLIC_DATA / "local_store.json"
# When MONGODB_URI is set, default is Atlas-only storage (no silent local JSON fallback).
MONGODB_FALLBACK_LOCAL = os.getenv("MONGODB_FALLBACK_LOCAL", "false").lower() in ("1", "true", "yes")

app = FastAPI(
    title="ClariFi API",
    version="0.2.0",
    description="Personal finance, BLS benchmark, HMDA model, and scenario APIs for ClariFi."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def mongo_fallback_enabled() -> bool:
    if not MONGODB_URI:
        return True
    return MONGODB_FALLBACK_LOCAL


def mongo_store_unavailable_detail() -> str:
    hint = (
        "Check MongoDB Atlas → Network Access (allow your IP or 0.0.0.0/0 for dev), "
        "verify the cluster is running, and confirm MONGODB_URI in .env. "
        "Set MONGODB_FALLBACK_LOCAL=true only if you intentionally want local JSON storage."
    )
    if MONGO_CONNECT_ERROR:
        return f"MongoDB is unavailable: {MONGO_CONNECT_ERROR}. {hint}"
    return f"MongoDB is not connected. {hint}"


def create_mongo_client():
    """Build a PyMongo client with certifi CA bundle for Atlas TLS."""
    if not MONGODB_URI or MongoClient is None:
        return None
    try:
        import certifi
    except ImportError:
        certifi = None  # type: ignore
    kwargs: dict[str, Any] = {
        "serverSelectionTimeoutMS": 10000,
        "connectTimeoutMS": 10000,
        "socketTimeoutMS": 20000,
    }
    if certifi is not None:
        kwargs["tlsCAFile"] = certifi.where()
    return MongoClient(MONGODB_URI, **kwargs)


def load_model_cache() -> bool:
    """Load the calibrated XGBoost pipeline into memory. Returns True on success."""
    global MODEL_CACHE, MODEL_LOAD_ERROR
    MODEL_LOAD_ERROR = None
    if joblib is None or pd is None:
        MODEL_LOAD_ERROR = "Install joblib and pandas for ML scoring."
        MODEL_CACHE = None
        return False
    if not MODEL_PATH.exists():
        MODEL_LOAD_ERROR = f"Missing model file: {MODEL_PATH.name}"
        MODEL_CACHE = None
        return False
    try:
        MODEL_CACHE = joblib.load(MODEL_PATH)
        return True
    except Exception as exc:
        MODEL_LOAD_ERROR = str(exc)
        MODEL_CACHE = None
        return False


@app.on_event("startup")
def startup_mongo_client() -> None:
    """Initialize MongoClient and cache ML artifacts when available."""
    global MONGO_CLIENT, MONGO_CONNECT_ERROR
    if MONGODB_URI and MongoClient is not None:
        try:
            client = create_mongo_client()
            client.admin.command("ping")
            MONGO_CLIENT = client
            MONGO_CONNECT_ERROR = None
        except Exception as exc:
            MONGO_CLIENT = None
            MONGO_CONNECT_ERROR = str(exc)
            if not mongo_fallback_enabled():
                print("MongoDB connection failed (Atlas storage required):", exc)
    load_model_cache()


@app.on_event("shutdown")
def shutdown_mongo_client() -> None:
    """Close the shared MongoClient on shutdown."""
    global MONGO_CLIENT
    if MONGO_CLIENT is not None:
        try:
            MONGO_CLIENT.close()
        finally:
            MONGO_CLIENT = None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_json_or_404(path: Path, label: str) -> Any:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{label} not found at {path.name}")
    return read_json(path)


def _safe_float(value: Any, default: float = 0.0) -> float | None:
    text = str(value or "").strip().replace(",", "").replace("$", "")
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return None


def initial_store() -> dict[str, Any]:
    return {
        "users": {},
        "profiles": {},
        "transactions": {},
        "scenarios": {},
        "agent_messages": {}
    }


def _load_local_store() -> dict[str, Any]:
    if LOCAL_STORE_PATH.exists():
        return read_json(LOCAL_STORE_PATH)
    store = initial_store()
    with LOCAL_STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f)
    return store


def _save_local_store(store: dict[str, Any]) -> None:
    with LOCAL_STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f)


def load_store() -> dict[str, Any]:
    global MONGO_CLIENT, MONGO_CONNECT_ERROR
    if MONGO_CLIENT is None:
        if MONGODB_URI and not mongo_fallback_enabled():
            raise HTTPException(status_code=503, detail=mongo_store_unavailable_detail())
        return _load_local_store()
    try:
        collection = MONGO_CLIENT[MONGODB_DB][MONGODB_COLLECTION]
        doc = collection.find_one({"_id": "clarifi_store"})
        if not doc:
            store = initial_store()
            collection.replace_one({"_id": "clarifi_store"}, {"_id": "clarifi_store", **store}, upsert=True)
            return store
        doc.pop("_id", None)
        return doc
    except HTTPException:
        raise
    except Exception as exc:
        MONGO_CONNECT_ERROR = str(exc)
        try:
            MONGO_CLIENT.close()
        except Exception:
            pass
        MONGO_CLIENT = None
        if MONGODB_URI and not mongo_fallback_enabled():
            raise HTTPException(status_code=503, detail=mongo_store_unavailable_detail()) from exc
        return _load_local_store()


def save_store(store: dict[str, Any]) -> None:
    global MONGO_CLIENT, MONGO_CONNECT_ERROR
    if MONGO_CLIENT is None:
        if MONGODB_URI and not mongo_fallback_enabled():
            raise HTTPException(status_code=503, detail=mongo_store_unavailable_detail())
        _save_local_store(store)
        return
    try:
        collection = MONGO_CLIENT[MONGODB_DB][MONGODB_COLLECTION]
        collection.replace_one({"_id": "clarifi_store"}, {"_id": "clarifi_store", **store}, upsert=True)
    except HTTPException:
        raise
    except Exception as exc:
        MONGO_CONNECT_ERROR = str(exc)
        try:
            MONGO_CLIENT.close()
        except Exception:
            pass
        MONGO_CLIENT = None
        if MONGODB_URI and not mongo_fallback_enabled():
            raise HTTPException(status_code=503, detail=mongo_store_unavailable_detail()) from exc
        _save_local_store(store)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(12)
    digest = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return f"{salt}:{digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, digest = stored.split(":", 1)
    check = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return secrets.compare_digest(check, digest)


class AuthRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    name: str | None = None


class ProfileInput(BaseModel):
    householdType: str = "2-person renter/owner transition"
    region: str = "West"
    market: str = "Sacramento"
    monthlyIncome: float = 9400
    monthlyDebt: float = 1250
    savings: float = 82000
    targetPrice: float = 560000
    goals: list[str] = Field(default_factory=lambda: [
        "Build emergency runway",
        "Reach 20% down payment",
        "Compare target counties"
    ])


class ScenarioInput(BaseModel):
    market: str = "Sacramento"
    income: float = 9400
    debt: float = 1250
    savings: float = 82000
    price: float = 560000
    expenses: dict[str, float] = Field(default_factory=lambda: {
        "food": 900,
        "transport": 525,
        "lifestyle": 850,
        "investing": 1100
    })


class AgentExplainInput(BaseModel):
    question: str
    scenario: ScenarioInput | None = None


def make_token(user_id: str) -> str:
    return f"demo_{user_id}_{secrets.token_urlsafe(24)}"


def user_from_authorization(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    store = load_store()
    if not authorization:
        demo_user = ensure_demo_user(store)
        return demo_user
    token = authorization.replace("Bearer ", "", 1)
    for user in store["users"].values():
        if user.get("token") == token:
            return user
    raise HTTPException(status_code=401, detail="Invalid token")


def ensure_demo_user(store: dict[str, Any]) -> dict[str, Any]:
    email = "demo@clarifi.local"
    if email not in store["users"]:
        user_id = "demo-user"
        store["users"][email] = {
            "id": user_id,
            "email": email,
            "name": "Demo Household",
            "passwordHash": hash_password("clarifi-demo"),
            "token": make_token(user_id),
            "createdAt": utc_now()
        }
        store["profiles"][user_id] = ProfileInput().model_dump()
        store["transactions"][user_id] = sample_transactions()
        store["scenarios"][user_id] = []
        store["agent_messages"][user_id] = []
        save_store(store)
    return store["users"][email]


def sample_transactions() -> list[dict[str, Any]]:
    return [
        {"id": "tx-1", "date": "2026-05-01", "merchant": "Rent", "category": "housing", "amount": -2650},
        {"id": "tx-2", "date": "2026-05-03", "merchant": "Grocery", "category": "food", "amount": -184},
        {"id": "tx-3", "date": "2026-05-04", "merchant": "Payroll", "category": "income", "amount": 4700},
        {"id": "tx-4", "date": "2026-05-06", "merchant": "Auto loan", "category": "debt", "amount": -525},
        {"id": "tx-5", "date": "2026-05-08", "merchant": "Brokerage transfer", "category": "savings", "amount": -1100}
    ]


def _transaction_month_key(date_value: Any) -> str | None:
    text = str(date_value or "").strip()[:10]
    if len(text) >= 7 and text[4] == "-":
        return text[:7]
    return None


def scenario_from_question(question: str, scenario: ScenarioInput | None) -> ScenarioInput:
    """Override scenario market when the question names a supported county."""
    base = scenario or ScenarioInput()
    lowered = question.lower()
    for phrase, market in QUESTION_MARKET_ALIASES:
        if phrase in lowered:
            return base.model_copy(update={"market": market})
    return base


def _hmda_chart_meta() -> dict[str, Any]:
    path = PUBLIC_DATA / "hmda_processed.json"
    if not path.exists():
        return {"scatterRows": 0, "sourceName": None}
    data = read_json(path)
    source = data.get("source", {})
    return {
        "scatterRows": len(data.get("scatter", [])),
        "rawRows": source.get("rawRows"),
        "countyCount": source.get("countyCount"),
        "sourceName": source.get("name"),
    }


def _model_training_meta() -> dict[str, Any]:
    report_path = PUBLIC_DATA / "model_report.json"
    report = read_json(report_path) if report_path.exists() else {}
    metrics = report.get("metrics", {})
    rows = report.get("rows", {})
    return {
        "artifactPresent": MODEL_PATH.exists(),
        "rowsTotal": rows.get("total"),
        "testAuc": metrics.get("testAuc"),
        "bestThreshold": metrics.get("bestThreshold"),
    }


def _database_status() -> dict[str, Any]:
    if not MONGODB_URI or MongoClient is None:
        return {"mode": "local-json", "connected": True, "fallbackLocal": True}
    if MONGO_CLIENT is None:
        error = MONGO_CONNECT_ERROR or "client not initialized"
        mode = "local-json" if mongo_fallback_enabled() else "mongodb"
        return {
            "mode": mode,
            "connected": False,
            "error": error,
            "fallbackLocal": mongo_fallback_enabled(),
            "storageTarget": "mongodb" if not mongo_fallback_enabled() else "local-json",
        }
    try:
        MONGO_CLIENT.admin.command("ping")
        return {
            "mode": "mongodb",
            "connected": True,
            "database": MONGODB_DB,
            "collection": MONGODB_COLLECTION,
            "fallbackLocal": False,
            "storageTarget": "mongodb",
        }
    except Exception as exc:
        mode = "local-json" if mongo_fallback_enabled() else "mongodb"
        return {
            "mode": mode,
            "connected": False,
            "error": str(exc),
            "fallbackLocal": mongo_fallback_enabled(),
            "storageTarget": "mongodb" if not mongo_fallback_enabled() else "local-json",
        }


def summarize_transactions(transactions: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate transactions into per-month buckets, then average across months."""
    empty = {
        "transactionCount": 0,
        "monthsObserved": 0,
        "monthlyIncomeObserved": 0.0,
        "monthlyOutflowObserved": 0.0,
        "netCashflowObserved": 0.0,
        "categoryTotals": {},
    }
    if not transactions:
        return empty

    by_month: dict[str, dict[str, float]] = {}
    for tx in transactions:
        month = _transaction_month_key(tx.get("date")) or "unknown"
        bucket = by_month.setdefault(month, {})
        category = str(tx.get("category", "uncategorized")).lower()
        bucket[category] = bucket.get(category, 0) + float(tx.get("amount", 0))

    months = sorted(m for m in by_month if m != "unknown")
    if not months:
        months = sorted(by_month.keys())

    def month_income(bucket: dict[str, float]) -> float:
        return max(bucket.get("income", 0.0), 0.0)

    def month_outflow(bucket: dict[str, float]) -> float:
        return sum(abs(value) for key, value in bucket.items() if key != "income" and value < 0)

    n_months = len(months)
    monthly_income = sum(month_income(by_month[m]) for m in months) / n_months
    monthly_outflow = sum(month_outflow(by_month[m]) for m in months) / n_months

    categories: set[str] = set()
    for bucket in by_month.values():
        categories.update(bucket.keys())
    category_totals = {
        cat: sum(by_month[m].get(cat, 0.0) for m in months) / n_months
        for cat in categories
    }

    return {
        "transactionCount": len(transactions),
        "monthsObserved": n_months,
        "monthlyIncomeObserved": round(monthly_income, 2),
        "monthlyOutflowObserved": round(monthly_outflow, 2),
        "netCashflowObserved": round(monthly_income - monthly_outflow, 2),
        "categoryTotals": {k: round(v, 2) for k, v in category_totals.items()},
    }


def scenario_features(scenario: ScenarioInput) -> dict[str, Any]:
    features, _mode = build_scenario_features(scenario)
    return features


def _predict_scenario_probability(scenario: ScenarioInput) -> float | None:
    if joblib is None or pd is None or MODEL_CACHE is None:
        return None
    features, _mode = build_scenario_features(scenario)
    try:
        frame = features_dataframe(features, MODEL_CACHE)
        return float(MODEL_CACHE.predict_proba(frame)[:, 1][0])
    except Exception:
        return None


def _local_shap_model(scenario: ScenarioInput, baseline_prob: float) -> list[dict[str, Any]] | None:
    """Finite-difference local attributions through the trained pipeline."""
    perturbations: list[tuple[str, str, dict[str, float | int], float]] = [
        ("debt", "Monthly debt", {"debt": max(scenario.debt * 0.85, 0)}, scenario.debt),
        ("income", "Monthly income", {"income": scenario.income * 1.08}, scenario.income),
        ("savings", "Down payment savings", {"savings": scenario.savings * 1.15}, scenario.savings),
        ("price", "Target home price", {"price": scenario.price * 0.92}, scenario.price),
    ]
    insights: list[dict[str, Any]] = []
    for feature, label, update, value in perturbations:
        patched = scenario.model_copy(update=update)
        prob = _predict_scenario_probability(patched)
        if prob is None:
            return None
        impact = round(prob - baseline_prob, 3)
        insights.append({
            "feature": feature,
            "label": label,
            "value": round(value, 2) if isinstance(value, float) else value,
            "ideal": value,
            "impact": impact,
            "direction": "positive" if impact >= 0 else "negative",
        })
    insights.sort(key=lambda row: abs(row["impact"]), reverse=True)
    return insights


def _counterfactual_model(scenario: ScenarioInput, current_prob: float) -> dict[str, Any] | None:
    """Re-score perturbed scenarios with the trained pipeline."""
    monthly_housing = (scenario.price - scenario.savings) * 0.0062
    candidates: list[dict[str, Any]] = []

    target_debt = max(scenario.income * 0.36 - monthly_housing, 0)
    if scenario.debt > target_debt + 50:
        patched = scenario.model_copy(update={"debt": round(target_debt)})
        prob = _predict_scenario_probability(patched)
        if prob is not None:
            candidates.append({
                "feature": "debt",
                "suggestion": f"Reduce monthly debt by {money_fmt(scenario.debt - target_debt)} to bring DTI near 36%",
                "change": -round(scenario.debt - target_debt),
                "newApproval": round(prob, 3),
                "delta": round(prob - current_prob, 3),
            })

    target_savings = scenario.price * 0.20
    if scenario.savings + 1000 < target_savings:
        patched = scenario.model_copy(update={"savings": round(target_savings)})
        prob = _predict_scenario_probability(patched)
        if prob is not None:
            candidates.append({
                "feature": "savings",
                "suggestion": f"Save {money_fmt(target_savings - scenario.savings)} more to reach 20% down payment",
                "change": round(target_savings - scenario.savings),
                "newApproval": round(prob, 3),
                "delta": round(prob - current_prob, 3),
            })

    new_price = round(scenario.price * 0.90)
    patched = scenario.model_copy(update={"price": new_price})
    prob = _predict_scenario_probability(patched)
    if prob is not None:
        candidates.append({
            "feature": "price",
            "suggestion": f"Reduce target price by 10% to {money_fmt(new_price)}",
            "change": -round(scenario.price - new_price),
            "newApproval": round(prob, 3),
            "delta": round(prob - current_prob, 3),
        })

    if not candidates:
        return None
    candidates.sort(key=lambda row: row["delta"], reverse=True)
    best = candidates[0]
    best["newScore"] = round(min(max(best["newApproval"] * 100, 0), 100))
    best["heuristicEstimate"] = False
    return best


def _approval_from_factors(dti: float, down_payment: float, surplus: float = 1000.0) -> float:
    score = min(max(34 + down_payment * 118 + (1 - abs(dti - 0.32)) * 26 - max(dti - 0.36, 0) * 360 + surplus / 1800, 18), 96)
    return min(max(0.52 + (score - 60) / 130, 0.08), 0.97)


def _local_shap(scenario: ScenarioInput, features: dict[str, Any], approval: float) -> list[dict[str, Any]]:
    """Compute per-feature local SHAP-style impact relative to a neutral baseline."""
    monthly_housing = (scenario.price - scenario.savings) * 0.0062
    flexible = sum(scenario.expenses.values())
    surplus = scenario.income - scenario.debt - monthly_housing - flexible
    dti = features["dti_numeric"] / 100
    down_payment = features["down_payment_rate_proxy"]

    base = _approval_from_factors(0.36, 0.20, 1000)

    def _delta(dti_: float, dp_: float, sur_: float) -> float:
        return round(_approval_from_factors(dti_, dp_, sur_) - base, 3)

    insights = [
        {
            "feature": "dti",
            "label": "Debt-to-income ratio",
            "value": round(dti, 3),
            "ideal": 0.36,
            "impact": _delta(dti, 0.20, 1000),
            "direction": "negative" if dti > 0.38 else "positive",
        },
        {
            "feature": "down_payment",
            "label": "Down payment rate",
            "value": round(down_payment, 3),
            "ideal": 0.20,
            "impact": _delta(0.36, down_payment, 1000),
            "direction": "positive" if down_payment >= 0.18 else "negative",
        },
        {
            "feature": "surplus",
            "label": "Monthly surplus",
            "value": round(surplus),
            "ideal": 800,
            "impact": _delta(0.36, 0.20, surplus),
            "direction": "positive" if surplus >= 0 else "negative",
        },
        {
            "feature": "income_vs_county",
            "label": "Income vs. county median",
            "value": round(features["income_vs_county_median"], 3),
            "ideal": 1.0,
            "impact": round((features["income_vs_county_median"] - 1.0) * 0.04, 3),
            "direction": "positive" if features["income_vs_county_median"] >= 0.9 else "negative",
        },
        {
            "feature": "ltv",
            "label": "Loan-to-value ratio",
            "value": round(features["combined_loan_to_value_ratio"] / 100, 3),
            "ideal": 0.80,
            "impact": _delta(0.36, 1.0 - features["combined_loan_to_value_ratio"] / 100, 1000),
            "direction": "negative" if features["combined_loan_to_value_ratio"] > 90 else "positive",
        },
    ]
    insights.sort(key=lambda x: abs(x["impact"]), reverse=True)
    return insights


def _counterfactual(scenario: ScenarioInput, features: dict[str, Any], current_approval: float) -> dict[str, Any]:
    """Find the single most impactful feasible change to suggest."""
    monthly_housing = (scenario.price - scenario.savings) * 0.0062
    flexible = sum(scenario.expenses.values())
    surplus = scenario.income - scenario.debt - monthly_housing - flexible
    dti = features["dti_numeric"] / 100
    down_payment = features["down_payment_rate_proxy"]

    candidates: list[dict[str, Any]] = []

    target_debt_payment = scenario.income * 0.36 - monthly_housing
    debt_reduction = scenario.debt - max(target_debt_payment, 0)
    if debt_reduction > 50:
        new_dti = (max(target_debt_payment, 0) + monthly_housing) / max(scenario.income, 1)
        new_approval = _approval_from_factors(new_dti, down_payment, surplus + debt_reduction)
        candidates.append({
            "feature": "debt",
            "suggestion": f"Reduce monthly debt by {money_fmt(debt_reduction)} to bring DTI to 36%",
            "change": -round(debt_reduction),
            "newApproval": round(new_approval, 3),
            "delta": round(new_approval - current_approval, 3),
        })

    target_savings = scenario.price * 0.20
    savings_gap = target_savings - scenario.savings
    if savings_gap > 1000:
        new_dp = target_savings / max(scenario.price, 1)
        new_monthly_housing = (scenario.price - target_savings) * 0.0062
        new_surplus = scenario.income - scenario.debt - new_monthly_housing - flexible
        new_approval = _approval_from_factors(dti, new_dp, new_surplus)
        candidates.append({
            "feature": "savings",
            "suggestion": f"Save {money_fmt(savings_gap)} more to reach 20% down payment",
            "change": round(savings_gap),
            "newApproval": round(new_approval, 3),
            "delta": round(new_approval - current_approval, 3),
        })

    new_price = scenario.price * 0.90
    new_dp_rate = scenario.savings / max(new_price, 1)
    new_mh = (new_price - scenario.savings) * 0.0062
    new_dti_p = (scenario.debt + new_mh) / max(scenario.income, 1)
    new_sur_p = scenario.income - scenario.debt - new_mh - flexible
    new_approval_p = _approval_from_factors(new_dti_p, new_dp_rate, new_sur_p)
    candidates.append({
        "feature": "price",
        "suggestion": f"Reduce target price by 10% to {money_fmt(new_price)}",
        "change": -round(scenario.price * 0.10),
        "newApproval": round(new_approval_p, 3),
        "delta": round(new_approval_p - current_approval, 3),
    })

    candidates.sort(key=lambda x: x["delta"], reverse=True)
    best = candidates[0]
    best["newScore"] = round(min(max(0.52 + (best["newApproval"] * 130) + 60 - 130 * 0.52, 18), 96))
    return best


def money_fmt(value: float) -> str:
    return f"${value:,.0f}"


def _scenario_budget(scenario: ScenarioInput) -> dict[str, Any]:
    features, feature_mode = build_scenario_features(scenario)
    monthly_housing = round((scenario.price - scenario.savings) * 0.0062)
    flexible = sum(scenario.expenses.values())
    surplus = round(scenario.income - scenario.debt - monthly_housing - flexible)
    dti = features["dti_numeric"] / 100
    down_payment = features["down_payment_rate_proxy"]
    return {
        "features": features,
        "featureMode": feature_mode,
        "monthlyHousing": monthly_housing,
        "monthlySurplus": surplus,
        "dti": round(dti, 3),
        "downPaymentRate": round(down_payment, 3),
        "drivers": [
            {"label": "Down payment", "value": down_payment, "direction": "positive"},
            {"label": "Debt-to-income", "value": dti, "direction": "negative" if dti > 0.36 else "positive"},
            {"label": "Monthly surplus", "value": surplus, "direction": "positive" if surplus >= 0 else "negative"},
        ],
    }


def _model_unavailable(scenario: ScenarioInput, reason: str) -> dict[str, Any]:
    budget = _scenario_budget(scenario)
    return {
        "modelReady": False,
        "mode": "model-unavailable",
        "message": reason,
        "score": None,
        "approvalLikelihood": None,
        "monthlyHousing": budget["monthlyHousing"],
        "monthlySurplus": budget["monthlySurplus"],
        "dti": budget["dti"],
        "downPaymentRate": budget["downPaymentRate"],
        "drivers": budget["drivers"],
        "featureMode": budget["featureMode"],
        "localShap": [],
        "counterfactual": None,
    }


def model_score(scenario: ScenarioInput) -> dict[str, Any]:
    budget = _scenario_budget(scenario)
    if joblib is None or pd is None:
        return _model_unavailable(scenario, "Python ML dependencies are not installed.")
    if MODEL_CACHE is None:
        return _model_unavailable(
            scenario,
            "XGBoost model file missing. Add public/data/model_outputs/hmda_2025_xgboost_calibrated_pipeline.joblib from Colab.",
        )
    try:
        frame = features_dataframe(budget["features"], MODEL_CACHE)
        probability = float(MODEL_CACHE.predict_proba(frame)[:, 1][0])
    except Exception as exc:
        return _model_unavailable(
            scenario,
            f"Could not run the trained model on this scenario ({exc}).",
        )
    report_path = PUBLIC_DATA / "model_report.json"
    threshold = 0.9
    if report_path.exists():
        threshold = read_json(report_path).get("metrics", {}).get("bestThreshold", 0.9)
    counterfactual = _counterfactual_model(scenario, probability)
    explanation_mode = "model-perturbation" if counterfactual else None
    local_shap = _local_shap_model(scenario, probability) or []
    return {
        "modelReady": True,
        "mode": "calibrated-xgboost",
        "message": None,
        "approvalLikelihood": round(probability, 3),
        "score": round(min(max(probability * 100, 0), 100)),
        "bestThreshold": threshold,
        "monthlyHousing": budget["monthlyHousing"],
        "monthlySurplus": budget["monthlySurplus"],
        "dti": budget["dti"],
        "downPaymentRate": budget["downPaymentRate"],
        "drivers": budget["drivers"],
        "counterfactual": counterfactual,
        "localShap": local_shap,
        "explanationMode": explanation_mode,
        "featureMode": budget["featureMode"],
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    db_status = _database_status()
    model_training = _model_training_meta()
    inference_config = load_inference_config()
    scoring_ready = MODEL_CACHE is not None
    return {
        "ok": True,
        "name": "ClariFi API",
        "stack": ["FastAPI", "React", "TypeScript", "Vite", "D3", "MongoDB-ready"],
        "modelArtifactPresent": model_training["artifactPresent"],
        "modelLoaded": scoring_ready,
        "modelLoadError": MODEL_LOAD_ERROR,
        "inferenceConfigPresent": inference_config is not None,
        "scoringPipeline": "calibrated-xgboost" if scoring_ready else "unavailable",
        "openRouterConfigured": bool(OPENROUTER_API_KEY),
        "openRouterModel": OPENROUTER_MODEL if OPENROUTER_API_KEY else None,
        "anthropicConfigured": bool(ANTHROPIC_API_KEY),
        "hmdaChart": _hmda_chart_meta(),
        "modelTraining": model_training,
        "database": db_status["mode"],
        "databaseStatus": db_status,
        "generatedAt": utc_now(),
    }


@app.post("/api/auth/register")
def register(payload: AuthRequest) -> dict[str, Any]:
    store = load_store()
    email = payload.email.lower()
    if email in store["users"]:
        raise HTTPException(status_code=409, detail="User already exists")
    user_id = f"user-{len(store['users']) + 1}"
    user = {
        "id": user_id,
        "email": email,
        "name": payload.name or email.split("@")[0],
        "passwordHash": hash_password(payload.password),
        "token": make_token(user_id),
        "createdAt": utc_now()
    }
    store["users"][email] = user
    store["profiles"][user_id] = ProfileInput().model_dump()
    store["transactions"][user_id] = []
    store["scenarios"][user_id] = []
    store["agent_messages"][user_id] = []
    save_store(store)
    return {"token": user["token"], "user": {k: user[k] for k in ["id", "email", "name"]}}


@app.post("/api/auth/login")
def login(payload: AuthRequest) -> dict[str, Any]:
    store = load_store()
    user = store["users"].get(payload.email.lower())
    if not user or not verify_password(payload.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user["token"] = make_token(user["id"])
    save_store(store)
    return {"token": user["token"], "user": {k: user[k] for k in ["id", "email", "name"]}}


@app.get("/api/me")
def me(user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    return {"user": {k: user[k] for k in ["id", "email", "name"]}}


@app.get("/api/profile")
def get_profile(user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    store = load_store()
    return {"profile": store["profiles"].get(user["id"], ProfileInput().model_dump())}


@app.put("/api/profile")
def save_profile(payload: ProfileInput, user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    store = load_store()
    store["profiles"][user["id"]] = payload.model_dump()
    save_store(store)
    return {"profile": store["profiles"][user["id"]]}


@app.post("/api/transactions/upload")
async def upload_transactions(file: UploadFile = File(...), user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    try:
        text = (await file.read()).decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV is empty or missing a header row")
    rows = []
    skipped = 0
    errors: list[str] = []
    for index, row in enumerate(reader, start=1):
        amount = _safe_float(row.get("amount"))
        if amount is None:
            skipped += 1
            errors.append(f"row {index}: invalid amount")
            continue
        rows.append({
            "id": row.get("id") or f"upload-{index}",
            "date": row.get("date", ""),
            "merchant": row.get("merchant") or row.get("description") or "Imported transaction",
            "category": (row.get("category") or "uncategorized").lower(),
            "amount": amount,
        })
    if not rows:
        raise HTTPException(status_code=400, detail="No valid transaction rows found")
    store = load_store()
    store["transactions"][user["id"]] = rows
    save_store(store)
    return {
        "imported": len(rows),
        "skipped": skipped,
        "errors": errors[:5],
        "summary": summarize_transactions(rows),
    }


@app.get("/api/transactions")
def list_transactions(user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    store = load_store()
    transactions = store["transactions"].get(user["id"], [])
    return {"transactions": transactions, "summary": summarize_transactions(transactions)}


@app.get("/api/finance/summary")
def finance_summary(user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    store = load_store()
    transactions = store["transactions"].get(user["id"], [])
    return summarize_transactions(transactions)


@app.get("/api/benchmarks")
def benchmarks() -> Any:
    return read_json_or_404(PUBLIC_DATA / "bls_benchmarks.json", "Benchmark data")


@app.get("/api/hmda")
def hmda() -> Any:
    return read_json_or_404(PUBLIC_DATA / "hmda_processed.json", "HMDA data")


@app.get("/api/model")
def model_report() -> Any:
    """
    Return dashboard model report.

    Note: some notebook exports update `model_report.json` without the detailed
    `calibration` array that the React `CalibrationChart` expects.
    In that case we inject calibration bins from the SHAP report artifact.
    """
    report = read_json_or_404(PUBLIC_DATA / "model_report.json", "Model report")

    # Frontend `CalibrationChart` expects: report.calibration: [{bin, predictedRate, actualRate, ...}]
    cal = report.get("calibration")
    if not isinstance(cal, list) or not cal:
        shap_report_path = PUBLIC_DATA / "model_outputs" / "hmda_2025_xgboost_shap_report.json"
        if shap_report_path.exists():
            shap_report = read_json(shap_report_path)
            shap_cal = shap_report.get("calibration")
            if isinstance(shap_cal, list) and shap_cal:
                injected: list[dict[str, Any]] = []
                for row in shap_cal:
                    if not isinstance(row, dict):
                        continue
                    predicted = row.get("predictedRate", row.get("predicted_rate"))
                    actual = row.get("actualRate", row.get("actual_rate"))
                    raw_predicted = row.get("rawPredictedRate", row.get("raw_predicted_rate"))
                    injected.append(
                        {
                            "bin": row.get("bin", ""),
                            "applications": row.get("applications", row.get("n", 0)),
                            "predictedRate": float(predicted) if predicted is not None else 0.0,
                            "actualRate": float(actual) if actual is not None else 0.0,
                            "rawPredictedRate": float(raw_predicted) if raw_predicted is not None else None,
                        }
                    )
                if injected:
                    report["calibration"] = injected

    return report


@app.post("/api/mortgage/score")
def score_mortgage(payload: ScenarioInput, user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    return model_score(payload)


@app.post("/api/scenarios")
def save_scenario(payload: ScenarioInput, user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    result = model_score(payload)
    store = load_store()
    store["scenarios"].setdefault(user["id"], []).append({
        "id": f"scenario-{len(store['scenarios'].get(user['id'], [])) + 1}",
        "createdAt": utc_now(),
        "input": payload.model_dump(),
        "result": result,
    })
    save_store(store)
    return result


@app.get("/api/scenarios")
def list_scenarios(user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    store = load_store()
    return {"scenarios": store["scenarios"].get(user["id"], [])[-20:]}


def _rule_based_explain(question: str, score: dict[str, Any]) -> tuple[str, str, str]:
    """Fallback when no LLM is available."""
    dti = score["dti"]
    dp = score["downPaymentRate"]
    surplus = score["monthlySurplus"]
    cf = score.get("counterfactual", {})
    cf_text = f" {cf['suggestion']}." if cf.get("suggestion") else ""
    q = question.lower()
    lead = ""
    if any(word in q for word in ("buy", "afford", "home", "house", "mortgage", "loan")):
        lead = "On affordability: "
    elif any(word in q for word in ("dti", "debt", "down payment", "savings")):
        lead = "On your leverage profile: "

    if dti > 0.38:
        answer = (
            f"Your DTI of {dti*100:.1f}% is the main pressure point — lenders prefer below 36%. "
            f"Reducing monthly debt or lowering the target price has the most immediate impact on approval likelihood.{cf_text}"
        )
        highlight = "readiness"
    elif dp < 0.18:
        answer = (
            f"Your down payment rate of {dp*100:.1f}% is below the 20% threshold most lenders prefer. "
            f"A higher savings buffer reduces LTV, which directly lifts the approval probability.{cf_text}"
        )
        highlight = "finances"
    elif surplus < 0:
        answer = (
            f"This scenario is cashflow negative (${surplus:,.0f}/mo surplus). "
            f"Closing that gap by trimming flexible spending or increasing income stabilises the readiness score.{cf_text}"
        )
        highlight = "finances"
    else:
        answer = (
            f"With a {dti*100:.1f}% DTI and {dp*100:.1f}% down payment this scenario is broadly balanced. "
            f"Check the county comparison to see how approval rates vary across your target market.{cf_text}"
        )
        highlight = "hmda"
    return f"{lead}{answer}", highlight, "rule-based"


def _build_prompts(question: str, scenario: ScenarioInput, score: dict[str, Any]) -> tuple[str, str]:
    """Build system and user prompts shared by all LLM backends."""
    local_shap = score.get("localShap", [])
    cf = score.get("counterfactual", {})

    shap_lines = "\n".join(
        f"  - {i['label']}: {'+' if i['impact'] > 0 else ''}{i['impact']*100:.1f}% impact"
        for i in local_shap[:4]
    ) or "  Not available"
    cf_line = f"{cf['suggestion']} → approval +{cf['delta']*100:.1f}%" if cf.get("suggestion") else "none"

    system_prompt = (
        "You are ClariFi, an AI mortgage-readiness advisor inside an interactive dashboard.\n"
        "The dashboard has four sections:\n"
        '  "readiness" — score ring, approval likelihood, DTI, monthly surplus\n'
        '  "finances"  — cashflow waterfall, budget mixer, expense sliders\n'
        '  "hmda"      — California county map, borrower scatter, income histogram\n'
        '  "model"     — SHAP drivers, calibration chart, DTI/LTV risk surface\n\n'
        "Reply with a JSON object containing exactly two keys:\n"
        '  "answer":    2-3 concise sentences using the user\'s actual numbers. Be specific and actionable.\n'
        '  "highlight": the most relevant section name from the list above.\n\n'
        "Output only the JSON object — no markdown, no extra text."
    )

    user_content = (
        f'User question: "{question}"\n\n'
        f"Scenario:\n"
        f"  Market: {scenario.market}\n"
        f"  Monthly income: ${scenario.income:,.0f}\n"
        f"  Monthly debt: ${scenario.debt:,.0f}\n"
        f"  Savings: ${scenario.savings:,.0f}\n"
        f"  Target price: ${scenario.price:,.0f}\n"
        f"  Expenses — food ${scenario.expenses.get('food',0):,.0f} · "
        f"transport ${scenario.expenses.get('transport',0):,.0f} · "
        f"lifestyle ${scenario.expenses.get('lifestyle',0):,.0f} · "
        f"investing ${scenario.expenses.get('investing',0):,.0f}\n\n"
        f"Score:\n"
        f"  Readiness: {score['score']}/100\n"
        f"  Approval likelihood: {score['approvalLikelihood']*100:.1f}%\n"
        f"  DTI: {score['dti']*100:.1f}%\n"
        f"  Down payment: {score['downPaymentRate']*100:.1f}%\n"
        f"  Monthly housing: ${score['monthlyHousing']:,.0f}\n"
        f"  Monthly surplus: ${score['monthlySurplus']:,.0f}\n\n"
        f"Factor impacts:\n{shap_lines}\n\n"
        f"Best improvement: {cf_line}"
    )
    return system_prompt, user_content


def _parse_llm_json(raw: str) -> tuple[str, str] | None:
    """Extract answer+highlight from a model response. Returns None on parse failure."""
    text = raw.strip()
    if "```" in text:
        for block in text.split("```"):
            cleaned = block.lstrip("json").strip()
            if cleaned.startswith("{"):
                text = cleaned
                break
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        text = text[start:end]
    try:
        obj = json.loads(text)
        answer = str(obj.get("answer", "")).strip()
        highlight = str(obj.get("highlight", "readiness")).strip()
        if highlight not in VALID_HIGHLIGHTS:
            highlight = "readiness"
        if answer:
            return answer, highlight
    except Exception:
        pass
    return None


def _openrouter_retry_seconds(response: httpx.Response) -> int:
    try:
        meta = response.json().get("error", {}).get("metadata", {})
        return int(meta.get("retry_after_seconds", 5))
    except Exception:
        return 5


def _openrouter_message_text(data: dict[str, Any]) -> str:
    message = data.get("choices", [{}])[0].get("message", {})
    content = str(message.get("content") or "").strip()
    if content:
        return content
    reasoning = message.get("reasoning")
    if isinstance(reasoning, str):
        return reasoning.strip()
    return ""


def _openrouter_call_model(
    model_id: str,
    headers: dict[str, str],
    system_prompt: str,
    user_content: str,
) -> tuple[str, str, str] | None:
    payload = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.3,
        "max_tokens": 400,
    }
    for attempt in range(3):
        resp = httpx.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers=headers,
            json=payload,
            timeout=90.0,
        )
        if resp.status_code == 429 and attempt < 2:
            time.sleep(min(max(_openrouter_retry_seconds(resp), 1), 12))
            continue
        if resp.status_code == 429:
            return None
        resp.raise_for_status()
        raw = _openrouter_message_text(resp.json())
        parsed = _parse_llm_json(raw)
        if parsed:
            label = model_id.split("/")[-1][:32]
            return parsed[0], parsed[1], f"openrouter/{label}"
        return None
    return None


def _openrouter_explain(question: str, scenario: ScenarioInput, score: dict[str, Any]) -> tuple[str, str, str] | None:
    """Call OpenRouter (OpenAI-compatible chat). Returns (answer, highlight, model_label) or None."""
    if not OPENROUTER_API_KEY:
        return None
    system_prompt, user_content = _build_prompts(question, scenario, score)
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_HTTP_REFERER,
        "X-Title": OPENROUTER_APP_TITLE,
    }
    for model_id in OPENROUTER_MODEL_CHAIN:
        try:
            result = _openrouter_call_model(model_id, headers, system_prompt, user_content)
            if result:
                return result
        except Exception:
            continue
    return (
        "OpenRouter free models are busy right now (rate limits). "
        "Wait a minute and try again, or set OPENROUTER_MODEL to a paid model in .env.",
        "readiness",
        "openrouter-rate-limited",
    )


def _ollama_explain(question: str, scenario: ScenarioInput, score: dict[str, Any]) -> tuple[str, str, str] | None:
    """Call the local Ollama API. Returns (answer, highlight, model_label) or None."""
    system_prompt, user_content = _build_prompts(question, scenario, score)
    try:
        resp = httpx.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.3},
            },
            timeout=60.0,
        )
        resp.raise_for_status()
        raw = resp.json()["message"]["content"]
        parsed = _parse_llm_json(raw)
        if parsed:
            return parsed[0], parsed[1], OLLAMA_MODEL
    except Exception:
        pass
    return None


def _anthropic_explain(question: str, scenario: ScenarioInput, score: dict[str, Any]) -> tuple[str, str, str] | None:
    """Call Anthropic Claude. Returns (answer, highlight, model_label) or None."""
    if _anthropic is None or not ANTHROPIC_API_KEY:
        return None
    system_prompt, user_content = _build_prompts(question, scenario, score)
    try:
        client = _anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=300,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        parsed = _parse_llm_json(response.content[0].text)
        if parsed:
            return parsed[0], parsed[1], "claude-sonnet-4-6"
    except Exception:
        pass
    return None


def _llm_explain(question: str, scenario: ScenarioInput, score: dict[str, Any]) -> tuple[str, str, str]:
    """Try OpenRouter → Anthropic → Ollama → rule-based."""
    result = _openrouter_explain(question, scenario, score)
    if result:
        return result
    result = _anthropic_explain(question, scenario, score)
    if result:
        return result
    result = _ollama_explain(question, scenario, score)
    if result:
        return result
    return _rule_based_explain(question, score)


@app.post("/api/agent/explain")
def explain(payload: AgentExplainInput, user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    scenario = scenario_from_question(payload.question, payload.scenario)
    score = model_score(scenario)
    answer, highlight, agent_mode = _llm_explain(payload.question, scenario, score)
    message = {
        "question": payload.question,
        "answer": answer,
        "highlight": highlight,
        "agentMode": agent_mode,
        "score": score,
        "createdAt": utc_now()
    }
    store = load_store()
    store["agent_messages"].setdefault(user["id"], []).append(message)
    save_store(store)
    return message
