from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import secrets
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
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
VALID_HIGHLIGHTS = {"readiness", "finances", "hmda", "model"}

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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

# Global Mongo client instance created on startup when MONGODB_URI is set
MONGO_CLIENT = None


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = PROJECT_ROOT / "public" / "data"
MODEL_PATH = PUBLIC_DATA / "model_outputs" / "hmda_2025_xgboost_calibrated_pipeline.joblib"
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "clarifi")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "app_store")

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


@app.on_event("startup")
def startup_mongo_client() -> None:
    """Initialize a shared MongoClient if `MONGODB_URI` is set and pymongo is available."""
    global MONGO_CLIENT
    if MONGODB_URI and MongoClient is not None:
        MONGO_CLIENT = MongoClient(MONGODB_URI)


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


def initial_store() -> dict[str, Any]:
    return {
        "users": {},
        "profiles": {},
        "transactions": {},
        "scenarios": {},
        "agent_messages": {}
    }


def load_store() -> dict[str, Any]:
    if MONGO_CLIENT is None:
        raise RuntimeError("MONGODB_URI is not configured. Set it in your .env file.")
    collection = MONGO_CLIENT[MONGODB_DB][MONGODB_COLLECTION]
    doc = collection.find_one({"_id": "clarifi_store"})
    if not doc:
        store = initial_store()
        collection.replace_one({"_id": "clarifi_store"}, {"_id": "clarifi_store", **store}, upsert=True)
        return store
    doc.pop("_id", None)
    return doc


def save_store(store: dict[str, Any]) -> None:
    if MONGO_CLIENT is None:
        raise RuntimeError("MONGODB_URI is not configured. Set it in your .env file.")
    collection = MONGO_CLIENT[MONGODB_DB][MONGODB_COLLECTION]
    collection.replace_one({"_id": "clarifi_store"}, {"_id": "clarifi_store", **store}, upsert=True)


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


def summarize_transactions(transactions: list[dict[str, Any]]) -> dict[str, Any]:
    totals: dict[str, float] = {}
    for tx in transactions:
        category = str(tx.get("category", "uncategorized")).lower()
        totals[category] = totals.get(category, 0) + float(tx.get("amount", 0))
    outflow = sum(abs(value) for key, value in totals.items() if key != "income" and value < 0)
    income = totals.get("income", 0)
    return {
        "transactionCount": len(transactions),
        "monthlyIncomeObserved": income,
        "monthlyOutflowObserved": outflow,
        "netCashflowObserved": income - outflow,
        "categoryTotals": totals
    }


def scenario_features(scenario: ScenarioInput) -> dict[str, Any]:
    market_codes = {
        "Sacramento": 6067,
        "Alameda": 6001,
        "San Diego": 6073,
        "Los Angeles": 6037
    }
    annual_income_k = max(scenario.income * 12 / 1000, 1)
    loan_amount = max(scenario.price - scenario.savings, 1)
    property_value = max(scenario.price, 1)
    monthly_housing = loan_amount * 0.0062
    dti = (scenario.debt + monthly_housing) / max(scenario.income, 1)
    ltv = loan_amount / property_value
    county_median_income = {
        "Sacramento": 118,
        "Alameda": 166,
        "San Diego": 139,
        "Los Angeles": 134
    }.get(scenario.market, 130)
    county_median_loan = {
        "Sacramento": 560000,
        "Alameda": 950000,
        "San Diego": 790000,
        "Los Angeles": 840000
    }.get(scenario.market, 650000)

    return {
        "loan_amount": loan_amount,
        "income": annual_income_k,
        "property_value": property_value,
        "dti_numeric": dti * 100,
        "combined_loan_to_value_ratio": ltv * 100,
        "loan_term": 360,
        "loan_to_income": loan_amount / (annual_income_k * 1000),
        "down_payment_rate_proxy": scenario.savings / property_value,
        "log_income": math.log1p(annual_income_k),
        "log_loan_amount": math.log1p(loan_amount),
        "log_property_value": math.log1p(property_value),
        "high_dti_flag": 1 if dti > 0.43 else 0,
        "high_ltv_flag": 1 if ltv > 0.9 else 0,
        "jumbo_proxy_flag": 1 if loan_amount > 766550 else 0,
        "income_vs_county_median": annual_income_k / county_median_income,
        "loan_vs_county_median": loan_amount / county_median_loan,
        "county_applications": 1000,
        "county_median_income": county_median_income,
        "county_median_loan": county_median_loan,
        "income_decile": min(max(int(annual_income_k // 35), 1), 10),
        "loan_amount_decile": min(max(int(loan_amount // 120000), 1), 10),
        "county_code": str(market_codes.get(scenario.market, 6067)),
        "loan_type": "1"
    }


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

    # Neutral baseline: DTI=0.36, down_payment=0.20, surplus=$1000
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
    # Sort by absolute impact descending
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

    # Option 1: reduce debt to bring DTI to 0.36
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

    # Option 2: increase savings to 20% down payment
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

    # Option 3: lower target price by 10%
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

    # Pick candidate with highest delta
    candidates.sort(key=lambda x: x["delta"], reverse=True)
    best = candidates[0]
    best["newScore"] = round(min(max(0.52 + (best["newApproval"] * 130) + 60 - 130 * 0.52, 18), 96))
    return best


def money_fmt(value: float) -> str:
    return f"${value:,.0f}"


def heuristic_score(scenario: ScenarioInput) -> dict[str, Any]:
    features = scenario_features(scenario)
    monthly_housing = (scenario.price - scenario.savings) * 0.0062
    flexible = sum(scenario.expenses.values())
    surplus = scenario.income - scenario.debt - monthly_housing - flexible
    dti = features["dti_numeric"] / 100
    down_payment = features["down_payment_rate_proxy"]
    score = min(max(34 + down_payment * 118 + (1 - abs(dti - 0.32)) * 26 - max(dti - 0.36, 0) * 360 + surplus / 1800, 18), 96)
    approval = min(max(0.52 + (score - 60) / 130, 0.08), 0.97)
    return {
        "mode": "heuristic-fallback",
        "score": round(score),
        "approvalLikelihood": round(approval, 3),
        "monthlyHousing": round(monthly_housing),
        "monthlySurplus": round(surplus),
        "dti": round(dti, 3),
        "downPaymentRate": round(down_payment, 3),
        "drivers": [
            {"label": "Down payment", "value": down_payment, "direction": "positive"},
            {"label": "Debt-to-income", "value": dti, "direction": "negative" if dti > 0.36 else "positive"},
            {"label": "Monthly surplus", "value": surplus, "direction": "positive" if surplus >= 0 else "negative"}
        ],
        "localShap": _local_shap(scenario, features, approval),
        "counterfactual": _counterfactual(scenario, features, approval),
    }


def model_score(scenario: ScenarioInput) -> dict[str, Any]:
    if joblib is None or pd is None or not MODEL_PATH.exists():
        return heuristic_score(scenario)
    model = joblib.load(MODEL_PATH)
    features = scenario_features(scenario)
    frame = pd.DataFrame([features])
    probability = float(model.predict_proba(frame)[:, 1][0])
    report = read_json(PUBLIC_DATA / "model_report.json")
    threshold = report.get("metrics", {}).get("bestThreshold", 0.9)
    heuristic = heuristic_score(scenario)
    return {
        **heuristic,
        "mode": "calibrated-xgboost",
        "approvalLikelihood": round(probability, 3),
        "score": round(min(max(probability * 100, 0), 100)),
        "bestThreshold": threshold,
        # Re-compute counterfactual using the real model probability as baseline
        "counterfactual": _counterfactual(scenario, features, probability),
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "name": "ClariFi API",
        "stack": ["FastAPI", "React", "TypeScript", "Vite", "D3", "MongoDB-ready"],
        "modelArtifactPresent": MODEL_PATH.exists(),
        "database": "mongodb" if MONGODB_URI and MongoClient is not None else "local-json",
        "generatedAt": utc_now()
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
    text = (await file.read()).decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for index, row in enumerate(reader, start=1):
        rows.append({
            "id": row.get("id") or f"upload-{index}",
            "date": row.get("date", ""),
            "merchant": row.get("merchant") or row.get("description") or "Imported transaction",
            "category": (row.get("category") or "uncategorized").lower(),
            "amount": float(row.get("amount", 0))
        })
    store = load_store()
    store["transactions"][user["id"]] = rows
    save_store(store)
    return {"imported": len(rows), "summary": summarize_transactions(rows)}


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
    return read_json(PUBLIC_DATA / "bls_benchmarks.json")


@app.get("/api/hmda")
def hmda() -> Any:
    return read_json(PUBLIC_DATA / "hmda_processed.json")


@app.get("/api/model")
def model_report() -> Any:
    return read_json(PUBLIC_DATA / "model_report.json")


@app.post("/api/mortgage/score")
def score_mortgage(payload: ScenarioInput, user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    result = model_score(payload)
    store = load_store()
    store["scenarios"].setdefault(user["id"], []).append({
        "id": f"scenario-{len(store['scenarios'].get(user['id'], [])) + 1}",
        "createdAt": utc_now(),
        "input": payload.model_dump(),
        "result": result
    })
    save_store(store)
    return result


@app.post("/api/scenarios")
def save_scenario(payload: ScenarioInput, user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    return score_mortgage(payload, user)


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
    return answer, highlight, "rule-based"


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
    # Strip markdown code fences if present
    if "```" in text:
        for block in text.split("```"):
            cleaned = block.lstrip("json").strip()
            if cleaned.startswith("{"):
                text = cleaned
                break
    # Find the first {...} block
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
    """Try Ollama → Anthropic → rule-based, returning (answer, highlight, model_label)."""
    result = _ollama_explain(question, scenario, score)
    if result:
        return result
    result = _anthropic_explain(question, scenario, score)
    if result:
        return result
    return _rule_based_explain(question, score)


@app.post("/api/agent/explain")
def explain(payload: AgentExplainInput, user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    scenario = payload.scenario or ScenarioInput()
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
