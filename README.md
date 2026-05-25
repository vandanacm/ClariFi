# ClariFi

AI-guided mortgage readiness and personal finance visual analytics for California homebuyers. Users enter income, debts, savings, and a target property price; ClariFi scores their readiness with a calibrated ML model, benchmarks them against HMDA applicant cohorts, and an LLM agent explains the tradeoffs in plain language.

---

## System Architecture

```
┌─────────────────────────┐    /api/*  (HTTP/JSON)    ┌─────────────────────────┐    joblib / HTTP    ┌─────────────────────────┐
│       FRONTEND          │ ─────────────────────────► │        BACKEND          │ ──────────────────► │       ML / AI           │
│                         │                            │                         │                      │                         │
│  React · TypeScript     │                            │  FastAPI · Python       │                      │  XGBoost + LLM          │
│  D3.js · Vite 6         │                            │  Uvicorn · port 8001    │                      │  300 trees · depth 5    │
│  8 interactive charts   │                            │  13 REST endpoints      │                      │  Isotonic calibration   │
│  Dark / light theme     │ ◄─────────── JSON ──────── │  JWT + JSON store       │ ◄─ scores+explain ── │  Ollama mistral (local) │
│  JWT auth flow          │                            │  XGBoost inference      │                      │  SHAP approximations    │
└─────────────────────────┘                            └─────────────────────────┘                      └─────────────────────────┘
     8 charts · 4 interactive                             13 endpoints · <50 ms                           AUC 0.806 · Brier 0.063
```

---

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, D3.js (SVG), Vite 6 |
| Backend | FastAPI, Uvicorn, Python 3, port 8001 |
| ML Model | XGBoost + isotonic `CalibratedClassifierCV` (scikit-learn) |
| LLM Agent | Ollama `mistral` (local) → Anthropic SDK → rule-based fallback |
| Data store | Local JSON (`public/data/local_store.json`) |

---

## Getting Started

```bash
# Install dependencies
npm install
python3 -m pip install -r api/requirements.txt

# Train the model (first time only)
python3 scripts/train_xgboost_model.py

# Run frontend + backend together
npm run dev:full
```

Open **http://127.0.0.1:5173**

For the Ollama LLM agent, run `ollama run mistral` in a separate terminal.

---

## Features

### 8 Interactive Charts

| Chart | Description | Interaction |
|---|---|---|
| `CashflowChart` | Waterfall: income → expenses → surplus | Hover pop-out with glow/dim |
| `IncomeHistogram` | Income vs. HMDA cohort distribution | Crosshair + income pill label |
| `ChoroplethMap` | California county readiness map | Smooth gradient legend, county tooltips |
| `RiskSurface` | DTI × down payment approval heatmap | Pulsing "You" marker |
| `BenchmarkBars` | Income vs. BLS occupation benchmarks | Static |
| `ExpenseDonut` | Spending breakdown | Static |
| `HmdaScatter` | Loan amount vs. income (HMDA) | Static |
| `CalibrationChart` | Model predicted vs. actual approval rate | Static |

### Backend API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness check; reports model + Ollama status |
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Returns JWT |
| `GET /api/me` | Current user from token |
| `GET /api/profile` / `PUT /api/profile` | Persistent profile store |
| `POST /api/transactions/upload` | CSV ingestion → category totals |
| `GET /api/finance/summary` | Aggregated spending summary |
| `GET /api/benchmarks` | BLS occupation income benchmarks |
| `GET /api/hmda` | Processed HMDA California loan data |
| `GET /api/model` | Model report (AUC, calibration, feature importance) |
| `POST /api/mortgage/score` | Score a scenario with XGBoost + SHAP drivers |
| `POST /api/scenarios` / `GET /api/scenarios` | Save / list scenarios |
| `POST /api/agent/explain` | LLM explanation of readiness tradeoffs |

---

## ML Model

- **Type:** XGBoost (300 estimators, depth 5, lr 0.05) wrapped in isotonic `CalibratedClassifierCV`
- **Training data:** 58,000 synthetic HMDA-shaped California rows (4 counties)
- **Features:** 21 numeric (DTI, LTV, log-income, county-relative metrics, risk flags) + 2 categorical
- **Test AUC:** 0.806 (raw XGBoost) / 0.719 (calibrated)
- **Brier score:** 0.063 (calibrated)
- **Artifact:** `public/data/model_outputs/hmda_2025_xgboost_calibrated_pipeline.joblib` (gitignored — run training script to generate)

---

## Authentication

ClariFi supports optional user accounts. Without logging in the app runs in demo mode under a shared profile. Register or sign in to persist your own transactions, scenarios, and financial profile.

Tokens are stored in `localStorage` under `clarifi_token`. For production use `httpOnly` secure cookies with rate limiting and email verification.

---

## Project Report

`team07progress.pdf` — Team 07 progress report (May 2026).
