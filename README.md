# ClariFi

ClariFi is an AI-guided personal finance and mortgage readiness analytics system for U.S. households. It helps users understand how income, savings, expenses, and debt translate into financial resilience and home-buying readiness, then compares that profile against BLS-style household spending benchmarks and HMDA-style mortgage applicant patterns.

## Authentication

ClariFi supports optional user accounts. Without logging in, the app runs in demo mode under a shared "Demo Household" profile. Registering or logging in gives each user their own persisted transactions, scenarios, and agent messages.

### Sign up

1. Click the sign-in icon in the bottom-left profile strip, or the **Sign in / Register** button at the bottom of the dashboard.
2. Switch to the **Create account** tab, enter an email, name, and password (min 6 characters), and submit.
3. The app stores the returned JWT in `localStorage` under the key `clarifi_token` and immediately shows your name in the sidebar.

### Sign in

1. Open the same modal and use the **Sign in** tab.
2. Enter your email and password. On success the token is stored and your data loads automatically.

### Sign out

Click the sign-out icon next to your name in the sidebar profile strip, or the **Sign out** button at the bottom of the dashboard. This removes the token from `localStorage` and returns to demo mode.

### Where tokens are stored

Tokens are stored in `localStorage` (`clarifi_token`). For production deployments prefer `httpOnly` secure cookies and add rate limiting, password reset, and email verification.

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account → returns `{ token, user }` |
| POST | `/api/auth/login` | Sign in → returns `{ token, user }` |
| GET | `/api/me` | Returns current user (requires `Authorization: Bearer <token>`) |

## Current Prototype

The current version is a full-stack visual analytics prototype with:

- React + TypeScript + Vite frontend
- D3 cashflow, HMDA scatter, benchmark, and calibration charts
- FastAPI backend for auth, profile, transactions, benchmarks, HMDA, model metadata, scenarios, and agent explanations
- JSON-backed local demo store with a MongoDB-ready API shape
- Calibrated HMDA XGBoost model report from the executed notebook
- BLS-style peer benchmark comparison
- Mortgage readiness score
- What-if simulator
- Budget mixer and cashflow waterfall
- Linked borrower comparison scatterplot
- County-level affordability heatmap
- Model explanation panel

## How ClariFi Differs

ClariFi adapts AI finance analyzer projects to the U.S. personal finance market. Unlike generic CSV analyzers or chatbot-first finance assistants, ClariFi combines user transaction analysis with BLS Consumer Expenditure Survey benchmarks, ML-driven insight detection, and linked visual dashboards.

The AI agent does not simply give advice. It guides visual exploration by highlighting anomalies, peer comparisons, forecasts, and scenario changes.

## Agent Architecture

- Profile Agent: reads user profile, goals, household type, and region.
- Data Agent: cleans transaction data and maps categories to BLS-style expense groups.
- Insight Agent: detects anomalies, spending shifts, recurring expenses, and forecast risk.
- Benchmark Agent: compares the user to similar U.S. households using BLS Consumer Expenditure Survey data.
- Explainer Agent: answers questions and highlights the relevant dashboard views.

This makes ClariFi feel similar to AI finance analyzer examples, but stronger for a visual analytics course because the agents are connected to data cleaning, benchmarks, ML insights, and interactive dashboard guidance.

## Core Datasets

### BLS Consumer Expenditure Survey

Purpose: personal finance benchmarking. Use it to compare a user's spending to similar U.S. households.

Example comparisons:

- Food spending vs. households in the same income range
- Housing cost share vs. regional average
- Transportation spending vs. peer group
- Savings gap compared to household benchmarks

### HMDA Mortgage Data

Purpose: mortgage readiness and approval-pattern comparison. Use it to compare the user to real mortgage applicants.

Example comparisons:

- Income vs. approved borrowers
- Loan amount vs. county patterns
- Approval likelihood by county/MSA
- DTI and loan-to-value style risk factors

Run it locally:

```bash
npm install
python3 -m pip install -r api/requirements.txt
npm run dev:api
npm run dev
```

Then open:

```text
http://127.0.0.1:5173
```

## Backend API

The main backend is now FastAPI:

- `GET /api/health` checks backend status
- `POST /api/auth/register` creates a user
- `POST /api/auth/login` returns a bearer token
- `GET /api/me` returns the active user
- `GET /api/profile` and `PUT /api/profile` read/update the household profile
- `POST /api/transactions/upload` imports a transaction CSV
- `GET /api/transactions` returns transactions and summary stats
- `GET /api/finance/summary` returns spending/cashflow aggregates
- `GET /api/benchmarks` returns BLS-style peer benchmark data
- `GET /api/hmda` returns processed HMDA-style comparison data
- `GET /api/model` returns calibrated model metadata
- `POST /api/mortgage/score` scores a mortgage readiness scenario
- `POST /api/scenarios` saves a scenario result
- `GET /api/scenarios` lists saved scenario results
- `POST /api/agent/explain` returns an explanation for the current scenario

The older dependency-free `server.mjs` is still kept as `npm run legacy:server`, but the course-ready stack should use FastAPI + Vite.

For the next MongoDB + ML service buildout, see [Backend + ML Integration Plan](docs/backend_ml_integration.md).

## Data + ML Layer

- The executed notebook is `notebooks/hmda_2025_xgboost_shap.ipynb`
- The app consumes `public/data/model_report.json`
- Current calibrated XGBoost AUC is about `0.804`
- Current calibrated Brier score is about `0.063`
- SHAP-style feature drivers are shown in the model panel
- Aggregated county/metro approval and affordability metrics

For live model inference, copy these Colab artifacts into `public/data/model_outputs/`:

- `hmda_2025_xgboost_calibrated_pipeline.joblib`
- `hmda_2025_xgboost_raw_pipeline.joblib`

## Data Pipeline

The current prototype does not use a real HMDA year yet. It uses `data/sample_hmda_lar.csv`, a 48-row HMDA-shaped sample with loan application fields modeled after the CFPB/FFIEC modified LAR structure, so we can build and test the visual analytics workflow first.

The current frontend loads `public/data/hmda_processed.json`. That file is generated by:

```bash
npm run build:data
```

The processor reads HMDA-style loan application fields from `data/sample_hmda_lar.csv`, computes county approval/readiness summaries, and produces the borrower points used in the comparison scatterplot.

For the course dataset, the planned next swap is one annual CFPB/FFIEC modified LAR extract, likely 2023 or 2024 for California counties first, then more years only if the interaction still performs well.

## Model Pipeline

The course model pipeline is the HMDA notebook:

```bash
jupyter notebook notebooks/hmda_2025_xgboost_shap.ipynb
```

It removes leakage-prone fields such as `interest_rate`, excludes sensitive demographic fields from scoring, trains/tunes XGBoost, calibrates probabilities, generates SHAP summaries, and exports dashboard-ready model reports.
