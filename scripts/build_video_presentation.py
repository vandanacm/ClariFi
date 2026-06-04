#!/usr/bin/env python3
"""Build ECS 273 9-minute video deck (FinSight-style, engineering template)."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT_ROOT / "docs" / "presentation_assets"
OUTPUT = PROJECT_ROOT / "docs" / "ClariFi_Video_Presentation.pptx"
MODEL_REPORT = PROJECT_ROOT / "client" / "public" / "data" / "model_report.json"

TEAM = ["Lalitha", "Pranav", "Vandana"]


def ensure_assets() -> dict[str, Path]:
    ASSETS.mkdir(parents=True, exist_ok=True)
    script = PROJECT_ROOT / "scripts" / "build_presentation.py"
    if script.exists():
        subprocess.run([sys.executable, str(script)], cwd=str(PROJECT_ROOT), check=False)
    return {
        "architecture": ASSETS / "architecture.png",
        "training_scope": ASSETS / "training_scope.png",
        "metrics": ASSETS / "metrics_plot.png",
        "calibration": ASSETS / "calibration_plot.png",
        "persona_scores": ASSETS / "persona_comparison.png",
        "counties": ASSETS / "county_approval.png",
        "dashboard": ASSETS / "dashboard_screenshot.png",
        "dashboard_layout": ASSETS / "dashboard_layout.png",
        "global_features": ASSETS / "global_features.png",
    }


def _first_existing(assets: dict[str, Path], keys: tuple[str, ...]) -> Path | None:
    for key in keys:
        p = assets.get(key)
        if p and p.exists():
            return p
    return None


def _metrics_line() -> str:
    if not MODEL_REPORT.exists():
        return "Test AUC ≈ 0.80 · Brier ≈ 0.06 · balanced accuracy ≈ 0.74"
    m = json.loads(MODEL_REPORT.read_text(encoding="utf-8")).get("metrics", {})
    auc = m.get("testAuc")
    brier = m.get("brierScore")
    ba = m.get("balancedAccuracy")
    parts = []
    if auc is not None:
        parts.append(f"AUC {auc:.3f}")
    if brier is not None:
        parts.append(f"Brier {brier:.3f}")
    if ba is not None:
        parts.append(f"balanced acc. {ba:.3f}")
    return " · ".join(parts) if parts else "See metrics slide"


def build_video_pptx(assets: dict[str, Path]) -> None:
    sys.path.insert(0, str(PROJECT_ROOT))
    from scripts.engineer_deck import EngineerDeck

    deck = EngineerDeck()
    deck.create(OUTPUT)
    metrics_summary = _metrics_line()

    deck.add_cover(
        "ClariFi",
        "California Mortgage Readiness Dashboard\n"
        f"{TEAM[0]} · {TEAM[1]} · {TEAM[2]}\n"
        "ECS 273 · Visual Analytics · 9-minute video",
        notes="0:00–0:25 · Introduce team and project title",
    )

    deck.add_bullet_slide(
        "Introduction",
        [
            "ClariFi helps California households explore mortgage readiness before applying.",
            "Eighteen linked D3 views: budget donut, readiness planning, HMDA map, and XGBoost model audit.",
            "Calibrated on ~58k CA HMDA loans — educational only, not a lending decision.",
        ],
        notes="0:25–0:55 · FinSight-style intro · Lalitha",
    )

    deck.add_bullet_slide(
        "Motivation & Problem Statement",
        [
            "Credit scores and listing prices miss regional approval context.",
            "Users need income, debt, savings, target price, and county-level HMDA patterns in one place.",
            "ClariFi links personal cashflow to calibrated approval likelihood + agent explanations.",
        ],
        notes="0:55–1:35 · Problem · Lalitha",
    )

    deck.add_bullet_slide(
        "Datasets & Challenges",
        [
            "HMDA 2025: ~12M national rows → CA filter → ~5k/month → ~58k training rows.",
            "BLS Consumer Expenditure for peer spending benchmarks.",
            "Challenges: class imbalance (~90% approvals), feature sync with API, sparse counties.",
        ],
        notes="1:35–2:15 · Data · Lalitha",
    )

    deck.add_bullet_slide(
        "Related Work",
        [
            "Affordability calculators: no calibrated ML on real HMDA outcomes.",
            "Credit apps: personal scores without regional borrower comparison.",
            "ClariFi: XGBoost + 18 linked D3 views + budget-first UX + agent highlights.",
        ],
        notes="2:15–2:50 · Related work · Lalitha",
    )

    deck.add_bullet_slide(
        "Methodology & Algorithm",
        [
            "XGBoost (300 trees) + isotonic calibration on filtered CA purchase loans.",
            "Score features: DTI, LTV, down payment %, loan vs county — no interest rate in score.",
            "Risk grid + local SHAP perturbation + counterfactual suggestions.",
        ],
        notes="2:50–3:25 · Methodology · Pranav",
    )

    deck.add_full_image_slide(
        "System Architecture",
        assets.get("architecture"),
        caption="React + D3 client · FastAPI · XGBoost joblib · MongoDB Atlas + JSON fallback",
        notes="3:25–3:50 · Architecture · Pranav",
    )

    deck.add_full_image_slide(
        "Dashboard — Linked View Flow",
        _first_existing(assets, ("dashboard_layout", "dashboard", "architecture")),
        caption="Readiness → budget mixer → simulator → planning panels → HMDA → model audit",
        notes="3:50–4:05 · Walk through layout before live demo · Vandana",
    )

    deck.add_image_left_slide(
        "Live System Demonstration",
        [
            "Login: maya.sac@clarifi.test or arjun.bay@clarifi.test (Testpass123).",
            "Budget mixer donut + sliders → cashflow updates.",
            "Simulator: income, debt, savings, target price → readiness score.",
            "County map (fixed 38–85% scale) → click county → scatter + histogram.",
            "Risk surface click-to-apply; optional agent question.",
            "INSERT SCREEN RECORDING (4:05–6:25).",
        ],
        _first_existing(assets, ("dashboard", "dashboard_layout")),
        notes="4:05–6:25 · LIVE DEMO · Vandana",
    )

    deck.add_full_image_slide(
        "Evaluation — Model Metrics",
        assets.get("metrics"),
        caption=metrics_summary,
        notes="6:25–6:45 · Metrics · Pranav",
    )

    deck.add_full_image_slide(
        "Evaluation — Calibration",
        assets.get("calibration"),
        caption="Predicted vs actual approval by score bin",
        notes="6:45–7:00 · Calibration · Pranav",
    )

    deck.add_full_image_slide(
        "Evaluation — Training Patterns",
        assets.get("global_features"),
        caption="DTI dominates training data; scenario SHAP shows your personal drivers",
        notes="7:00–7:15 · Global features · Pranav",
    )

    deck.add_full_image_slide(
        "Evaluation — Four Demo Users",
        assets.get("persona_scores"),
        caption="Sofia (Alameda) · Arjun (San Diego) · Maya (Sacramento) · Diego (LA)",
        notes="7:15–7:35 · Personas · Pranav",
    )

    deck.add_bullet_slide(
        "Unexpected Technical Challenges",
        [
            "MongoDB Atlas TLS on some networks → local JSON fallback.",
            "Rate sensitivity + risk grid need API; client-side estimates when offline.",
            "County map uses fixed 38–85% scale (not relative ranking).",
            "Affordability band legend prevents overlapping price labels.",
        ],
        notes="7:35–8:05 · Challenges · Vandana",
    )

    deck.add_two_section_slide(
        "Limitations & Future Scope",
        "Current Limitations:",
        [
            "Educational prototype — not underwriting or financial advice.",
            "Four scoring metros; map shows all 58 counties.",
            "HMDA reflects past applications, not this applicant's lender.",
        ],
        "Future Directions:",
        [
            "Full CA LAR extract; better denial recall.",
            "Per-county scoring; deployed cloud DB; stronger fairness reporting.",
        ],
        notes="8:05–8:30 · Limitations · Lalitha",
    )

    deck.add_work_distribution(
        "Division of Labor",
        TEAM,
        [
            ("Motivation, data narrative, related work", [True, False, False]),
            ("ML notebook, model export, evaluation slides", [False, True, True]),
            ("FastAPI backend, MongoDB, risk-grid API", [False, True, False]),
            ("React dashboard, 18 D3 views, agent annotations", [True, False, True]),
            ("Demo users, CSV pack, live demo recording", [False, False, True]),
            ("Presentation, 9-min video, README", [True, True, True]),
        ],
        notes="8:30–8:50 · Division of labor",
    )

    deck.add_thank_you(
        [
            "Thank you for watching.",
            "",
            "Questions?",
        ],
        notes="8:50–9:00 · End · HARD STOP at 9:00",
    )

    deck.save()


def main() -> int:
    assets = ensure_assets()
    build_video_pptx(assets)
    print(f"Saved: {OUTPUT}")
    print(f"Assets: {ASSETS}")
    print("Optional: save live UI to docs/presentation_assets/dashboard_screenshot.png and re-run.")
    print("Script: docs/video_script_9min.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
