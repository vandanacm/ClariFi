#!/usr/bin/env python3
"""Build ECS 273 video presentation (engineering template + rubric coverage)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT_ROOT / "docs" / "presentation_assets"
OUTPUT = PROJECT_ROOT / "docs" / "ClariFi_Video_Presentation.pptx"


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
    }


def _dash(assets: dict[str, Path]) -> Path | None:
    for k in ("dashboard", "architecture"):
        p = assets.get(k)
        if p and p.exists():
            return p
    return None


def build_video_pptx(assets: dict[str, Path]) -> None:
    sys.path.insert(0, str(PROJECT_ROOT))
    from scripts.engineer_deck import EngineerDeck

    members = ["[Name A]", "[Name B]", "[Name C]"]
    deck = EngineerDeck()
    deck.create(OUTPUT)

    deck.add_cover(
        "ClariFi",
        "California Mortgage Readiness Dashboard\n"
        "ECS 273 Final Video · 9 minutes\n"
        "[Name 1] · [Name 2] · [Name 3]",
        notes="Introduce team and problem · 30 sec",
    )

    deck.add_bullet_slide(
        "Outline",
        [
            "Motivation, data, related work",
            "Live demonstration",
            "Design, methodology, challenges",
            "Evaluation and results",
            "Limitations and division of labor",
        ],
        notes="Rubric map in speaker notes per slide",
    )

    deck.add_bullet_slide(
        "Motivation, Data & Related Work",
        [
            "Problem: credit scores miss regional HMDA approval context.",
            "Dataset: HMDA 2025 CA · ~58k purchase loans.",
            "Novelty: calibrated ML + linked D3 on real HMDA data.",
            "Challenges: class imbalance, leakage control, Mongo/API sync.",
        ],
        notes="Rubric 1 pt · 90 sec",
    )

    deck.add_image_left_slide(
        "Live System Demonstration",
        [
            "Login and upload transaction CSV.",
            "Adjust sliders → readiness score updates.",
            "County map → linked scatter and histogram.",
            "Switch target market (four CA metros).",
            "Record screen here; plan B: saved video or screenshots.",
        ],
        _dash(assets),
        notes="Rubric 2 pts · 2 min 30 sec · npm run dev:full",
    )

    deck.add_full_image_slide(
        "Design & System Architecture",
        assets.get("architecture"),
        notes="Rubric 2 pts design (1/2) · 60 sec",
    )

    deck.add_bullet_slide(
        "Methodology & Implementation",
        [
            "Train / calibration / test split on filtered HMDA.",
            "Isotonic calibration; no HMDA interest rate in score.",
            "Affordability: income, loan amount, DTI, LTV + county context.",
            "scenario_inference_config.json aligns sliders with training.",
        ],
        notes="Rubric 2 pts design (2/2) · 45 sec",
    )

    deck.add_bullet_slide(
        "Unexpected Technical Challenges",
        [
            "MongoDB Atlas TLS on some networks.",
            "Missing calibration in model export → API merge fix.",
            "sklearn version warnings loading Colab joblib.",
            "Map metric: county approval rate for 58 counties.",
        ],
        notes="Rubric 1 pt · 30 sec",
    )

    deck.add_bullet_slide(
        "Evaluation & Results",
        [
            "Test AUC ≈ 0.80 · Brier ≈ 0.06 · balanced accuracy ≈ 0.74",
            "Denial recall ≈ 0.66",
            "Calibration bins track actual approval rates.",
            "Four personas: same model, different market + affordability inputs.",
        ],
        notes="Rubric 2 pts · 75 sec total for eval slides",
    )

    deck.add_full_image_slide(
        "Evaluation — Model Metrics",
        assets.get("metrics"),
    )

    deck.add_full_image_slide(
        "Evaluation — Calibration",
        assets.get("calibration"),
    )

    deck.add_full_image_slide(
        "Evaluation — Four Demo Users",
        assets.get("persona_scores"),
        caption="Target market + income, debt, savings, price → DTI/LTV → readiness %",
    )

    deck.add_two_section_slide(
        "Limitations & Future Work",
        "Current Limitations:",
        [
            "Educational only — not underwriting advice.",
            "Four scoring metros; map shows 58 counties.",
        ],
        "Future Directions:",
        [
            "Full CA LAR, better denial recall, per-county scoring.",
            "Cloud deploy and stronger fairness reporting.",
        ],
        notes="Rubric 1 pt · 30 sec",
    )

    deck.add_work_distribution(
        "Division of Labor",
        members,
        [
            ("Motivation, data, related work (slides + script)", [True, False, False]),
            ("Live demo and evaluation slides", [False, True, False]),
            ("Architecture, methodology, limitations", [False, False, True]),
            ("ML notebook, model export, metrics", [False, True, True]),
            ("Frontend, D3, demo users", [True, False, True]),
            ("Video recording and editing", [True, True, True]),
        ],
        notes="Edit names and checkmarks before recording · Required",
    )

    deck.add_thank_you(["Thank you for watching.", "", "[team.email@ucdavis.edu]"])

    deck.save()


def main() -> int:
    assets = ensure_assets()
    build_video_pptx(assets)
    print(f"Saved: {OUTPUT}")
    print("Template: College of Engineering PPT Template - Clean.pptx")
    print("Footer on all slides: ECS 273 Spring Quarter 2026")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
