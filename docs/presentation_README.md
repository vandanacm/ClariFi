# ClariFi presentation files

## Regenerate everything (charts + decks)

```bash
.venv/bin/python scripts/build_presentation.py      # charts + ClariFi_Presentation.pptx
.venv/bin/python scripts/build_video_presentation.py  # charts + ClariFi_Video_Presentation.pptx
# or from repo root after npm install:
npm run build:presentation
npm run build:video-presentation
```

Charts render at **300 DPI** for clear projection. Persona table uses **live XGBoost scores** from `user_profiles_seed.csv` (Arjun → San Diego).

## Chart images (`docs/presentation_assets/`)

| File | Content |
|------|---------|
| `metrics_plot.png` | Test AUC, balanced accuracy, Brier, denial recall |
| `calibration_plot.png` | Predicted vs actual approval (9 bins) |
| `global_features.png` | Training-data feature weights (DTI dominates) |
| `persona_comparison.png` | Four demo users + readiness scores + DTI/LTV |
| `county_approval.png` | CA counties — **fixed 38–85% color scale** |
| `dashboard_layout.png` | Dashboard section flow (budget-first UX) |
| `architecture.png` | React + FastAPI + XGBoost + MongoDB |
| `training_scope.png` | HMDA filters & row counts |
| `dashboard_screenshot.png` | *(optional)* paste your own live UI capture |

## Video deck (9 minutes)

**File:** `docs/ClariFi_Video_Presentation.pptx` (~16 slides)  
**Script:** `docs/video_script_9min.md`

Slides include: intro (18 D3 views), architecture, **dashboard layout**, live demo checklist, metrics, calibration, **training patterns**, four personas (Sofia/Arjun San Diego/Maya/Diego), challenges, limitations, division of labor.

**Optional:** Save a browser screenshot as `docs/presentation_assets/dashboard_screenshot.png` and re-run `build:video-presentation` — it appears on the live-demo slide.

## Full project deck

**File:** `docs/ClariFi_Presentation.pptx`

## Template note

Uses `College of Engineering PPT Template - Clean.pptx` when present; otherwise rebuilds from the existing video deck template in `docs/`.
