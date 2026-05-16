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


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = PROJECT_ROOT / "public" / "data"
STORE_PATH = PROJECT_ROOT / "data" / "clarifi_store.json"
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
    if MONGODB_URI and MongoClient is not None:
        collection = MongoClient(MONGODB_URI)[MONGODB_DB][MONGODB_COLLECTION]
        doc = collection.find_one({"_id": "clarifi_store"})
        if not doc:
            store = initial_store()
            collection.replace_one({"_id": "clarifi_store"}, {"_id": "clarifi_store", **store}, upsert=True)
            return store
        doc.pop("_id", None)
        return doc

    if not STORE_PATH.exists():
        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        save_store(initial_store())
    return read_json(STORE_PATH)


def save_store(store: dict[str, Any]) -> None:
    if MONGODB_URI and MongoClient is not None:
        collection = MongoClient(MONGODB_URI)[MONGODB_DB][MONGODB_COLLECTION]
        collection.replace_one({"_id": "clarifi_store"}, {"_id": "clarifi_store", **store}, upsert=True)
        return

    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with STORE_PATH.open("w", encoding="utf-8") as handle:
        json.dump(store, handle, indent=2)


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
        ]
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
    return {
        **heuristic_score(scenario),
        "mode": "calibrated-xgboost",
        "approvalLikelihood": round(probability, 3),
        "score": round(min(max(probability * 100, 0), 100)),
        "bestThreshold": threshold
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


@app.post("/api/agent/explain")
def explain(payload: AgentExplainInput, user: dict[str, Any] = Depends(user_from_authorization)) -> dict[str, Any]:
    scenario = payload.scenario or ScenarioInput()
    score = model_score(scenario)
    if score["dti"] > 0.38:
        answer = "Your DTI is the main pressure point. Lower monthly debt or reduce target price before increasing the down payment target."
    elif score["downPaymentRate"] < 0.18:
        answer = "The down payment is the clearest improvement lever. A higher savings buffer should improve readiness and reduce LTV pressure."
    elif score["monthlySurplus"] < 0:
        answer = "The scenario is cashflow negative. Restore monthly surplus before treating the approval likelihood as stable."
    else:
        answer = "This scenario is broadly balanced. The dashboard should focus on county comparison and resilience under expense shocks."
    message = {
        "question": payload.question,
        "answer": answer,
        "score": score,
        "createdAt": utc_now()
    }
    store = load_store()
    store["agent_messages"].setdefault(user["id"], []).append(message)
    save_store(store)
    return message
