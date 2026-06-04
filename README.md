# ClariFi

ClariFi is an AI-guided personal finance and mortgage readiness visual analytics system. It combines 10 interactive D3 visualizations with a calibrated XGBoost model trained on ~58,000 California HMDA mortgage applications, BLS Consumer Expenditure peer benchmarks, and LLM-powered explanations to help users understand their mortgage readiness before applying.

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

The app connects to MongoDB Atlas by default (open to all IPs). If Atlas is unreachable, it automatically falls back to a local JSON file (`client/public/data/local_store.json`).

If you want AI-powered explanations, add your OpenRouter API key in `.env`. Without it, the app still works using rule-based template explanations.

**5. Verify the XGBoost model file is present**

The pre-trained model should already be included at:

```
client/public/data/model_outputs/hmda_2025_xgboost_calibrated_pipeline.joblib
```

If this file is missing, the app will still run but will show "Model unavailable" instead of real XGBoost predictions. You can regenerate it by running the training notebook in `notebooks/`.

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
| Arjun Patel | `arjun.bay@clarifi.test` | Median-plus Bay buyer | Alameda | `bay_median_plus_transactions.csv` |
| Maya Gomez | `maya.sac@clarifi.test` | Mid-income Sacramento buyer | Sacramento | `sacramento_mid_income_transactions.csv` |
| Diego Rivera | `diego.inland@clarifi.test` | Lower-income Inland renter | Los Angeles | `inland_lower_income_transactions.csv` |

**Steps to test a persona:**

1. Register using the email and password from the table above
2. After sign-in, upload the matching CSV from `server/data/user_upload_pack/`
3. The sliders will auto-fill from the uploaded transaction data
4. Explore the dashboard — each persona produces a different readiness score and risk profile

## Project Structure

```
ClariFi/
├── client/                          # React + TypeScript + Vite frontend
│   ├── public/
│   │   ├── data/                    # Static JSON datasets
│   │   │   ├── bls_benchmarks.json  # BLS peer spending benchmarks
│   │   │   ├── hmda_processed.json  # Processed HMDA scatter/county data
│   │   │   ├── model_report.json    # XGBoost training metrics
│   │   │   ├── local_store.json     # Local user/session storage
│   │   │   └── model_outputs/       # XGBoost .joblib model + SHAP artifacts
│   │   └── logo.png
│   ├── src/
│   │   ├── components/              # 10 D3 chart components (one per file)
│   │   │   ├── CashflowChart.tsx    # Monthly cashflow waterfall
│   │   │   ├── ExpenseDonut.tsx     # Budget donut with hover/click
│   │   │   ├── HmdaScatter.tsx      # Income vs. loan scatter plot
│   │   │   ├── ChoroplethMap.tsx    # California county approval map
│   │   │   ├── IncomeHistogram.tsx  # Income distribution histogram
│   │   │   ├── RiskSurface.tsx      # DTI × down-payment heatmap
│   │   │   ├── BenchmarkBars.tsx    # User vs. BLS peer bars
│   │   │   ├── CalibrationChart.tsx # Model calibration curve
│   │   │   ├── ShapWaterfallChart.tsx # Feature impact waterfall
│   │   │   ├── CountyCalibrationChart.tsx # Per-county fairness audit
│   │   │   ├── chart-utils.ts       # Shared D3 utilities
│   │   │   └── index.ts             # Barrel export
│   │   ├── ReactApp.tsx             # Main dashboard with linked views
│   │   ├── Landing.tsx              # Landing page
│   │   ├── Login.tsx                # Auth modal (login/register)
│   │   ├── Onboarding.tsx           # CSV upload onboarding flow
│   │   ├── api.ts                   # API client (fetch wrapper)
│   │   ├── types.ts                 # TypeScript type definitions
│   │   ├── styles.css               # All application styles
│   │   ├── main.tsx                 # React entry point
│   │   └── vite-env.d.ts            # Vite type declarations
│   ├── package.json                 # npm dependencies and scripts
│   ├── vite.config.ts               # Vite config with API proxy
│   ├── tsconfig.json                # TypeScript config
│   ├── tsconfig.app.json
│   └── tsconfig.node.json
├── server/                          # FastAPI + Python backend
│   ├── data/                        # Raw HMDA CSV and sample transactions
│   │   ├── hmda_2025_sample_60000.csv
│   │   └── user_upload_pack/        # Sample CSVs for different personas
│   ├── main.py                      # API routes, ML scoring, LLM chain
│   ├── data_scheme.py               # Pydantic request/response models
│   ├── import_data.py               # Data loading, CSV parsing, storage
│   ├── scenario_inference.py        # Feature engineering for XGBoost
│   └── requirements.txt             # Python dependencies
├── notebooks/                       # Jupyter notebook for model training
│   └── hmda_2025_xgboost_shap.ipynb # XGBoost training + SHAP analysis
├── scripts/                         # Data processing and utility scripts
├── docs/                            # Presentations and documentation
├── tests/                           # API tests (pytest)
├── .env.example                     # Environment variable template
├── .gitignore
└── README.md
```

## System Architecture

```
┌─────────────────────────┐   /api/* (HTTP/JSON)   ┌─────────────────────────┐   joblib / HTTP   ┌─────────────────────────┐
│       FRONTEND          │ ──────────────────────► │        BACKEND          │ ────────────────► │       ML / AI           │
│                         │                         │                         │                   │                         │
│  React 19 · TypeScript  │                         │  FastAPI · Python       │                   │  XGBoost + LLM          │
│  D3.js v7 · Vite 6      │                         │  Uvicorn · port 8001    │                   │  300 trees · depth 5    │
│  10 interactive charts  │                         │  15 REST endpoints      │                   │  Isotonic calibration   │
│  Dark / light theme     │ ◄──────── JSON ──────── │  JWT + JSON/MongoDB     │ ◄─ scores+text ── │  OpenRouter / Ollama    │
│  JWT auth flow          │                         │  XGBoost inference      │                   │  SHAP approximations    │
└─────────────────────────┘                         └─────────────────────────┘                   └─────────────────────────┘
     10 charts · linked views                          15 endpoints · <50 ms                        AUC 0.804 · Brier 0.063
```

## Visualization Components

| Chart | Type | Linked Interactions |
|---|---|---|
| CashflowChart | Waterfall | Hover pop-out with glow/dim animation |
| ExpenseDonut | Donut | Hover/click expand slice, bidirectional with budget sliders |
| IncomeHistogram | Stacked histogram | Crosshair brush → highlights matching scatter points |
| ChoroplethMap | Choropleth map | Click county → filters scatter + histogram; highlights from scatter hover |
| RiskSurface | Heatmap | Click cell → applies DTI/DP to scenario sliders; XGBoost model predictions |
| HmdaScatter | Scatter plot | Hover point → highlights county on map; responds to histogram brush |
| BenchmarkBars | Horizontal bar | User spending vs. BLS peer comparison |
| CalibrationChart | Line chart | Model predicted vs. actual approval rates |
| ShapWaterfallChart | Horizontal bar | Per-feature impact from model perturbation |
| CountyCalibrationChart | Paired bar | Per-county fairness audit |

## Linked View Interactions

- **Histogram → Scatter**: Brushing an income band highlights matching points in the scatter plot
- **Scatter → Map**: Hovering a scatter point highlights its county on the choropleth
- **Map → Scatter + Histogram**: Clicking a county filters both charts to that county's data
- **Risk Surface → Sliders**: Clicking a heatmap cell sets debt/savings to match the selected DTI/DP
- **Agent → Charts**: AI explanations annotate specific chart elements (e.g., dim denied points, highlight risk surface position)
- **Sliders → All views**: Every chart reacts when scenario parameters change (debounced 250ms)

## Core Datasets

- **HMDA Modified LAR (2025 California)**: The full 2025 HMDA dataset contains ~12 million records nationally. We filtered to California and stratified-sampled ~5,000 rows per month to create a ~58,000-row training set for the XGBoost model, scatter plot, histogram, and choropleth
- **BLS Consumer Expenditure Survey**: Peer spending benchmarks by income band and region
- **XGBoost model**: Calibrated approval probability trained on HMDA data (AUC 0.804, Brier 0.063, 300 trees, isotonic calibration)

## Known Issues and Limitations

- The XGBoost model is trained on California HMDA data only — predictions may not generalize to other states
- The readiness score is for educational purposes only and is not a credit decision or financial advice
- If OpenRouter API keys are not set, the AI explainer falls back to rule-based templates
