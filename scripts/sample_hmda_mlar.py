#!/usr/bin/env python3
"""Create a small modeled-ready sample from a large HMDA Modified LAR file.

The 2025 combined M-LAR file is pipe-delimited and may not include a header.
Standard HMDA Modified LAR does not expose application month, so this script
samples N rows from the year instead of 5,000 rows per month.

Example:
  python scripts/sample_hmda_mlar.py \
    --input "/path/to/2025_combined_mlar.csv" \
    --output data/hmda_2025_sample_60000.csv \
    --year 2025 \
    --n 60000

For the narrowed ClariFi model:
  python scripts/sample_hmda_mlar.py \
    --input "/path/to/2025_combined_mlar.csv" \
    --output data/hmda_2025_ca_sample_60000.csv \
    --year 2025 \
    --state CA \
    --n 60000

For the notebook's exact modeling scope:
  python scripts/sample_hmda_mlar.py \
    --input "/path/to/2025_combined_mlar.csv" \
    --output data/hmda_2025_ca_model_ready_60000.csv \
    --year 2025 \
    --state CA \
    --model-ready \
    --n 60000
"""

from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path


HMDA_COLUMNS = [
    "activity_year",
    "lei",
    "loan_type",
    "loan_purpose",
    "preapproval",
    "construction_method",
    "occupancy_type",
    "loan_amount",
    "action_taken",
    "state_code",
    "county_code",
    "census_tract",
    "applicant_ethnicity_1",
    "applicant_ethnicity_2",
    "applicant_ethnicity_3",
    "applicant_ethnicity_4",
    "applicant_ethnicity_5",
    "co_applicant_ethnicity_1",
    "co_applicant_ethnicity_2",
    "co_applicant_ethnicity_3",
    "co_applicant_ethnicity_4",
    "co_applicant_ethnicity_5",
    "applicant_ethnicity_observed",
    "co_applicant_ethnicity_observed",
    "applicant_race_1",
    "applicant_race_2",
    "applicant_race_3",
    "applicant_race_4",
    "applicant_race_5",
    "co_applicant_race_1",
    "co_applicant_race_2",
    "co_applicant_race_3",
    "co_applicant_race_4",
    "co_applicant_race_5",
    "applicant_race_observed",
    "co_applicant_race_observed",
    "applicant_sex",
    "co_applicant_sex",
    "applicant_sex_observed",
    "co_applicant_sex_observed",
    "applicant_age",
    "co_applicant_age",
    "applicant_age_above_62",
    "co_applicant_age_above_62",
    "income",
    "purchaser_type",
    "rate_spread",
    "hoepa_status",
    "lien_status",
    "applicant_credit_score_type",
    "co_applicant_credit_score_type",
    "denial_reason_1",
    "denial_reason_2",
    "denial_reason_3",
    "denial_reason_4",
    "total_loan_costs",
    "total_points_and_fees",
    "origination_charges",
    "discount_points",
    "lender_credits",
    "interest_rate",
    "prepayment_penalty_term",
    "debt_to_income_ratio",
    "combined_loan_to_value_ratio",
    "loan_term",
    "intro_rate_period",
    "negative_amortization",
    "interest_only_payment",
    "balloon_payment",
    "other_nonamortizing_features",
    "property_value",
    "manufactured_home_secured_property_type",
    "manufactured_home_land_property_interest",
    "total_units",
    "multifamily_affordable_units",
    "submission_of_application",
    "initially_payable_to_institution",
    "aus_1",
    "aus_2",
    "aus_3",
    "aus_4",
    "aus_5",
    "reverse_mortgage",
    "open_end_line_of_credit",
    "business_or_commercial_purpose",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to the large pipe-delimited HMDA M-LAR file")
    parser.add_argument("--output", required=True, help="Path to write sampled CSV with header")
    parser.add_argument("--year", default="2025", help="Activity year to keep")
    parser.add_argument("--state", default=None, help="Optional state code filter, e.g. CA")
    parser.add_argument(
        "--model-ready",
        action="store_true",
        help="Keep only notebook modeling rows: home purchase, principal residence, first lien, action_taken in 1/2/3",
    )
    parser.add_argument("--n", type=int, default=60000, help="Number of rows to sample")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    return parser.parse_args()


def keep_row(row: list[str], year: str, state: str | None, model_ready: bool) -> bool:
    if len(row) != len(HMDA_COLUMNS):
        return False
    if row[0] != year:
        return False
    if state and row[9] != state:
        return False
    if model_ready:
        loan_purpose = row[3]
        occupancy_type = row[6]
        action_taken = row[8]
        lien_status = row[49]
        if loan_purpose != "1":
            return False
        if occupancy_type != "1":
            return False
        if lien_status != "1":
            return False
        if action_taken not in {"1", "2", "3"}:
            return False
    return True


def reservoir_sample(input_path: Path, year: str, state: str | None, model_ready: bool, n: int, seed: int) -> tuple[list[list[str]], int, int]:
    rng = random.Random(seed)
    reservoir: list[list[str]] = []
    scanned = 0
    eligible = 0

    with input_path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.reader(f, delimiter="|")
        for row in reader:
            scanned += 1
            if not keep_row(row, year, state, model_ready):
                continue
            eligible += 1
            if len(reservoir) < n:
                reservoir.append(row)
            else:
                j = rng.randint(0, eligible - 1)
                if j < n:
                    reservoir[j] = row
            if scanned % 1_000_000 == 0:
                print(f"scanned={scanned:,} eligible={eligible:,} sampled={len(reservoir):,}")

    return reservoir, scanned, eligible


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    sample, scanned, eligible = reservoir_sample(input_path, args.year, args.state, args.model_ready, args.n, args.seed)

    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(HMDA_COLUMNS)
        writer.writerows(sample)

    print(f"Wrote {len(sample):,} sampled rows to {output_path}")
    print(f"Scanned {scanned:,} rows; eligible rows: {eligible:,}")
    if eligible < args.n:
        print(f"Warning: only {eligible:,} rows matched the filters, fewer than requested n={args.n:,}")


if __name__ == "__main__":
    main()
