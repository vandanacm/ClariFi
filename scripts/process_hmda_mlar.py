#!/usr/bin/env python3
"""Build dashboard HMDA JSON from a Modified LAR CSV sample.

Filters California rows, aggregates county-level readiness, and down-samples
scatter points for browser performance.

Usage:
  python scripts/process_hmda_mlar.py
  python scripts/process_hmda_mlar.py data/hmda_2025_sample_60000.csv public/data/hmda_processed.json
"""
from __future__ import annotations

import csv
import json
import random
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "hmda_2025_sample_60000.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "public" / "data" / "hmda_processed.json"
MAX_SCATTER = 2500
MIN_COUNTY_APPS = 8
SEED = 42

CA_FIPS_TO_NAME: dict[str, str] = {
    "06001": "Alameda",
    "06003": "Alpine",
    "06005": "Amador",
    "06007": "Butte",
    "06009": "Calaveras",
    "06011": "Colusa",
    "06013": "Contra Costa",
    "06015": "Del Norte",
    "06017": "El Dorado",
    "06019": "Fresno",
    "06021": "Glenn",
    "06023": "Humboldt",
    "06025": "Imperial",
    "06027": "Inyo",
    "06029": "Kern",
    "06031": "Kings",
    "06033": "Lake",
    "06035": "Lassen",
    "06037": "Los Angeles",
    "06039": "Madera",
    "06041": "Marin",
    "06043": "Mariposa",
    "06045": "Mendocino",
    "06047": "Merced",
    "06049": "Modoc",
    "06051": "Mono",
    "06053": "Monterey",
    "06055": "Napa",
    "06057": "Nevada",
    "06059": "Orange",
    "06061": "Placer",
    "06063": "Plumas",
    "06065": "Riverside",
    "06067": "Sacramento",
    "06069": "San Benito",
    "06071": "San Bernardino",
    "06073": "San Diego",
    "06075": "San Francisco",
    "06077": "San Joaquin",
    "06079": "San Luis Obispo",
    "06081": "San Mateo",
    "06083": "Santa Barbara",
    "06085": "Santa Clara",
    "06087": "Santa Cruz",
    "06089": "Shasta",
    "06091": "Sierra",
    "06093": "Siskiyou",
    "06095": "Solano",
    "06097": "Sonoma",
    "06099": "Stanislaus",
    "06101": "Sutter",
    "06103": "Tehama",
    "06105": "Trinity",
    "06107": "Tulare",
    "06109": "Tuolumne",
    "06111": "Ventura",
    "06113": "Yolo",
    "06115": "Yuba",
}

MARKET_FIPS: dict[str, list[str]] = {
    "Sacramento": ["06067", "06113", "06061", "06017", "06095"],
    "Alameda": ["06001", "06013", "06085", "06081", "06075", "06041"],
    "San Diego": ["06073", "06059", "06065", "06071", "06083"],
    "Los Angeles": ["06037", "06059", "06065", "06111", "06071"],
}

FIPS_TO_MARKETS: dict[str, list[str]] = defaultdict(list)
for market, fips_list in MARKET_FIPS.items():
    for fips in fips_list:
        if market not in FIPS_TO_MARKETS[fips]:
            FIPS_TO_MARKETS[fips].append(market)

DTI_MIDPOINTS = {
    "<20%": 0.18,
    "20%-<30%": 0.25,
    "30%-<36%": 0.33,
    "36%-<50%": 0.43,
    "50%-60%": 0.55,
    ">60%": 0.64,
}


def median(values: list[float]) -> float:
    nums = sorted(v for v in values if v == v)
    if not nums:
        return 0.0
    mid = len(nums) // 2
    return nums[mid] if len(nums) % 2 else (nums[mid - 1] + nums[mid]) / 2


def parse_income(raw: str) -> float | None:
    text = (raw or "").strip()
    if not text or text.upper() in {"NA", "EXEMPT", "8888", "9999"}:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return value * 1000 if value < 10_000 else value


def parse_loan_amount(raw: str) -> float | None:
    text = (raw or "").strip()
    if not text or text.upper() in {"NA", "EXEMPT"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_property_value(raw: str) -> float | None:
    text = (raw or "").strip()
    if not text or text.upper() in {"NA", "EXEMPT"}:
        return None
    try:
        value = float(text)
    except ValueError:
        return None
    return value * 1000 if value < 50_000 else value


def parse_interest_rate(raw: str) -> float | None:
    text = (raw or "").strip()
    if not text or text.upper() in {"NA", "EXEMPT"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def approval_rate(rows: list[dict]) -> float:
    if not rows:
        return 0.0
    approved = sum(1 for row in rows if row["approved"])
    return approved / len(rows)


def readiness_from_rows(rows: list[dict]) -> int:
    """County readiness 28–94, spread primarily by historical approval rate."""
    if not rows:
        return 28
    rate = approval_rate(rows)
    volume = min(len(rows) / 250, 1.0)
    score = 28 + rate * 58 + volume * 8
    return round(min(max(score, 28), 94))


def readiness_from_rate(rate: float) -> int:
    return round(min(max(28 + rate * 58 + 4, 28), 94))


def county_summary(name: str, rows: list[dict]) -> dict:
    approved_rows = [row for row in rows if row["approved"]]
    return {
        "name": name,
        "readiness": readiness_from_rows(rows),
        "approvalRate": round(approval_rate(rows), 3),
        "applications": len(rows),
        "medianApprovedIncome": round(median([row["income"] for row in approved_rows])),
        "medianApprovedLoan": round(median([row["loanAmount"] for row in approved_rows])),
    }


def load_ca_loans(input_path: Path) -> list[dict]:
    loans: list[dict] = []
    with input_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, start=1):
            if row.get("state_code") != "CA":
                continue
            fips = (row.get("county_code") or "").strip().zfill(5)
            county_name = CA_FIPS_TO_NAME.get(fips)
            if not county_name:
                continue
            income = parse_income(row.get("income", ""))
            loan_amount = parse_loan_amount(row.get("loan_amount", ""))
            if income is None or loan_amount is None or income <= 0 or loan_amount <= 0:
                continue
            action = (row.get("action_taken") or "").strip()
            approved = action in {"1", "2"}
            dti_raw = row.get("debt_to_income_ratio", "")
            loans.append(
                {
                    "id": f"hmda-{index}",
                    "fips": fips,
                    "county": county_name,
                    "income": income,
                    "loanAmount": loan_amount,
                    "approved": approved,
                    "dti": DTI_MIDPOINTS.get(dti_raw, 0.4),
                    "propertyValue": parse_property_value(row.get("property_value", "")) or loan_amount * 1.15,
                    "interestRate": parse_interest_rate(row.get("interest_rate", "")) or 0.0,
                }
            )
    return loans


def build_markets(loans: list[dict], county_rows: dict[str, list[dict]]) -> dict:
    markets: dict = {}
    for market, fips_list in MARKET_FIPS.items():
        market_loans = [loan for loan in loans if loan["fips"] in fips_list]
        approved = [loan for loan in market_loans if loan["approved"]]
        counties = []
        for fips in fips_list:
            name = CA_FIPS_TO_NAME[fips]
            rows = county_rows.get(name, [])
            if len(rows) >= MIN_COUNTY_APPS:
                counties.append(county_summary(name, rows))
        counties.sort(key=lambda item: item["applications"], reverse=True)
        markets[market] = {
            "incomeMedian": round(median([loan["income"] for loan in approved]) / 12) if approved else 0,
            "priceMedian": round(median([loan["propertyValue"] for loan in approved])) if approved else 0,
            "approvalBase": round(approval_rate(market_loans), 3),
            "counties": counties[:6],
        }
    return markets


def primary_market_for_fips(fips: str) -> str:
    """Assign a dashboard market to every CA county (map + filters)."""
    tagged = FIPS_TO_MARKETS.get(fips, [])
    if tagged:
        return tagged[0]
    la = {
        "06029", "06031", "06033", "06035", "06037", "06039", "06047", "06049", "06051",
        "06053", "06059", "06063", "06065", "06069", "06071", "06083", "06099", "06107",
        "06111",
    }
    sd = {"06025", "06073", "06079"}
    bay = {
        "06001", "06009", "06013", "06041", "06045", "06055", "06075", "06081", "06085",
        "06087", "06095", "06097",
    }
    if fips in la:
        return "Los Angeles"
    if fips in sd:
        return "San Diego"
    if fips in bay:
        return "Alameda"
    return "Sacramento"


def build_county_primary_markets() -> dict[str, str]:
    return {CA_FIPS_TO_NAME[fips]: primary_market_for_fips(fips) for fips in CA_FIPS_TO_NAME}


def build_counties(county_rows: dict[str, list[dict]], all_loans: list[dict]) -> dict[str, dict]:
    """Emit all 58 CA counties; thin samples use local rate or statewide average for map color."""
    state_rate = round(approval_rate(all_loans), 3)
    counties: dict[str, dict] = {}
    for fips in sorted(CA_FIPS_TO_NAME.keys()):
        name = CA_FIPS_TO_NAME[fips]
        rows = county_rows.get(name, [])
        if len(rows) >= MIN_COUNTY_APPS:
            summary = county_summary(name, rows)
            summary["dataSource"] = "county"
            counties[name] = summary
            continue
        if rows:
            approved_rows = [row for row in rows if row["approved"]]
            counties[name] = {
                "name": name,
                "readiness": readiness_from_rows(rows),
                "approvalRate": round(approval_rate(rows), 3),
                "applications": len(rows),
                "medianApprovedIncome": round(median([row["income"] for row in approved_rows])) if approved_rows else 0,
                "medianApprovedLoan": round(median([row["loanAmount"] for row in approved_rows])) if approved_rows else 0,
                "dataSource": "sparse",
            }
        else:
            counties[name] = {
                "name": name,
                "readiness": readiness_from_rate(state_rate),
                "approvalRate": state_rate,
                "applications": 0,
                "medianApprovedIncome": 0,
                "medianApprovedLoan": 0,
                "dataSource": "state-average",
            }
    return counties


def downsample_scatter(loans: list[dict], max_rows: int) -> list[dict]:
    if len(loans) <= max_rows:
        sampled = loans
    else:
        rng = random.Random(SEED)
        by_county: dict[str, list[dict]] = defaultdict(list)
        for loan in loans:
            by_county[loan["county"]].append(loan)
        sampled = []
        per_county = max(1, max_rows // max(len(by_county), 1))
        for county_loans in by_county.values():
            if len(county_loans) <= per_county:
                sampled.extend(county_loans)
            else:
                sampled.extend(rng.sample(county_loans, per_county))
        if len(sampled) > max_rows:
            sampled = rng.sample(sampled, max_rows)

    scatter = []
    for loan in sampled:
        scatter.append(
            {
                "id": loan["id"],
                "marketTags": FIPS_TO_MARKETS.get(loan["fips"], []),
                "county": loan["county"],
                "incomeMonthly": round(loan["income"] / 12),
                "loanAmount": round(loan["loanAmount"]),
                "approved": loan["approved"],
                "dti": loan["dti"],
                "interestRate": loan["interestRate"],
            }
        )
    return scatter


def main() -> None:
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUTPUT

    loans = load_ca_loans(input_path)
    if not loans:
        raise SystemExit(f"No California loans parsed from {input_path}")

    county_rows: dict[str, list[dict]] = defaultdict(list)
    for loan in loans:
        county_rows[loan["county"]].append(loan)

    counties = build_counties(county_rows, loans)
    markets = build_markets(loans, county_rows)
    scatter = downsample_scatter(loans, MAX_SCATTER)
    county_primary_market = build_county_primary_markets()

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "name": f"HMDA 2025 CA extract (n={len(loans):,})",
            "note": "All 58 CA counties on the map. Counties with fewer than 8 sample applications use sparse local counts or statewide average for color only.",
            "rawRows": len(loans),
            "scatterRows": len(scatter),
            "countyCount": len(counties),
        },
        "counties": counties,
        "countyPrimaryMarket": county_primary_market,
        "markets": markets,
        "scatter": scatter,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    print(f"Processed {len(loans):,} CA rows → {len(counties)} counties, {len(scatter):,} scatter points")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
