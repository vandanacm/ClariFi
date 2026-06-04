#!/usr/bin/env python3
"""Generate ClariFi presentation assets and PowerPoint deck."""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT_ROOT / "docs" / "presentation_assets"
OUTPUT_PPTX = PROJECT_ROOT / "docs" / "ClariFi_Presentation.pptx"
MODEL_REPORT = PROJECT_ROOT / "client" / "public" / "data" / "model_report.json"
SHAP_REPORT = PROJECT_ROOT / "client" / "public" / "data" / "model_outputs" / "hmda_2025_xgboost_shap_report.json"
HMDA_JSON = PROJECT_ROOT / "client" / "public" / "data" / "hmda_processed.json"
LOGO = PROJECT_ROOT / "client" / "public" / "logo.png"
PERSONAS_CSV = PROJECT_ROOT / "server" / "data" / "user_upload_pack" / "user_profiles_seed.csv"
CHART_DPI = 300

USER_FEATURE_LABELS = {
    "num__dti_numeric": "Debt-to-income (DTI)",
    "num__down_payment_rate_proxy": "Down payment %",
    "num__combined_loan_to_value_ratio": "Loan-to-value (LTV)",
    "num__loan_to_income": "Loan vs. income",
    "num__income_vs_county_median": "Income vs. county median",
    "num__loan_vs_county_median": "Loan size vs. county",
    "num__property_value": "Home price",
    "num__loan_term": "Loan term",
}

# Brand-ish colors (teal theme)
TEAL = "#007f7a"
TEAL_LIGHT = "#2dd4bf"
ROSE = "#e85d75"
GOLD = "#fbbf24"
INK = "#1a2332"
MUTED = "#64748b"
BG = "#f8fafb"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def setup_style() -> None:
    plt.rcParams.update(
        {
            "font.family": "sans-serif",
            "font.sans-serif": ["Helvetica Neue", "Arial", "DejaVu Sans"],
            "axes.facecolor": BG,
            "figure.facecolor": "white",
            "axes.edgecolor": MUTED,
            "axes.labelcolor": INK,
            "text.color": INK,
        }
    )


def save_calibration_plot(shap: dict, out: Path) -> None:
    rows = shap.get("calibration", [])
    if not rows:
        return
    pred = [r.get("predicted_rate", r.get("predictedRate", 0)) for r in rows]
    actual = [r.get("actual_rate", r.get("actualRate", 0)) for r in rows]
    fig, ax = plt.subplots(figsize=(7, 5.5))
    ax.plot([0.4, 1], [0.4, 1], "--", color=MUTED, linewidth=1.5, label="Perfect calibration")
    ax.scatter(pred, actual, s=120, c=GOLD, edgecolors=INK, linewidths=0.8, zorder=3, label="Score bins")
    for p, a, r in zip(pred, actual, rows):
        ax.annotate(
            f"n={r.get('applications', 0)}",
            (p, a),
            textcoords="offset points",
            xytext=(6, 4),
            fontsize=8,
            color=MUTED,
        )
    ax.set_xlim(0.45, 1.02)
    ax.set_ylim(0.45, 1.02)
    ax.set_xlabel("Predicted approval rate", fontsize=13, fontweight="600")
    ax.set_ylabel("Actual approval rate", fontsize=13, fontweight="600")
    ax.set_title("Calibration — hold-out HMDA applications", fontsize=15, fontweight="700", pad=12)
    ax.tick_params(labelsize=11)
    ax.legend(loc="lower right", framealpha=0.95)
    ax.grid(True, alpha=0.25)
    fig.tight_layout()
    fig.savefig(out, dpi=CHART_DPI, bbox_inches="tight")
    plt.close(fig)


def save_metrics_plot(report: dict, shap: dict, out: Path) -> None:
    metrics = report.get("metrics", {})
    baseline = shap.get("baseline_metrics", {})
    labels = ["Test AUC", "Balanced\naccuracy", "Brier score", "Denial recall"]
    model_vals = [
        metrics.get("testAuc", 0),
        metrics.get("balancedAccuracy", 0),
        metrics.get("brierScore", 0),
        metrics.get("denialRecall", 0),
    ]
    base_vals = [
        baseline.get("auc", 0),
        baseline.get("balanced_accuracy", 0),
        None,
        None,
    ]
    x = range(len(labels))
    width = 0.35
    fig, ax = plt.subplots(figsize=(8, 4.5))
    bars1 = ax.bar([i - width / 2 for i in x], model_vals, width, label="Calibrated XGBoost", color=TEAL)
    base_plot = [v if v is not None else 0 for v in base_vals]
    bars2 = ax.bar([i + width / 2 for i in x], base_plot, width, label="Logistic baseline (AUC/BA only)", color=MUTED, alpha=0.6)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Score (higher better except Brier)", fontsize=10)
    ax.set_title("Model performance summary", fontsize=13, fontweight="700")
    for bar, val in zip(bars1, model_vals):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.02, f"{val:.3f}", ha="center", fontsize=9)
    ax.legend(loc="upper right", fontsize=9)
    ax.text(0.02, 0.02, "Brier: lower is better · ~58k CA loans · test n≈11.6k", transform=ax.transAxes, fontsize=8, color=MUTED)
    fig.tight_layout()
    fig.savefig(out, dpi=CHART_DPI, bbox_inches="tight")
    plt.close(fig)


def load_demo_personas() -> list[dict]:
    """Demo users from user_upload_pack — single source of truth."""
    if not PERSONAS_CSV.exists():
        return []
    rows: list[dict] = []
    with PERSONAS_CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(
                {
                    "name": r["name"].split()[0],
                    "market": r["target_market"],
                    "income": float(r["monthly_income"]),
                    "debt": float(r["monthly_debt"]),
                    "savings": float(r["savings"]),
                    "price": float(r["target_price"]),
                    "persona": r.get("persona", ""),
                }
            )
    return rows


def _scenario_metrics(income: float, debt: float, savings: float, price: float) -> tuple[float, float]:
    loan = max(price - savings, 1)
    housing = loan * 0.0062
    dti_pct = (debt + housing) / max(income, 1) * 100
    ltv_pct = loan / max(price, 1) * 100
    return dti_pct, ltv_pct


def save_persona_comparison(out: Path) -> None:
    """Table of inputs (market, income, price, DTI, LTV) + readiness scores."""
    sys.path.insert(0, str(PROJECT_ROOT / "server"))
    from data_scheme import ScenarioInput
    from main import load_model_cache, model_score

    personas = load_demo_personas()
    if not personas or not load_model_cache():
        return

    scored: list[dict] = []
    for p in personas:
        s = model_score(
            ScenarioInput(
                market=p["market"],
                income=p["income"],
                debt=p["debt"],
                savings=p["savings"],
                price=p["price"],
            )
        )
        dti, ltv = _scenario_metrics(p["income"], p["debt"], p["savings"], p["price"])
        scored.append({**p, "score": s.get("score") or 0, "dti": dti, "ltv": ltv})

    fig = plt.figure(figsize=(12, 7.2), facecolor="white")
    gs = fig.add_gridspec(2, 1, height_ratios=[1.15, 0.85], hspace=0.42)
    ax_table = fig.add_subplot(gs[0])
    ax_table.axis("off")

    headers = [
        "User",
        "Target market\n(scoring region)",
        "Monthly\nincome",
        "Monthly\ndebt",
        "Savings",
        "Target\nprice",
        "DTI %",
        "LTV %",
        "Readiness\nscore",
    ]
    table_rows = []
    for p in scored:
        table_rows.append(
            [
                p["name"],
                p["market"],
                f"${p['income']:,.0f}",
                f"${p['debt']:,.0f}",
                f"${p['savings']:,.0f}",
                f"${p['price']:,.0f}",
                f"{p['dti']:.0f}%",
                f"{p['ltv']:.0f}%",
                f"{p['score']:.0f}",
            ]
        )

    table = ax_table.table(
        cellText=table_rows,
        colLabels=headers,
        loc="center",
        cellLoc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(11)
    table.scale(1, 1.65)
    for (row, col), cell in table.get_celld().items():
        if row == 0:
            cell.set_facecolor(TEAL)
            cell.set_text_props(color="white", fontweight="bold")
        elif row % 2 == 0:
            cell.set_facecolor(BG)
        cell.set_edgecolor(MUTED)

    ax_bar = fig.add_subplot(gs[1])
    labels = [f"{p['name']} · {p['market']}" for p in scored]
    scores = [p["score"] for p in scored]
    colors = [TEAL if sc >= 70 else GOLD if sc >= 50 else ROSE for sc in scores]
    bars = ax_bar.barh(labels, scores, color=colors, edgecolor=INK, linewidth=0.6, height=0.55)
    ax_bar.set_xlim(0, 100)
    ax_bar.set_xlabel("Readiness score (calibrated HMDA approval likelihood × 100)", fontsize=12, fontweight="600")
    for bar, sc in zip(bars, scores):
        ax_bar.text(
            min(sc + 2, 92),
            bar.get_y() + bar.get_height() / 2,
            f"{sc:.0f}%",
            va="center",
            fontsize=12,
            fontweight="700",
        )

    fig.suptitle(
        "Four demo users — same XGBoost model; different market + affordability inputs",
        fontsize=14,
        fontweight="700",
        y=0.98,
    )
    fig.text(
        0.5,
        0.02,
        "Score uses: target market (4 CA metros) + loan amount, income, DTI, LTV, and county context — not CSV transactions.",
        ha="center",
        fontsize=10,
        color=MUTED,
    )
    fig.savefig(out, dpi=CHART_DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def save_persona_scores(out: Path) -> None:
    """Alias: full comparison chart (replaces small bar-only chart)."""
    save_persona_comparison(out)


def save_county_approval_chart(hmda: dict, out: Path) -> None:
    counties = hmda.get("counties", {})
    items = [
        (name, data.get("approvalRate", 0), data.get("applications", 0))
        for name, data in counties.items()
        if data.get("applications", 0) >= 20
    ]
    items.sort(key=lambda x: x[1])
    # show 12 lowest + 12 highest for visual spread
    pick = items[:8] + items[-8:]
    names = [x[0] for x in pick]
    rates = [x[1] * 100 for x in pick]
    fig, ax = plt.subplots(figsize=(9, 5.5))
    norm = plt.Normalize(vmin=38, vmax=85)
    colors = [plt.cm.RdYlGn(norm(r)) for r in rates]
    ax.barh(names, rates, color=colors, edgecolor="white", linewidth=0.5)
    ax.set_xlabel("HMDA approval rate (%) — fixed color scale 38–85%", fontsize=10, fontweight="600")
    ax.set_title("California counties (≥20 applications in sample)", fontsize=12, fontweight="700")
    ax.set_xlim(0, 100)
    fig.tight_layout()
    fig.savefig(out, dpi=CHART_DPI, bbox_inches="tight")
    plt.close(fig)


def save_architecture_diagram(out: Path) -> None:
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 4)
    ax.axis("off")

    boxes = [
        (0.3, 1.2, 2.4, 1.6, "React + D3\nDashboard", TEAL_LIGHT),
        (3.2, 1.2, 2.2, 1.6, "FastAPI\nBackend", TEAL),
        (5.8, 1.2, 2.0, 1.6, "XGBoost\n(calibrated)", TEAL),
        (8.1, 1.2, 1.6, 1.6, "MongoDB\nuser store", MUTED),
    ]
    for x, y, w, h, text, color in boxes:
        rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05", facecolor=color, edgecolor=INK, alpha=0.85)
        ax.add_patch(rect)
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=10, fontweight="700", color="white")

    for x1, x2 in [(2.7, 3.2), (5.4, 5.8), (7.8, 8.1)]:
        ax.annotate("", xy=(x2, 2), xytext=(x1, 2), arrowprops=dict(arrowstyle="->", color=INK, lw=2))

    ax.text(5, 3.5, "Static: hmda_processed.json · model_report.json · joblib", ha="center", fontsize=9, color=MUTED)
    ax.set_title("ClariFi system architecture", fontsize=14, fontweight="700", pad=8)
    fig.tight_layout()
    fig.savefig(out, dpi=CHART_DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def save_training_scope(shap: dict, out: Path) -> None:
    eda = shap.get("eda_summary", {})
    rows = shap.get("metrics", {})
    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.axis("off")
    lines = [
        "HMDA 2025 · California · Home purchase · Owner-occupied · First lien",
        f"Training rows: {rows.get('train_rows', '—'):,}  |  Test rows: {rows.get('test_rows', '—'):,}",
        f"Approval rate in sample: {eda.get('approval_rate', 0)*100:.1f}%  |  Counties: {eda.get('counties', 58)}",
        "Excluded from score: interest_rate · race · sex · age (fairness audit only)",
    ]
    text = "\n".join(lines)
    ax.text(
        0.5, 0.5, text, ha="center", va="center", fontsize=12,
        bbox=dict(boxstyle="round", facecolor=BG, edgecolor=TEAL, linewidth=2),
    )
    fig.savefig(out, dpi=CHART_DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def save_global_features_plot(report: dict, out: Path) -> None:
    features = [
        f for f in (report.get("features") or [])
        if f.get("feature") in USER_FEATURE_LABELS
    ]
    features.sort(key=lambda x: x.get("magnitude", 0), reverse=True)
    features = features[:6]
    if not features:
        return
    labels = [USER_FEATURE_LABELS[f["feature"]] for f in features]
    mags = [f.get("magnitude", 0) * 100 for f in features]
    fig, ax = plt.subplots(figsize=(9, 4.8))
    y = range(len(labels))
    bars = ax.barh(list(y), mags, color=TEAL, edgecolor=INK, linewidth=0.5, height=0.62)
    ax.set_yticks(list(y))
    ax.set_yticklabels(labels, fontsize=11)
    ax.invert_yaxis()
    ax.set_xlabel("Relative importance (% of global SHAP magnitude)", fontsize=11, fontweight="600")
    ax.set_title("What HMDA training data emphasized (~58k CA loans)", fontsize=13, fontweight="700", pad=10)
    for bar, val in zip(bars, mags):
        ax.text(bar.get_width() + 1.5, bar.get_y() + bar.get_height() / 2, f"{val:.0f}%", va="center", fontsize=11, fontweight="700")
    ax.set_xlim(0, max(mags) * 1.18)
    ax.text(0.02, 0.02, "DTI dominates · per-user drivers shown in scenario SHAP panel", transform=ax.transAxes, fontsize=9, color=MUTED)
    fig.tight_layout()
    fig.savefig(out, dpi=CHART_DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def save_dashboard_layout_overview(out: Path) -> None:
    """Schematic of current dashboard flow (for deck when no browser screenshot)."""
    fig, ax = plt.subplots(figsize=(11, 7.5))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 8)
    ax.axis("off")

    sections = [
        (0.4, 6.9, 10.2, 0.75, "1 - Readiness score + DTI / approval metrics", TEAL),
        (0.4, 5.85, 10.2, 0.85, "2 - Budget mixer (donut + sliders) then cashflow", TEAL_LIGHT),
        (0.4, 4.75, 4.9, 0.85, "3 - What-if simulator", TEAL),
        (5.5, 4.75, 4.7, 0.85, "4 - BLS peer benchmarks", MUTED),
        (0.4, 3.55, 10.2, 1.05, "5 - Readiness planning (8 panels)", TEAL_LIGHT),
        (0.4, 2.25, 10.2, 1.05, "6 - HMDA map, scatter, histogram (linked)", TEAL),
        (0.4, 0.95, 10.2, 1.05, "7 - Model audit (risk surface + scenario SHAP)", TEAL),
    ]
    for x, y, w, h, text, color in sections:
        rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.04", facecolor=color, edgecolor=INK, alpha=0.88)
        ax.add_patch(rect)
        ax.text(x + 0.15, y + h / 2, text, ha="left", va="center", fontsize=10, fontweight="700", color="white")

    ax.annotate("", xy=(5.5, 5.2), xytext=(5.2, 6.5), arrowprops=dict(arrowstyle="->", color=INK, lw=1.8))
    ax.annotate("", xy=(5.5, 4.0), xytext=(5.2, 5.0), arrowprops=dict(arrowstyle="->", color=INK, lw=1.8))
    ax.set_title("ClariFi dashboard — linked view order (June 2026)", fontsize=15, fontweight="700", pad=12)
    fig.savefig(out, dpi=CHART_DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def _dashboard_image(asset_paths: dict[str, Path]) -> Path | None:
    for key in ("dashboard", "dashboard_layout", "architecture"):
        p = asset_paths.get(key)
        if p and p.exists():
            return p
    return asset_paths.get("architecture")


def build_pptx(asset_paths: dict[str, Path]) -> None:
    sys.path.insert(0, str(PROJECT_ROOT))
    from scripts.engineer_deck import EngineerDeck

    members = ["[Name 1]", "[Name 2]", "[Name 3]"]
    deck = EngineerDeck()
    deck.create(OUTPUT_PPTX)

    deck.add_cover(
        "ClariFi",
        "California Mortgage Readiness Dashboard\n"
        "[Name 1] · [Name 2] · [Name 3]\n"
        "ECS 273 · Visual Analytics",
    )

    deck.add_bullet_slide(
        "Outline",
        [
            "Problem statement & motivation",
            "System architecture & methodology",
            "Visualisations (dashboard & analytics)",
            "Evaluation & results",
            "Technical challenges & demo",
            "Limitations, future work & team roles",
        ],
    )

    deck.add_bullet_slide(
        "Problem Statement & Motivation",
        [
            "Credit scores and listing prices miss regional HMDA approval context.",
            "Households need income, debt, savings, and target price in one view.",
            "ClariFi links personal cashflow to calibrated approval likelihood.",
            "Educational exploration — not lending or underwriting advice.",
        ],
    )

    deck.add_bullet_slide(
        "Dataset & Related Work",
        [
            "HMDA 2025 Modified LAR — California home-purchase applications (~58k rows).",
            "Target: approved vs denied; features exclude interest rate (leakage) and demographics from score.",
            "Unlike generic affordability calculators, we combine calibrated ML + linked D3 on real HMDA.",
            "58 counties on map; four metro regions for model scoring (Sacramento, Alameda, San Diego, LA).",
        ],
    )

    deck.add_full_image_slide(
        "System Architecture",
        asset_paths.get("architecture"),
        caption="ClariFi system architecture — React + D3, FastAPI, XGBoost, MongoDB",
    )

    deck.add_bullet_slide(
        "Methodology & Model Training",
        [
            "Filtered HMDA: CA, owner-occupied, first-lien purchase loans.",
            "XGBoost + isotonic calibration; threshold tuned for balanced accuracy.",
            "Affordability inputs: monthly income, loan amount, debt-to-income (DTI), loan-to-value (LTV).",
            "scenario_inference_config.json keeps slider scenarios aligned with training features.",
        ],
    )

    deck.add_image_left_slide(
        "Visualisations",
        [
            "Mortgage Readiness Dashboard — scenario sliders and readiness score.",
            "Upload bank CSV to ground cashflow; charts update from HMDA + model.",
            "County choropleth links scatter plot and income histogram.",
            "Calibration chart and risk surface (DTI vs down payment).",
            "Insert live screenshot: npm run dev:full → capture dashboard.",
        ],
        _dashboard_image(asset_paths),
    )

    deck.add_image_left_slide(
        "Visualisations — County & Linked Views",
        [
            "Choropleth shows HMDA approval rate for all 58 California counties.",
            "Click a county to filter scatter (income vs loan) and histogram.",
            "Brush on income distribution; target market dropdown (4 metros).",
        ],
        asset_paths.get("counties"),
    )

    deck.add_full_image_slide(
        "Visualisations — Calibration",
        asset_paths.get("calibration"),
        caption="Predicted vs actual approval by score bin — near diagonal = well calibrated",
    )

    deck.add_full_image_slide(
        "Visualisations — Four Demo Users",
        asset_paths.get("persona_scores"),
        caption="Same model; different target market + income, debt, savings, price → DTI/LTV → score",
    )

    deck.add_bullet_slide(
        "Evaluation & Results",
        [
            "Model performance:",
            "  · Test AUC ≈ 0.80 (logistic baseline ≈ 0.73)",
            "  · Brier score ≈ 0.06 after calibration",
            "  · Balanced accuracy ≈ 0.74 at threshold 0.90",
            "  · Denial recall ≈ 0.66 (room to improve on rare denials)",
            "Personas: Sofia (Alameda), Arjun (San Diego), Maya (Sacramento), Diego (LA) — scores reflect inputs.",
        ],
    )

    deck.add_full_image_slide(
        "Evaluation — Model Metrics",
        asset_paths.get("metrics"),
        caption="Calibrated XGBoost vs logistic baseline on hold-out test set",
    )

    deck.add_bullet_slide(
        "Technical Challenges",
        [
            "Synchronizing Colab-trained joblib with FastAPI feature column order.",
            "MongoDB Atlas TLS on local networks — check script and fallback policy.",
            "New model export dropped calibration array — merged from SHAP report in API.",
            "Class imbalance (~90% approvals) and designing visuals for non-expert users.",
        ],
    )

    deck.add_bullet_slide(
        "Live Demo",
        [
            "Register demo users from data/user_upload_pack/user_profiles_seed.csv",
            "Login → upload CSV → adjust income, debt, savings, price sliders",
            "Observe readiness score, map, scatter, histogram, calibration",
            "Plan B: screen recording or screenshots if live API fails",
        ],
    )

    deck.add_two_section_slide(
        "Limitations & Future Scope",
        "Current Limitations:",
        [
            "Exploratory readiness — not a lender decision.",
            "Scoring uses four metro buckets; map shows all counties.",
            "HMDA reflects past applications, not this applicant's bank.",
        ],
        "Future Directions:",
        [
            "Full California LAR and better denial recall.",
            "Per-county scoring and deployed cloud database.",
            "Stronger fairness reporting and mobile-friendly views.",
        ],
    )

    deck.add_work_distribution(
        "Distribution of Work",
        members,
        [
            ("Idea, proposal, architecture", [True, True, True]),
            ("HMDA processing & ML notebook", [False, True, True]),
            ("FastAPI backend & MongoDB", [False, False, True]),
            ("React dashboard & D3 visualisations", [True, False, True]),
            ("Scenario config, model export, API scoring", [False, True, True]),
            ("Demo users, testing, integration", [True, True, True]),
            ("Presentation, video, report", [True, True, True]),
        ],
    )

    deck.add_thank_you(
        [
            "Questions?",
            "",
            "[team.email@ucdavis.edu]",
        ],
    )

    deck.save()


def main() -> int:
    setup_style()
    ASSETS.mkdir(parents=True, exist_ok=True)

    report = load_json(MODEL_REPORT) if MODEL_REPORT.exists() else {}
    shap = load_json(SHAP_REPORT) if SHAP_REPORT.exists() else {}
    hmda = load_json(HMDA_JSON) if HMDA_JSON.exists() else {}

    paths = {
        "calibration": ASSETS / "calibration_plot.png",
        "metrics": ASSETS / "metrics_plot.png",
        "persona_scores": ASSETS / "persona_comparison.png",
        "counties": ASSETS / "county_approval.png",
        "architecture": ASSETS / "architecture.png",
        "training_scope": ASSETS / "training_scope.png",
        "dashboard": ASSETS / "dashboard_screenshot.png",
        "dashboard_layout": ASSETS / "dashboard_layout.png",
        "global_features": ASSETS / "global_features.png",
    }

    print("Generating charts...")
    if shap:
        save_calibration_plot(shap, paths["calibration"])
        save_metrics_plot(report, shap, paths["metrics"])
        save_training_scope(shap, paths["training_scope"])
    if report:
        save_global_features_plot(report, paths["global_features"])
    save_architecture_diagram(paths["architecture"])
    save_dashboard_layout_overview(paths["dashboard_layout"])
    if hmda:
        save_county_approval_chart(hmda, paths["counties"])
    try:
        save_persona_comparison(paths["persona_scores"])
    except Exception as exc:
        print("Persona comparison chart skipped:", exc)

    print("Building PowerPoint...")
    build_pptx(paths)
    print(f"Saved: {OUTPUT_PPTX}")
    print(f"Assets: {ASSETS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
