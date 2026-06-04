from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "clarifi_system_architecture.png"

W, H = 3200, 2200

NAVY = "#07375f"
BLUE = "#2468b2"
TEAL = "#19cfd0"
GREEN = "#1a936f"
ORANGE = "#e8792e"
RED = "#d9485f"
PURPLE = "#6f5bd6"
INK = "#17202a"
MUTED = "#5f6b7a"
BG = "#f6f9fc"
CARD = "#ffffff"
LINE = "#7d8da1"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


F_TITLE = font(78, True)
F_SUB = font(36)
F_CARD = font(42, True)
F_BODY = font(30)
F_SMALL = font(25)
F_TAG = font(25, True)
F_MINI = font(23)


def rounded(draw: ImageDraw.ImageDraw, xy, radius: int, fill: str, outline: str, width: int = 4) -> None:
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def center(draw: ImageDraw.ImageDraw, xy, text: str, fnt, fill: str) -> None:
    x1, y1, x2, y2 = xy
    lines = text.split("\n")
    heights = [draw.textbbox((0, 0), line, font=fnt)[3] for line in lines]
    total = sum(heights) + 8 * (len(lines) - 1)
    y = y1 + (y2 - y1 - total) / 2
    for line, h in zip(lines, heights):
        bbox = draw.textbbox((0, 0), line, font=fnt)
        draw.text((x1 + (x2 - x1 - (bbox[2] - bbox[0])) / 2, y), line, font=fnt, fill=fill)
        y += h + 8


def wrap_pixels(draw: ImageDraw.ImageDraw, text: str, fnt, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = word if not current else f"{current} {word}"
        if draw.textlength(candidate, font=fnt) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
    if current:
        lines.append(current)
    return lines


def bullet_lines(draw: ImageDraw.ImageDraw, text: str, fnt, max_width: int) -> list[str]:
    lines: list[str] = []
    for part in text.split("\n"):
        if not part:
            lines.append("")
        else:
            lines.extend(wrap_pixels(draw, part, fnt, max_width))
    return lines


def arrow(draw: ImageDraw.ImageDraw, start, end, color=LINE, width=6) -> None:
    draw.line([start, end], fill=color, width=width)
    x1, y1 = start
    x2, y2 = end
    dx, dy = x2 - x1, y2 - y1
    length = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / length, dy / length
    px, py = -uy, ux
    head = 26
    draw.polygon(
        [
            (x2, y2),
            (x2 - ux * head + px * head * 0.46, y2 - uy * head + py * head * 0.46),
            (x2 - ux * head - px * head * 0.46, y2 - uy * head - py * head * 0.46),
        ],
        fill=color,
    )


def label_box(draw: ImageDraw.ImageDraw, center_xy, text: str, color: str = NAVY) -> None:
    cx, cy = center_xy
    bbox = draw.textbbox((0, 0), text, font=F_SMALL)
    w = bbox[2] - bbox[0] + 34
    h = 42
    draw.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=14, fill="#ffffff", outline="#dbe4ef", width=2)
    draw.text((cx, cy - 12), text, font=F_SMALL, fill=color, anchor="ma")


def icon_frontend(draw: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    draw.rounded_rectangle((x, y, x + 150, y + 100), radius=14, outline=color, width=8, fill="#f8fbff")
    draw.rectangle((x + 38, y + 106, x + 112, y + 124), fill=color)
    draw.line((x + 24, y + 130, x + 126, y + 130), fill=color, width=8)
    for i, h in enumerate([32, 54, 76]):
        draw.rectangle((x + 34 + i * 36, y + 78 - h, x + 56 + i * 36, y + 78), fill=color)


def icon_backend(draw: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    for i in range(3):
        yy = y + i * 48
        draw.rounded_rectangle((x, yy, x + 154, yy + 34), radius=10, fill=color, outline="#06243c", width=3)
        draw.ellipse((x + 18, yy + 10, x + 32, yy + 24), fill="#9ed6ff")
        draw.line((x + 52, yy + 17, x + 132, yy + 17), fill="#9ed6ff", width=4)


def icon_ml_analytics(draw: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    """Analytics icon: chart, model nodes, and prediction curve."""
    draw.rounded_rectangle((x, y, x + 158, y + 118), radius=16, outline=color, width=7, fill="#f8fffb")
    draw.line((x + 24, y + 88, x + 136, y + 88), fill=color, width=5)
    draw.line((x + 24, y + 88, x + 24, y + 22), fill=color, width=5)
    points = [(x + 34, y + 76), (x + 58, y + 58), (x + 82, y + 66), (x + 108, y + 38), (x + 132, y + 30)]
    draw.line(points, fill=color, width=6)
    for px, py in points:
        draw.ellipse((px - 7, py - 7, px + 7, py + 7), fill="#ffffff", outline=color, width=4)
    for px, py in [(x + 45, y + 128), (x + 79, y + 128), (x + 113, y + 128)]:
        draw.ellipse((px - 12, py - 12, px + 12, py + 12), fill=color)
    draw.line((x + 45, y + 128, x + 79, y + 128, x + 113, y + 128), fill=color, width=5)


def icon_ai(draw: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    draw.rounded_rectangle((x, y, x + 160, y + 100), radius=22, outline=color, width=8, fill="#fff9fb")
    draw.polygon([(x + 62, y + 100), (x + 80, y + 135), (x + 98, y + 100)], fill="#fff9fb", outline=color)
    for yy in [y + 28, y + 52, y + 76]:
        draw.line((x + 36, yy, x + 124, yy), fill=color, width=6)


def icon_data(draw: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    draw.ellipse((x, y, x + 160, y + 54), fill="#fffaf6", outline=color, width=7)
    draw.rectangle((x, y + 27, x + 160, y + 122), fill="#fffaf6", outline=color, width=7)
    draw.ellipse((x, y + 95, x + 160, y + 149), fill="#fffaf6", outline=color, width=7)
    draw.arc((x, y + 55, x + 160, y + 109), 0, 180, fill=color, width=5)


def card(draw: ImageDraw.ImageDraw, xy, title: str, subtitle: str, bullets: list[str], color: str, icon_fn) -> None:
    x1, y1, x2, y2 = xy
    rounded(draw, xy, 28, CARD, color, 5)
    draw.rounded_rectangle((x1, y1, x2, y1 + 92), radius=28, fill=color, outline=color)
    draw.rectangle((x1, y1 + 50, x2, y1 + 92), fill=color)
    center(draw, (x1 + 20, y1 + 8, x2 - 20, y1 + 82), title, F_CARD, "#ffffff")
    draw.text((x1 + 44, y1 + 116), subtitle, font=F_TAG, fill=color)
    icon_fn(draw, x1 + 44, y1 + 166, color)

    y = y1 + 342
    for item in bullets:
        for idx, line in enumerate(bullet_lines(draw, item, F_BODY, x2 - x1 - 96)):
            prefix = "- " if idx == 0 else "  "
            draw.text((x1 + 44, y), prefix + line, font=F_BODY, fill=INK)
            y += 44
        y += 8


def mini_store(draw: ImageDraw.ImageDraw, xy, title: str, body: str, color: str) -> None:
    x1, y1, x2, y2 = xy
    rounded(draw, xy, 20, "#ffffff", color, 4)
    draw.text((x1 + 24, y1 + 22), title, font=F_TAG, fill=color)
    max_width = x2 - x1 - 48
    for i, line in enumerate(wrap_pixels(draw, body, F_MINI, max_width)):
        draw.text((x1 + 24, y1 + 64 + i * 30), line, font=F_MINI, fill=INK)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # Soft background bands.
    draw.rounded_rectangle((80, 80, W - 80, H - 80), radius=54, fill="#ffffff", outline="#e0e8f2", width=4)
    draw.rectangle((80, 80, W - 80, 330), fill="#ffffff")

    draw.text((150, 130), "ClariFi System Architecture", font=F_TITLE, fill=INK)
    draw.text(
        (154, 230),
        "AI-guided mortgage readiness dashboard: linked visual analytics, calibrated scoring, user data, and explainable guidance",
        font=F_SUB,
        fill=MUTED,
    )

    entry = (150, 650, 550, 1060)
    frontend = (740, 500, 1240, 1240)
    backend = (1430, 500, 1930, 1240)
    ml = (2120, 500, 2620, 1240)
    ai = (1430, 1340, 1930, 1930)
    data = (2120, 1340, 2620, 1930)

    # User entry point.
    rounded(draw, entry, 28, CARD, NAVY, 5)
    center(draw, (entry[0] + 24, entry[1] + 28, entry[2] - 24, entry[1] + 96), "ENTRY POINT", F_CARD, NAVY)
    cx, cy = 350, 820
    draw.ellipse((cx - 74, cy - 54, cx - 24, cy - 4), fill=INK)
    draw.ellipse((cx - 18, cy - 72, cx + 48, cy - 6), fill=INK)
    draw.ellipse((cx + 56, cy - 54, cx + 106, cy - 4), fill=INK)
    draw.pieslice((cx - 105, cy - 10, cx - 5, cy + 78), 180, 360, fill=INK)
    draw.pieslice((cx - 42, cy - 25, cx + 82, cy + 92), 180, 360, fill=INK)
    draw.pieslice((cx + 28, cy - 10, cx + 128, cy + 78), 180, 360, fill=INK)
    center(draw, (entry[0] + 28, entry[1] + 260, entry[2] - 28, entry[3] - 30), "Landing\nLogin / Register\nDemo mode", F_BODY, INK)

    card(
        draw,
        frontend,
        "FRONTEND",
        "React 19 - TypeScript - Vite 6",
        [
            "D3.js v7 visual layer",
            "18 interactive D3 views",
            "Scenario sliders",
            "JWT auth, demo route, themes",
        ],
        BLUE,
        icon_frontend,
    )

    card(
        draw,
        backend,
        "BACKEND API",
        "FastAPI - Python - Uvicorn :8001",
        [
            "17 REST routes under /api",
            "Auth, profiles, transactions",
            "CSV upload and summaries",
            "Serves datasets and scores",
        ],
        NAVY,
        icon_backend,
    )

    card(
        draw,
        ml,
        "ML / ANALYTICS",
        "Calibrated XGBoost readiness model",
        [
            "joblib pipeline inference",
            "DTI x down-payment risk surface",
            "Local SHAP perturbations",
            "Counterfactual suggestions",
            "AUC 0.804 - Brier 0.063",
        ],
        GREEN,
        icon_ml_analytics,
    )

    card(
        draw,
        ai,
        "AI EXPLAINER",
        "Answers + chart annotations",
        [
            "OpenRouter API",
            "OPENROUTER_MODEL=\nnvidia/nemotron-3-nano-\n30b-a3b:free",
            "Rule-based offline templates",
        ],
        RED,
        icon_ai,
    )

    card(
        draw,
        data,
        "DATA LAYER",
        "Persistence + datasets",
        [
            "MongoDB Atlas-ready store",
            "Local JSON fallback",
            "HMDA + BLS + model reports",
        ],
        ORANGE,
        icon_data,
    )

    # External artifacts.
    mini_store(draw, (2745, 1370, 3130, 1515), "Model Artifacts", "XGBoost joblib, inference config, SHAP outputs", GREEN)
    mini_store(draw, (2745, 1580, 3130, 1725), "Static JSON", "HMDA processed data, BLS benchmarks, model report", BLUE)
    mini_store(draw, (2745, 1790, 3130, 1935), "User Store", "Users, tokens, transactions, saved scenarios", ORANGE)

    # Main flow arrows.
    arrow(draw, (550, 840), (740, 840))
    label_box(draw, (645, 790), "open app")

    arrow(draw, (1240, 790), (1430, 790))
    label_box(draw, (1335, 735), "/api/* HTTP/JSON")
    arrow(draw, (1430, 910), (1240, 910), color="#8cb7d6")
    label_box(draw, (1335, 965), "JSON responses")

    arrow(draw, (1930, 790), (2120, 790))
    label_box(draw, (2025, 735), "score scenario")

    arrow(draw, (2120, 910), (1930, 910), color="#8cc2a9")
    label_box(draw, (2025, 965), "probability + drivers")

    arrow(draw, (1680, 1240), (1680, 1340))
    label_box(draw, (1785, 1290), "question + score")
    arrow(draw, (1930, 1445), (2120, 1135), color="#9da9bc")
    label_box(draw, (2062, 1280), "chart annotation")

    arrow(draw, (2120, 1635), (1930, 1635), color="#9da9bc")
    label_box(draw, (2025, 1580), "load / save")
    arrow(draw, (2620, 1438), (2745, 1438), color=GREEN)
    arrow(draw, (2620, 1648), (2745, 1648), color=BLUE)
    arrow(draw, (2620, 1858), (2745, 1858), color=ORANGE)

    img.save(OUT, quality=96)
    print(OUT)


if __name__ == "__main__":
    main()
