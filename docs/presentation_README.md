# ClariFi presentation files

## Style guide

Slides use **`College of Engineering PPT Template - Clean.pptx`** (UC Davis Engineering), matching the ECS 273 FinSight-style deck:

- Dark blue section title bar (template master)
- Bullet slides for Evaluation, Technical Challenges, Limitations, Distribution of Work
- Image + bullets for Visualisations
- **Footer on every slide (bottom right):** `ECS 273 Spring Quarter 2026`

```bash
npm run build:presentation
npm run build:video-presentation
```

**Before presenting:**

1. Edit `[Name 1]`, `[Name 2]`, `[Name 3]` on title, distribution table, thank-you slides
2. Add **`docs/presentation_assets/dashboard_screenshot.png`** (run app, capture full dashboard) for best Visualisations slide
3. Adjust Distribution of Work checkmarks to match your team

## PowerPoint (ready to present)

**Open:** `docs/ClariFi_Presentation.pptx` (~18 slides, full project coverage)

11 slides including:
- Title, problem, architecture, model scope
- Four personas + **live scores from your trained model**
- Metrics chart, calibration plot, county approval chart
- Demo checklist + limitations

## Chart images (editable)

Folder: `docs/presentation_assets/`

| File | Content |
|------|---------|
| `calibration_plot.png` | Predicted vs actual approval (9 bins) |
| `metrics_plot.png` | AUC, balanced accuracy, Brier, denial recall |
| `persona_scores.png` | Sofia / Arjun / Maya / Diego readiness % |
| `county_approval.png` | Sample CA counties by HMDA approval rate |
| `architecture.png` | System diagram |
| `training_scope.png` | Data filters & row counts |

## Regenerate after model changes

```bash
npm run build:presentation
```

Requires: `public/data/model_report.json`, `hmda_2025_xgboost_shap_report.json`, joblib artifact.

## Add live UI screenshots (optional)

1. Run `npm run dev:full`
2. Capture 2–3 screenshots (dashboard overview, county map, histogram)
3. Insert into slides 10–11 in PowerPoint

Speaker script: `docs/presentation_9min_google_slides.md`

## 9-minute video (rubric-aligned)

**Open:** `docs/ClariFi_Video_Presentation.pptx` (~16 slides, engineering template + speaker notes)

**Script:** `docs/video_script_rubric.md` — timing, rubric points, demo checklist, presenter split

```bash
npm run build:video-presentation
```

Regenerates the video deck and refreshes chart assets via `build_presentation.py`. Edit slide 10 (division of labor) before recording.
