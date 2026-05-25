#!/usr/bin/env python3
"""Train the ClariFi XGBoost mortgage readiness model.

Generates synthetic HMDA-shaped California data, trains an XGBoost classifier
with isotonic probability calibration, and saves the pipeline to
public/data/model_outputs/hmda_2025_xgboost_calibrated_pipeline.joblib.

Usage:
    python scripts/train_xgboost_model.py
"""
from __future__ import annotations

import math
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, brier_score_loss
from sklearn.preprocessing import OrdinalEncoder
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from xgboost import XGBClassifier
import joblib

SEED = 42
N_ROWS = 58_000

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = PROJECT_ROOT / "public" / "data" / "model_outputs"
OUT_PATH = OUT_DIR / "hmda_2025_xgboost_calibrated_pipeline.joblib"
REPORT_PATH = PROJECT_ROOT / "public" / "data" / "model_report.json"

COUNTY_CODES = ["6067", "6001", "6073", "6037"]
COUNTY_MEDIAN_INCOME = {"6067": 118, "6001": 166, "6073": 139, "6037": 134}
COUNTY_MEDIAN_LOAN = {"6067": 560_000, "6001": 950_000, "6073": 790_000, "6037": 840_000}


def _approval_label(dti: float, dp: float, surplus: float, rng: np.random.Generator) -> int:
    score = min(max(34 + dp * 118 + (1 - abs(dti - 0.32)) * 26 - max(dti - 0.36, 0) * 360 + surplus / 1800, 18), 96)
    p = min(max(0.52 + (score - 60) / 130, 0.08), 0.97)
    # Add noise so the model has something real to learn
    p = float(np.clip(p + rng.normal(0, 0.06), 0.05, 0.97))
    return int(rng.uniform() < p)


def generate_data(n: int) -> pd.DataFrame:
    rng = np.random.default_rng(SEED)

    county_codes = rng.choice(COUNTY_CODES, size=n)
    county_med_inc = np.array([COUNTY_MEDIAN_INCOME[c] for c in county_codes], dtype=float)
    county_med_loan = np.array([COUNTY_MEDIAN_LOAN[c] for c in county_codes], dtype=float)

    # Annual income in $k (log-normal to mimic HMDA distribution)
    income = np.clip(rng.lognormal(mean=4.8, sigma=0.55, size=n), 30, 600)
    # Loan amounts: correlated with income and county
    loan_amount = np.clip(
        income * rng.uniform(3, 9, size=n) * 1000 * (county_med_loan / 650_000),
        50_000, 2_000_000
    )
    property_value = loan_amount / np.clip(rng.uniform(0.5, 0.98, size=n), 0.5, 0.98)
    savings = property_value - loan_amount

    monthly_housing = loan_amount * 0.0062
    monthly_income = income * 1000 / 12
    monthly_debt = np.clip(rng.lognormal(mean=6.5, sigma=0.6, size=n), 0, monthly_income * 0.6)

    dti = (monthly_debt + monthly_housing) / np.maximum(monthly_income, 1)
    ltv = loan_amount / np.maximum(property_value, 1)
    dp = savings / np.maximum(property_value, 1)

    flexible = np.clip(rng.lognormal(mean=7.5, sigma=0.4, size=n), 500, 8000)
    surplus = monthly_income - monthly_debt - monthly_housing - flexible

    labels = np.array([
        _approval_label(float(dti[i]), float(dp[i]), float(surplus[i]), rng)
        for i in range(n)
    ])

    df = pd.DataFrame({
        "loan_amount": loan_amount,
        "income": income,
        "property_value": property_value,
        "dti_numeric": dti * 100,
        "combined_loan_to_value_ratio": ltv * 100,
        "loan_term": 360,
        "loan_to_income": loan_amount / (income * 1000),
        "down_payment_rate_proxy": dp,
        "log_income": np.log1p(income),
        "log_loan_amount": np.log1p(loan_amount),
        "log_property_value": np.log1p(property_value),
        "high_dti_flag": (dti > 0.43).astype(int),
        "high_ltv_flag": (ltv > 0.9).astype(int),
        "jumbo_proxy_flag": (loan_amount > 766_550).astype(int),
        "income_vs_county_median": income / county_med_inc,
        "loan_vs_county_median": loan_amount / county_med_loan,
        "county_applications": 1000,
        "county_median_income": county_med_inc,
        "county_median_loan": county_med_loan,
        "income_decile": np.clip((income // 35).astype(int), 1, 10),
        "loan_amount_decile": np.clip((loan_amount // 120_000).astype(int), 1, 10),
        "county_code": county_codes,
        "loan_type": "1",
        "approved": labels,
    })
    return df


def main() -> None:
    print(f"Generating {N_ROWS:,} synthetic HMDA rows...")
    df = generate_data(N_ROWS)
    y = df.pop("approved").values

    cat_cols = ["county_code", "loan_type"]
    num_cols = [c for c in df.columns if c not in cat_cols]

    X_train, X_test, y_train, y_test = train_test_split(df, y, test_size=0.2, random_state=SEED)

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
        ],
        remainder="passthrough",
    )

    xgb = XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=5,
        random_state=SEED,
        eval_metric="logloss",
        verbosity=0,
    )

    base_pipeline = Pipeline([
        ("pre", preprocessor),
        ("clf", xgb),
    ])

    print("Training XGBoost...")
    # Calibrated classifier wraps the full pipeline
    cal = CalibratedClassifierCV(base_pipeline, method="isotonic", cv=3)
    cal.fit(X_train, y_train)

    proba_test = cal.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, proba_test)
    brier = brier_score_loss(y_test, proba_test)
    print(f"Test AUC: {auc:.4f}  Brier: {brier:.4f}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(cal, OUT_PATH)
    print(f"Model saved → {OUT_PATH}")

    # Update model_report.json metrics
    if REPORT_PATH.exists():
        report = json.loads(REPORT_PATH.read_text())
    else:
        report = {"modelName": "Calibrated XGBoost HMDA readiness model"}

    report["metrics"] = {
        **report.get("metrics", {}),
        "testAuc": round(auc, 4),
        "brierScore": round(brier, 4),
        "trainRows": len(X_train),
        "testRows": len(X_test),
    }
    report["rows"] = {"total": N_ROWS, "train": len(X_train), "test": len(X_test)}
    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print("model_report.json updated.")


if __name__ == "__main__":
    main()
