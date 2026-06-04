# ClariFi — Google Slides outline (9 min · 3 speakers)

Copy each block into a slide: **Title** → slide title, **On slide** → body bullets, **Speaker notes** → Presenter notes panel.

---

## Slide 1 — Title

**Title:** ClariFi: California Mortgage Readiness Dashboard

**On slide:**
- AI-guided exploration for households considering a home purchase
- React + D3 + FastAPI + calibrated XGBoost (HMDA 2025, CA)
- ECS273 · Team: [Names]

**Speaker notes (Alex · ~30 sec):**
- Open with the core question: Can this household stay financially resilient and buy in a target California market?
- Clarify upfront: educational tool, not loan approval or financial advice.
- Introduce three parts: problem/users, live demo, model + limitations.

---

## Slide 2 — The problem

**Title:** Why households need more than a credit score

**On slide:**
- Credit scores and listing prices don’t show **regional approval context**
- Cashflow, debt, and down payment interact with **local HMDA outcomes**
- Goal: one dashboard linking **personal finance + CA market data + ML score**

**Speaker notes (Alex · ~45 sec):**
- Renters and first-time buyers lack a linked view of monthly surplus, DTI, and what happened to similar applicants in their market.
- HMDA gives population-level approval/denial patterns; we layer a household scenario on top.
- Mention diverse users across Bay Area, Sacramento, and SoCal/inland—not one “average” buyer.

---

## Slide 3 — System architecture

**Title:** How ClariFi is built

**On slide:**
- **Frontend:** React, TypeScript, Vite, D3 (maps, scatter, histogram, calibration)
- **Backend:** FastAPI — auth, CSV upload, scenario scoring, agent explain
- **ML:** Calibrated XGBoost pipeline (~58k CA purchase loans)
- **Data:** MongoDB (users, transactions, scenarios) · static HMDA + model JSON

**Speaker notes (Alex · ~60 sec):**
- Walk the arrow: browser calls API; API loads joblib + inference config; HMDA charts from processed JSON.
- User-specific data (register, login, CSV, saved scenarios) in MongoDB as one app store document.
- Hand off: “Jordan will run the live dashboard.”

---

## Slide 4 — Demo: four California personas

**Title:** Demo — distributed user group across CA

**On slide:**

| Persona | Target market | Monthly income | Role in demo |
|---------|---------------|----------------|--------------|
| Sofia | Alameda (Bay) | ~$18.5k | High income — can buy in Bay |
| Arjun | Alameda | ~$12.8k | Median+ — borderline Bay |
| Maya | Sacramento | ~$9.2k | Mid — good Sacramento fit |
| Diego | Los Angeles | ~$6.2k | Lower — constrained; interventions matter |

*Credentials in `server/data/user_upload_pack/user_profiles_seed.csv`*

**Speaker notes (Jordan · ~30 sec):**
- We seeded four users with different incomes and regions—not a single demo household.
- Log in as Maya (Sacramento) for the main walkthrough; Sofia optional for contrast at the end.
- CSV uploads per user in `server/data/user_upload_pack/`.

---

## Slide 5 — [LIVE] Personal finance → readiness score

**Title:** Live — scenario sliders & readiness score

**On slide:**
- Upload transaction CSV → monthly income / outflow summary
- Adjust: income · debt · savings · target price
- **Output:** approval likelihood (0–100), DTI, surplus, counterfactual hints

**Speaker notes (Jordan · ~90 sec · LIVE):**
1. Upload `sacramento_mid_income_transactions.csv` (or show already uploaded).
2. Point to cashflow / expense views briefly.
3. Move sliders — readiness ring and approval % update (XGBoost, `calibrated-xgboost` mode).
4. One sentence: “Score is calibrated probability from HMDA, not a personal guarantee.”
- **Skip if short on time:** donut chart; keep sliders + score panel only.

---

## Slide 6 — [LIVE] 58 counties + linked charts

**Title:** Live — California map & linked HMDA views

**On slide:**
- Choropleth: **58 counties** colored by HMDA **approval rate**
- Click county → filter scatter (income vs loan) + income histogram
- **Target market** dropdown: 4 scoring regions (Sacramento, Alameda, San Diego, LA)

**Speaker notes (Jordan · ~75 sec · LIVE):**
1. Map: color = historical approval rate; tooltip notes sparse counties.
2. Click a county — linked charts update.
3. Histogram: teal line = your income; hover bars for approved/denied counts.
4. Switch target market to Alameda — same household, different regional scoring context.
- Note: map explores all counties; ML scoring uses four metro buckets with enough sample.

---

## Slide 7 — Model quality & trust

**Title:** Model performance & calibration

**On slide:**
- **Leakage-controlled:** no interest rate; demographics excluded from score
- **Test metrics:** AUC ≈ 0.80 · Brier ≈ 0.06 · Balanced accuracy ≈ 0.74
- **Calibration plot:** predicted vs actual approval by score bin
- Risk surface + “what-if” (e.g. reduce debt → higher likelihood)

**Speaker notes (Sam · ~75 sec · LIVE):**
- Show calibration chart with dots near the diagonal.
- One line on class imbalance (~90% approvals in data)—why we emphasize AUC/Brier, not raw accuracy alone.
- Briefly show risk surface or counterfactual suggestion.
- If dots missing: refresh; API merges bins from SHAP report artifact.

---

## Slide 8 — Personas compared

**Title:** Same model, different outcomes

**On slide:**
- High Bay income → stronger approval likelihood in **Alameda**
- Mid Sacramento → viable in **Sacramento**, tougher on coast
- Lower inland → highlights value of debt/savings interventions
- Saved scenarios + agent Q&A per user (MongoDB)

**Speaker notes (Sam · ~90 sec):**
- Quick contrast: log in as Sofia OR switch Maya’s market to Alameda and compare score.
- Tie to policy story: geography and household finances both matter.
- Mention persistence: register, upload, save scenario, optional agent explain.
- **Time saver:** only verbalize the table if you can’t switch users live.

---

## Slide 9 — Limitations & thank you

**Title:** Limitations & next steps

**On slide:**
- **Not** underwriting or financial advice
- Training data heavily approved (~90%) · denial recall ~66% at best threshold
- Scoring: 4 target markets · map: 58 counties
- Next: full CA LAR, better denial detection, optional per-county scoring

**Thank you — questions?**

**Speaker notes (Sam · ~45 sec):**
- Honest close: educational prototype with real HMDA + calibrated ML.
- MongoDB for user store when Atlas is connected; document known TLS/network issues for class demo.
- Thank the audience; invite questions on fairness, data, or architecture.

---

## Presenter assignment (9:00 total)

| Time | Speaker | Slides |
|------|---------|--------|
| 0:00–2:15 | Alex | 1–3 |
| 2:15–5:30 | Jordan | 4–6 (live) |
| 5:30–9:00 | Sam | 7–9 (live on 7) |

**Laptop driver:** Jordan (slides 4–6); Sam drives slide 7 if same machine.

---

## Pre-flight checklist

- [ ] `npm run dev:api` and `npm run dev` running
- [ ] At least 2 users registered + CSV uploaded (Maya + Sofia recommended)
- [ ] Hard refresh once (calibration dots, latest joblib)
- [ ] Browser at 100% zoom; close extra tabs
- [ ] Screenshots backup: map, calibration, score panel

---

## Paste tip for Google Slides

1. Create **9 blank slides**.
2. For each section above: copy **Title** → title box, **On slide** → bullets, **Speaker notes** → View → Notes.
3. Slides 5–7: insert screenshot placeholders or “LIVE DEMO” in large text.
4. Slide 4 & 8: use **Insert → Table** for persona tables.
