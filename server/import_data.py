"""Data loading, storage, and transaction helpers for ClariFi."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA = PROJECT_ROOT / "client" / "public" / "data"
LOCAL_STORE_PATH = PUBLIC_DATA / "local_store.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_json_or_none(path: Path) -> Any | None:
    if not path.exists():
        return None
    return read_json(path)


def initial_store() -> dict[str, Any]:
    return {
        "users": {},
        "profiles": {},
        "transactions": {},
        "scenarios": {},
        "agent_messages": {},
    }


def load_local_store() -> dict[str, Any]:
    if LOCAL_STORE_PATH.exists():
        return read_json(LOCAL_STORE_PATH)
    store = initial_store()
    with LOCAL_STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f)
    return store


def save_local_store(store: dict[str, Any]) -> None:
    with LOCAL_STORE_PATH.open("w", encoding="utf-8") as f:
        json.dump(store, f)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(12)
    digest = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return f"{salt}:{digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, digest = stored.split(":", 1)
    check = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return secrets.compare_digest(check, digest)


def make_token(user_id: str) -> str:
    return f"demo_{user_id}_{secrets.token_urlsafe(24)}"


def safe_float(value: Any, default: float = 0.0) -> float | None:
    text = str(value or "").strip().replace(",", "").replace("$", "")
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return None


def transaction_month_key(date_value: Any) -> str | None:
    text = str(date_value or "").strip()[:10]
    if len(text) >= 7 and text[4] == "-":
        return text[:7]
    return None


def sample_transactions() -> list[dict[str, Any]]:
    return [
        {"id": "tx-1", "date": "2026-05-01", "merchant": "Rent", "category": "housing", "amount": -2650},
        {"id": "tx-2", "date": "2026-05-03", "merchant": "Grocery", "category": "food", "amount": -184},
        {"id": "tx-3", "date": "2026-05-04", "merchant": "Payroll", "category": "income", "amount": 4700},
        {"id": "tx-4", "date": "2026-05-06", "merchant": "Auto loan", "category": "debt", "amount": -525},
        {"id": "tx-5", "date": "2026-05-08", "merchant": "Brokerage transfer", "category": "savings", "amount": -1100},
    ]


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
        month = transaction_month_key(tx.get("date")) or "unknown"
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


def parse_csv_transactions(text: str) -> tuple[list[dict[str, Any]], int, list[str]]:
    """Parse transaction CSV text. Returns (rows, skipped_count, error_messages)."""
    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, Any]] = []
    skipped = 0
    errors: list[str] = []
    for index, row in enumerate(reader, start=1):
        amount = safe_float(row.get("amount"))
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
    return rows, skipped, errors


def money_fmt(value: float) -> str:
    return f"${value:,.0f}"
