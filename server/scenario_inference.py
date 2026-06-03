"""Build scenario feature rows for the Colab-trained pipeline."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = PROJECT_ROOT / "client" / "public" / "data" / "model_outputs" / "scenario_inference_config.json"

_MARKET_FIPS = {
    "Sacramento": "6067.0",
    "Alameda": "6001.0",
    "San Diego": "6073.0",
    "Los Angeles": "6037.0",
}

_FALLBACK_COUNTY_STATS = {
    "6067.0": {"county_applications": 3341, "county_median_income": 118.0, "county_median_loan": 560000.0},
    "6001.0": {"county_applications": 4200, "county_median_income": 166.0, "county_median_loan": 950000.0},
    "6073.0": {"county_applications": 3100, "county_median_income": 139.0, "county_median_loan": 790000.0},
    "6037.0": {"county_applications": 9299, "county_median_income": 134.0, "county_median_loan": 840000.0},
}

_config_cache: dict[str, Any] | None = None


def load_inference_config() -> dict[str, Any] | None:
    global _config_cache
    if _config_cache is not None:
        return _config_cache
    if not CONFIG_PATH.exists():
        _config_cache = None
        return None
    _config_cache = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return _config_cache


def _decile_from_edges(value: float, edges: list[float]) -> float:
    if not edges or len(edges) < 2:
        return 5.0
    idx = 0
    for i in range(len(edges) - 1):
        if edges[i] <= value <= edges[i + 1]:
            idx = i
            break
    else:
        idx = len(edges) - 2 if value > edges[-1] else 0
    return float(min(max(idx, 0), 9))


def scenario_features_from_config(scenario: Any, config: dict[str, Any]) -> dict[str, Any]:
    """Notebook-aligned feature dict for dashboard scenarios."""
    market_codes = config.get("marketCountyCode", _MARKET_FIPS)
    county_code = str(market_codes.get(scenario.market, _MARKET_FIPS["Sacramento"]))
    county_stats = config.get("countyStats", {})
    stats = county_stats.get(county_code) or _FALLBACK_COUNTY_STATS.get(county_code, _FALLBACK_COUNTY_STATS["6067.0"])

    income_k = max(scenario.income * 12 / 1000, 1)
    loan_amount = max(scenario.price - scenario.savings, 1)
    property_value = max(scenario.price, 1)
    monthly_housing = loan_amount * 0.0062
    dti = (scenario.debt + monthly_housing) / max(scenario.income, 1)
    ltv = loan_amount / property_value
    county_median_income = float(stats.get("county_median_income", 130))
    county_median_loan = float(stats.get("county_median_loan", 650000))

    income_edges = config.get("incomeDecileEdges", [])
    loan_edges = config.get("loanDecileEdges", [])

    row: dict[str, Any] = {
        "loan_amount": loan_amount,
        "income": income_k,
        "property_value": property_value,
        "dti_numeric": dti * 100,
        "combined_loan_to_value_ratio": ltv * 100,
        "loan_term": 360,
        "loan_to_income": loan_amount / (income_k * 1000),
        "down_payment_rate_proxy": scenario.savings / property_value,
        "log_income": math.log1p(income_k),
        "log_loan_amount": math.log1p(loan_amount),
        "log_property_value": math.log1p(property_value),
        "high_dti_flag": 1.0 if dti >= 0.43 else 0.0,
        "high_ltv_flag": 1.0 if ltv >= 0.9 else 0.0,
        "jumbo_proxy_flag": 1.0 if loan_amount >= 766550 else 0.0,
        "income_vs_county_median": income_k / max(county_median_income, 1),
        "loan_vs_county_median": loan_amount / max(county_median_loan, 1),
        "county_applications": float(stats.get("county_applications", 1000)),
        "county_median_income": county_median_income,
        "county_median_loan": county_median_loan,
        "income_decile": _decile_from_edges(income_k, income_edges),
        "loan_amount_decile": _decile_from_edges(loan_amount, loan_edges),
        "county_code": county_code,
        "loan_type": "1",
    }

    defaults = config.get("featureDefaults", {})
    for key in config.get("numericFeatures", []):
        if key not in row and key in defaults:
            row[key] = defaults[key]
    for key in config.get("categoricalFeatures", []):
        if key not in row and key in defaults:
            row[key] = defaults[key]

    return row


def _market_county_code(market: str) -> str:
    code = _MARKET_FIPS.get(market, "6067.0")
    if "." not in code:
        return f"{int(code):04d}.0"
    return code


def scenario_features_legacy(scenario: Any) -> dict[str, Any]:
    """Feature row aligned with the Colab joblib pipeline when inference config is absent."""
    annual_income_k = max(scenario.income * 12 / 1000, 1)
    loan_amount = max(scenario.price - scenario.savings, 1)
    property_value = max(scenario.price, 1)
    monthly_housing = loan_amount * 0.0062
    dti = (scenario.debt + monthly_housing) / max(scenario.income, 1)
    ltv = loan_amount / property_value
    county_median_income = {"Sacramento": 118.0, "Alameda": 166.0, "San Diego": 139.0, "Los Angeles": 134.0}.get(scenario.market, 130.0)
    county_median_loan = {"Sacramento": 560000.0, "Alameda": 950000.0, "San Diego": 790000.0, "Los Angeles": 840000.0}.get(scenario.market, 650000.0)
    return {
        "loan_amount": float(loan_amount),
        "income": float(annual_income_k),
        "property_value": float(property_value),
        "dti_numeric": float(dti * 100),
        "combined_loan_to_value_ratio": float(ltv * 100),
        "loan_term": 360.0,
        "loan_to_income": float(loan_amount / (annual_income_k * 1000)),
        "down_payment_rate_proxy": float(scenario.savings / property_value),
        "log_income": float(math.log1p(annual_income_k)),
        "log_loan_amount": float(math.log1p(loan_amount)),
        "log_property_value": float(math.log1p(property_value)),
        "high_dti_flag": 1.0 if dti >= 0.43 else 0.0,
        "high_ltv_flag": 1.0 if ltv >= 0.9 else 0.0,
        "jumbo_proxy_flag": 1.0 if loan_amount >= 766550 else 0.0,
        "income_vs_county_median": float(annual_income_k / county_median_income),
        "loan_vs_county_median": float(loan_amount / county_median_loan),
        "county_applications": 1000.0,
        "county_median_income": county_median_income,
        "county_median_loan": county_median_loan,
        "income_decile": float(min(max(int(annual_income_k // 35), 1), 10)),
        "loan_amount_decile": float(min(max(int(loan_amount // 120000), 1), 10)),
        "county_code": _market_county_code(scenario.market),
        "loan_type": "1",
    }


def build_scenario_features(scenario: Any) -> tuple[dict[str, Any], str]:
    config = load_inference_config()
    if config:
        return scenario_features_from_config(scenario, config), "notebook-export"
    return scenario_features_legacy(scenario), "synthetic-local"


def features_dataframe(features: dict[str, Any], model: Any | None = None):
    """Build a one-row DataFrame with columns ordered for the sklearn pipeline."""
    import pandas as pd

    if model is not None and hasattr(model, "feature_names_in_"):
        columns = list(model.feature_names_in_)
        row = {col: features.get(col) for col in columns}
        return pd.DataFrame([row], columns=columns)
    return pd.DataFrame([features])
