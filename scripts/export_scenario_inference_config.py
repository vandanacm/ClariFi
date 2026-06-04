#!/usr/bin/env python3
"""Build scenario_inference_config.json for API scoring aligned with the HMDA sample."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "server" / "data" / "hmda_2025_sample_60000.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "client" / "public" / "data" / "model_outputs" / "scenario_inference_config.json"

NUMERIC_FEATURES = [
    "loan_amount",
    "income",
    "property_value",
    "dti_numeric",
    "combined_loan_to_value_ratio",
    "loan_term",
    "loan_to_income",
    "down_payment_rate_proxy",
    "log_income",
    "log_loan_amount",
    "log_property_value",
    "high_dti_flag",
    "high_ltv_flag",
    "jumbo_proxy_flag",
    "income_vs_county_median",
    "loan_vs_county_median",
    "county_applications",
    "county_median_income",
    "county_median_loan",
    "income_decile",
    "loan_amount_decile",
]
CATEGORICAL_FEATURES = ["county_code", "loan_type"]

MARKET_COUNTY_CODE = {
    "Sacramento": "6067.0",
    "Alameda": "6001.0",
    "San Diego": "6073.0",
    "Los Angeles": "6037.0",
}


def county_code_for_model(raw: object) -> str:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return ""
    text = str(raw).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        return text
    fips = text.zfill(5)
    return f"{int(fips)}.0"


def income_thousands(raw: object) -> float | None:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    if isinstance(raw, (int, float)):
        value = float(raw)
        return value if value < 10_000 else value / 1000.0
    text = str(raw).strip()
    if not text or text.upper() in {"NA", "EXEMPT", "8888", "9999"}:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return value if value < 10_000 else value / 1000.0


def loan_amount(raw: object) -> float | None:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip()
    if not text or text.upper() in {"NA", "EXEMPT"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def load_training_frame(input_path: Path) -> pd.DataFrame:
    usecols = [
        "state_code",
        "loan_purpose",
        "occupancy_type",
        "lien_status",
        "loan_type",
        "county_code",
        "income",
        "loan_amount",
        "action_taken",
    ]
    frame = pd.read_csv(input_path, usecols=lambda c: c in set(usecols), low_memory=False)
    frame = frame[frame["state_code"] == "CA"].copy()
    if "loan_purpose" in frame.columns:
        frame = frame[frame["loan_purpose"].astype(str) == "1"]
    if "occupancy_type" in frame.columns:
        frame = frame[frame["occupancy_type"].astype(str) == "1"]
    if "lien_status" in frame.columns:
        frame = frame[frame["lien_status"].astype(str) == "1"]

    frame["income"] = frame["income"].map(income_thousands)
    frame["loan_amount"] = frame["loan_amount"].map(loan_amount)
    frame = frame.dropna(subset=["income", "loan_amount", "county_code"])
    frame = frame[(frame["income"] > 0) & (frame["loan_amount"] > 0)]
    frame["approved"] = frame["action_taken"].astype(str).isin({"1", "2"})
    frame["county_code"] = frame["county_code"].map(county_code_for_model)
    frame["loan_type"] = frame["loan_type"].astype(str)
    return frame


def build_config(frame: pd.DataFrame) -> dict:
    county_stats = (
        frame.groupby("county_code")
        .agg(
            county_applications=("approved", "size"),
            county_median_income=("income", "median"),
            county_median_loan=("loan_amount", "median"),
        )
        .reset_index()
    )
    income_edges = pd.qcut(frame["income"], q=10, duplicates="drop", retbins=True)[1].tolist()
    loan_edges = pd.qcut(frame["loan_amount"], q=10, duplicates="drop", retbins=True)[1].tolist()

    feature_defaults: dict[str, float | str] = {}
    for col in NUMERIC_FEATURES:
        if col in frame.columns:
            feature_defaults[col] = float(frame[col].median())
    for col in CATEGORICAL_FEATURES:
        if col in frame.columns:
            feature_defaults[col] = str(frame[col].mode(dropna=True).iloc[0])

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "export_scenario_inference_config.py — HMDA sample aligned with Colab pipeline",
        "numericFeatures": NUMERIC_FEATURES,
        "categoricalFeatures": CATEGORICAL_FEATURES,
        "marketCountyCode": MARKET_COUNTY_CODE,
        "countyStats": {
            str(row["county_code"]): {
                "county_applications": int(row["county_applications"]),
                "county_median_income": float(row["county_median_income"]),
                "county_median_loan": float(row["county_median_loan"]),
            }
            for _, row in county_stats.iterrows()
        },
        "incomeDecileEdges": [float(x) for x in income_edges],
        "loanDecileEdges": [float(x) for x in loan_edges],
        "featureDefaults": feature_defaults,
    }


def main(argv: list[str]) -> int:
    input_path = Path(argv[1]) if len(argv) > 1 else DEFAULT_INPUT
    output_path = Path(argv[2]) if len(argv) > 2 else DEFAULT_OUTPUT
    if not input_path.exists():
        print(f"Missing input: {input_path}", file=sys.stderr)
        return 1

    frame = load_training_frame(input_path)
    config = build_config(frame)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(config, indent=2), encoding="utf-8")
    print(f"Wrote {output_path} ({len(config['countyStats'])} counties, {len(frame)} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
