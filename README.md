# ClariFi

ClariFi is an AI-guided personal finance and mortgage readiness visual analytics system. It combines 18 interactive D3 visualizations with a calibrated XGBoost model trained on ~58,000 California HMDA mortgage applications, BLS Consumer Expenditure peer benchmarks, and LLM-powered explanations to help users understand their mortgage readiness before applying.

## System Architecture

Three-tier flow: React + D3 dashboard (linked views), FastAPI backend (scoring, BLS, LLM), and data layer (HMDA, XGBoost artifact, MongoDB or local JSON fallback).

![ClariFi system architecture](client/public/clarifi_system_architecture.png)

## Setup Instructions

### Prerequisites

- **Python 3.11+** (for the backend)
- **Node.js 18+** and **npm** (for the frontend)
- **Git** (to clone the repository)

### Backend Setup

**1. Navigate to the server folder**

```
cd server
```

**2. Create and activate a Python virtual environment**

```
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

**3. Install required Python packages**

```
pip install -r requirements.txt
```

**4. Configure environment variables**

The `.env.example` in the project root already contains working defaults (MongoDB Atlas URI, OpenRouter key placeholder). Copy it if you don't have a `.env` yet:

```
cp ../.env.example ../.env
```

The app connects to MongoDB Atlas by default (open to all IPs). If Atlas is unreachable, it falls back to `client/public/data/local_store.json` (created from `local_store.seed.json` on first run; gitignored once you use the app).

If you want AI-powered explanations, add your OpenRouter API key in `.env`. Without it, the app still works using rule-based template explanations.

**5. XGBoost model artifacts**

After clone, confirm `client/public/data/model_outputs/` is present (tracked in git, ~600 KB). Required files:

| File | Purpose |
|------|---------|
| `hmda_2025_xgboost_calibrated_pipeline.joblib` | Live approval scoring |
| `scenario_inference_config.json` | Feature engineering for the API |
| `hmda_2025_xgboost_shap_report.json` | Calibration fallback + extended diagnostics |

If the folder is missing, the app still runs but shows **Model unavailable**. Regenerate from `notebooks/hmda_2025_xgboost_shap.ipynb` or copy artifacts from Colab/Drive into `client/public/data/model_outputs/`.

**6. Start the FastAPI server**

```
uvicorn main:app --host 127.0.0.1 --port 8001
```

The API will be available at: http://127.0.0.1:8001

API documentation available at: http://127.0.0.1:8001/docs

### Frontend Setup

**1. Open a new terminal and navigate to the client folder**

```
cd client
```

**2. Install required Node.js packages**

```
npm install
```

**3. Start the React development server**

```
npm run dev
```

**4. Open the app in your browser**

Visit: http://127.0.0.1:5173

The frontend proxies all `/api/*` requests to the backend server on port 8001.

### Test Users and Sample Data

You can explore the app without registering by clicking **"Explore demo →"** on the landing page. This uses a built-in demo account.

To test with different personas, use the pre-configured test users below. All share the password `Testpass123`:

| Name | Email | Persona | Target Market | Transaction CSV |
|---|---|---|---|---|
| Sofia Chen | `sofia.sf@clarifi.test` | High-income SF buyer | Alameda | `sf_high_income_transactions.csv` |
| Arjun Patel | `arjun.bay@clarifi.test` | Median-plus SoCal buyer | San Diego | `bay_median_plus_transactions.csv` |
| Maya Gomez | `maya.sac@clarifi.test` | Mid-income Sacramento buyer | Sacramento | `sacramento_mid_income_transactions.csv` |
| Diego Rivera | `diego.inland@clarifi.test` | Lower-income Inland renter | Los Angeles | `inland_lower_income_transactions.csv` |

**Steps to test a persona:**

1. Register using the email and password from the table above
2. After sign-in, upload the matching CSV from `server/data/user_upload_pack/`
3. The sliders will auto-fill from the uploaded transaction data, you may also edit the sliders and check how the rates vary with what if scenarios and save each scenario. 
4. Explore the dashboard — each persona produces a different readiness score and risk profile

**Testing the re-upload flow:**

To test uploading a new CSV for an already-registered user, use `server/data/user_upload_pack/reupload_test_transactions.csv`. Log in as any existing account, click **Upload CSV** in the top-right header, and select this file. The dashboard metrics will update immediately without a page refresh (~$9,200/mo income, $870 debt, $600/mo savings, 2 months of data).

## Project Structure

```
ClariFi/
├── client/
│   ├── public/data/              # Published runtime data (Vite /api static)
│   │   ├── hmda_processed.json   # Choropleth, scatter, histogram
│   │   ├── bls_benchmarks.json
│   │   ├── model_report.json
│   │   ├── model_outputs/        # XGBoost .joblib, SHAP JSON, scenario config
│   │   ├── local_store.seed.json # Demo user seed (tracked)
│   │   └── local_store.json      # Auth fallback (gitignored; auto-created)
│   └── src/                      # React + D3 dashboard
├── server/
│   ├── data/                     # Pipeline inputs + demo CSV uploads
│   │   ├── hmda_2025_sample_60000.csv
│   │   └── user_upload_pack/
│   ├── paths.py                  # Canonical paths (server + client data)
│   └── main.py                   # FastAPI, ML scoring, LLM
├── notebooks/                    # Train model → copy artifacts to public/data/
└── .env.example
```

See `server/data/README.md` for the server vs client data split.

## Dashboard layout (top → bottom)

Linked views follow a natural readiness workflow:

1. **Readiness score** — XGBoost approval probability and key metrics (DTI, surplus)
2. **Budget mixer** — expense donut + sliders (housing, debt, flexible spending) — primary monthly controls
3. **Cashflow waterfall** — linked to budget mixer
4. **What-if simulator + BLS benchmarks** — income, debt, savings, target price
5. **Readiness planning** — guideline gauges, DTI breakdown, counterfactual, savings path, affordability, payment stack, loan programs, rate sensitivity
6. **HMDA market context** — county map (fixed 38–85% scale), scatter, histogram (bidirectional brushing)
7. **Model audit** — performance, peer comparison, global/local SHAP, calibration, risk surface

## Linked Views and Interactions

The dashboard has 18 D3 visualizations connected through bidirectional brushing and shared state:

| Chart | Type | Linked Interactions |
|---|---|---|
| CashflowChart | Waterfall | Hover pop-out with glow/dim |
| ExpenseDonut | Donut | Hover/click expand slice, bidirectional with sliders |
| GuidelineGauges | Dual gauge | DTI and down payment vs. lender zones |
| DtiDecomposition | Stacked bar | Housing, debt, and total DTI vs. 36% guideline |
| CounterfactualBar | Bar | Before/after approval from top model suggestion |
| SavingsTimeline | Line | Months to 10%/20% down payment targets |
| AffordablePriceBand | Range | Legend below bar — no overlapping price labels |
| MonthlyPaymentStack | Stacked bar | P&I, tax, insurance, PMI breakdown |
| LoanProgramChecklist | Checklist | Conventional / FHA / VA guideline pass-fail |
| RateSensitivityChart | Dual line | Payment and approval vs. interest rate (±2% from 7.25%) |
| GlobalFeatureImportance | Horizontal bar | Training-data feature weights (population-level) |
| IncomeHistogram | Stacked histogram | Brush income band → highlights matching scatter points |
| ChoroplethMap | Choropleth | Fixed 38–85% scale; click county → filters scatter + histogram |
| RiskSurface | Heatmap | Click cell → applies DTI/DP to sliders; real XGBoost predictions |
| HmdaScatter | Scatter | Hover point → highlights county on map; responds to histogram brush |
| BenchmarkBars | Horizontal bar | User spending vs. BLS peer comparison |
| CalibrationChart | Line | Model predicted vs. actual approval rates |
| ShapWaterfallChart | Horizontal bar | Per-feature impact from model perturbation |
| CountyCalibrationChart | Paired bar | Per-county fairness audit |

**Cross-chart links:** Budget mixer ↔ Cashflow, Simulator → All views (debounced 250ms), Histogram ↔ Scatter ↔ Map (bidirectional brushing), Risk Surface → Sliders (click-to-apply), Agent → Charts (AI annotations).

## Core Datasets

- **HMDA Modified LAR (2025 California)**: The full 2025 HMDA dataset contains ~12 million records nationally. We filtered to California and stratified-sampled ~5,000 rows per month to create a ~58,000-row training set for the XGBoost model, scatter plot, histogram, and choropleth
- **BLS Consumer Expenditure Survey**: Peer spending benchmarks by income band and region
- **XGBoost model**: Calibrated approval probability trained on HMDA data (AUC 0.804, Brier 0.063, 300 trees, isotonic calibration)

## Known Issues and Limitations

- The XGBoost model is trained on California HMDA data only — predictions may not generalize to other states
- The readiness score is for educational purposes only and is not a credit decision or financial advice
- If OpenRouter API keys are not set, the AI explainer falls back to rule-based templates
