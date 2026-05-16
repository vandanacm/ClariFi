# ClariFi Backend + ML Integration Plan

ClariFi can grow from the current dependency-free Node demo into a production-style full-stack project with three backend layers:

1. Node/Express API server
2. MongoDB database for users, transactions, scenarios, and saved insights
3. Python ML service for transaction categorization, anomaly detection, forecasting, and mortgage approval scoring

## Recommended Stack

Frontend:
- Current static HTML/CSS/JS can stay for the course demo.
- Later, migrate to React/Vite if you want components, routes, and auth.

Backend API:
- Node.js + Express
- Mongoose for MongoDB
- JWT or session auth
- Multer or native file upload for CSV transaction imports

Database:
- MongoDB Atlas for deployment
- Local MongoDB for development
- Collections for users, profiles, transactions, benchmarks, scenarios, insights, and model runs

ML service:
- Python + FastAPI
- scikit-learn for baseline models
- XGBoost or Random Forest for improved approval scoring
- SHAP for model explanations if time allows
- Pandas for BLS/HMDA preprocessing

## Service Architecture

```text
Browser Dashboard
  |
  | REST API
  v
Node/Express API Server
  |              |
  | Mongoose     | HTTP
  v              v
MongoDB       Python FastAPI ML Service
                 |
                 v
          trained model artifacts
```

The Node server owns users, saved data, and app API contracts. The Python ML service owns model logic and returns predictions/explanations.

## MongoDB Collections

### users

Stores login identity.

```js
{
  _id,
  name,
  email,
  passwordHash,
  createdAt
}
```

### profiles

Stores household context used by the Profile Agent.

```js
{
  _id,
  userId,
  region: "West",
  householdType: "2-person renter/owner transition",
  incomeMonthly: 9400,
  goals: ["Build emergency runway", "Reach 20% down payment"],
  targetMarket: "Sacramento",
  createdAt,
  updatedAt
}
```

### transactions

Stores cleaned user transactions.

```js
{
  _id,
  userId,
  date,
  merchant,
  rawDescription,
  amount,
  direction: "debit",
  category: "food",
  blsGroup: "Food",
  isRecurring: false,
  sourceUploadId,
  createdAt
}
```

### scenarios

Stores what-if slider states.

```js
{
  _id,
  userId,
  market: "Sacramento",
  income: 9400,
  debt: 1250,
  savings: 82000,
  price: 560000,
  expenses: {
    food: 900,
    transport: 525,
    lifestyle: 850,
    investing: 1100
  },
  score,
  approval,
  createdAt
}
```

### insights

Stores generated agent insights.

```js
{
  _id,
  userId,
  scenarioId,
  agent: "Benchmark Agent",
  type: "peer-comparison",
  title,
  detail,
  focus: "finances",
  severity: "medium",
  createdAt
}
```

### model_runs

Tracks ML model versions and evaluation metrics.

```js
{
  _id,
  modelName: "hmda-approval-xgboost",
  version: "2026-05-ml-01",
  trainingRows,
  testAuc,
  testAccuracy,
  features,
  artifactPath,
  createdAt
}
```

## Node API Routes To Add

Authentication:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Profile:

```text
GET  /api/profile
PUT  /api/profile
```

Transactions:

```text
POST /api/transactions/upload
GET  /api/transactions
GET  /api/transactions/summary
```

Benchmarks:

```text
GET /api/benchmarks?region=West&incomeBand=upper-middle&householdType=2-person
```

Scenarios:

```text
POST /api/scenarios/score
GET  /api/scenarios
POST /api/scenarios/:id/save
```

Insights:

```text
GET  /api/insights
POST /api/insights/generate
```

Model metadata:

```text
GET /api/model/report
GET /api/model/features
```

## Python ML Service Routes

Run a separate FastAPI app on port `8000`.

```text
GET  /health
POST /categorize-transactions
POST /detect-insights
POST /forecast-cashflow
POST /score-mortgage-readiness
POST /explain-score
```

Example `POST /score-mortgage-readiness` request:

```json
{
  "market": "Sacramento",
  "income": 9400,
  "debt": 1250,
  "savings": 82000,
  "price": 560000,
  "expenses": {
    "food": 900,
    "transport": 525,
    "lifestyle": 850,
    "investing": 1100
  }
}
```

Example response:

```json
{
  "score": 74,
  "approval": 0.651,
  "topDrivers": [
    {
      "feature": "debt_to_income",
      "direction": "negative",
      "impact": 0.31
    },
    {
      "feature": "down_payment_rate",
      "direction": "positive",
      "impact": 0.22
    }
  ]
}
```

## ML Models To Build

### Transaction Categorization

Purpose: map uploaded bank transactions to BLS-style groups.

Baseline:
- Rule-based merchant/category mapping
- Keyword dictionary for grocery, restaurant, gas, rent, utilities, subscriptions

Upgrade:
- TF-IDF + Logistic Regression on transaction descriptions
- Later: small language-model classifier if allowed

### Anomaly Detection

Purpose: detect unusual spending and recurring expense changes.

Baseline:
- Monthly category z-scores
- Percent change from trailing 3-month average
- Recurring charge amount changes

Upgrade:
- Isolation Forest per category
- Seasonal decomposition for longer histories

### Cashflow Forecast

Purpose: forecast runway and savings path.

Baseline:
- Rolling monthly average income and expenses
- Scenario-adjusted surplus projection

Upgrade:
- Prophet, ARIMA, or gradient boosting regression if enough monthly history exists

### HMDA Approval Readiness

Purpose: compare user scenario against mortgage applicant patterns.

Baseline:
- Logistic regression

Upgrade:
- Random Forest or XGBoost
- SHAP feature explanations
- County/MSA calibration summaries

## Node To Python Integration

In Node, call the Python service when scoring a scenario:

```js
const response = await fetch(`${process.env.ML_SERVICE_URL}/score-mortgage-readiness`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(scenario)
});

const mlScore = await response.json();
```

Recommended environment variables:

```text
PORT=5173
MONGODB_URI=mongodb://127.0.0.1:27017/clarifi
JWT_SECRET=replace-me
ML_SERVICE_URL=http://127.0.0.1:8000
```

## Minimum Course Version

For a strong visual analytics course submission, build only the pieces that support the demo story:

1. MongoDB stores one demo user, uploaded transactions, saved scenarios, and generated insights.
2. Node API exposes profile, transactions, benchmark, HMDA, scenario, and insight routes.
3. Python ML service scores mortgage readiness and returns model drivers.
4. Dashboard shows API connection, agent insights, BLS peer comparison, HMDA comparison, and model explanation.

## Resume Bullet Version

Built ClariFi, an AI-guided personal finance and mortgage readiness analytics platform using a Node/Express API, MongoDB persistence layer, Python ML scoring service, BLS Consumer Expenditure Survey benchmarks, and HMDA mortgage data to power linked visual dashboards, what-if scenario simulation, peer comparison, anomaly detection, and model explanations.
