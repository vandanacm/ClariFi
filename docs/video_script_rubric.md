# ClariFi — 9-minute video script (instructor rubric)

**Course:** ECS273 · **Target length:** 8:30–8:45 (hard stop before 9:00 to avoid −1 pt overrun)  
**Deck:** `docs/ClariFi_Video_Presentation.pptx` (10 slides + speaker notes)  
**Full charts deck:** `docs/ClariFi_Presentation.pptx`

---

## Rubric map

| Requirement | Pts | Slide | Time |
|-------------|-----|-------|------|
| Intro + project title | (delivery) | 1 | 0:00–0:30 |
| Motivation, datasets, challenges, related work | 1 | 2 | 0:30–2:00 |
| Live demo / system video | 2 | 3 (+ screen recording) | 2:00–4:30 |
| Design, methodology, implementation | 2 | 4–5 | 4:30–6:15 |
| Unexpected technical challenges | 1 | 6 | 6:15–6:45 |
| Evaluation + results | 2 | 7–8 | 6:45–8:00 |
| Limitations + future work | 1 | 9 | 8:00–8:30 |
| Division of labor | −0.5 if missing | 10 | 8:30–8:45 |
| Clear delivery, flow, engagement | 1 | all | — |
| Overrun | −1 | — | stay ≤9:00 |
| Illegible text / bad contrast | −0.5 | — | ≥24 pt body |

---

## Slide-by-slide script

### Slide 1 — Title & team (0:00–0:30)

**On slide:** Project title, team names, roles  
**Say:**
- “We are [Name], [Name], and [Name].”
- “Our project is **ClariFi** — a California mortgage readiness dashboard.”
- “It helps households explore whether their finances align with historical approval patterns in a target market — for education, not lending decisions.”

---

### Slide 2 — Motivation, data, challenges, related work [1 pt] (0:30–2:00)

**On slide:** Problem bullets + HMDA scope  
**Say:**
1. **Motivation:** Credit scores and listing prices don’t show *regional* approval context or monthly cashflow together.
2. **Problem:** Users need one view: income, debt, savings, target price + local HMDA outcomes.
3. **Dataset:** 2025 HMDA Modified LAR — ~58,000 CA purchase loans (filtered); 58 counties on map; 4 metro regions for ML scoring.
4. **Challenges:** ~90% approval rate (imbalance); leakage risk from interest rate; sparse counties; syncing Colab model with API features; MongoDB connectivity.
5. **Related work:** Affordability tools and credit apps don’t link **calibrated ML + linked D3 views** on real HMDA data — our contribution is that integration.

**Speaker:** Person 1

---

### Slide 3 — Live demonstration [2 pts] (2:00–4:30)

**On slide:** Demo checklist (insert **screen recording** here in final video)  
**Record screen** (`npm run dev:full`):

1. Login as **Maya** (`maya.sac@clarifi.test` / `Testpass123`)
2. **Upload CSV** → `sacramento_mid_income_transactions.csv`
3. Move **sliders** → readiness % and DTI update
4. **County map** → click county → scatter + histogram filter
5. Switch **target market** Sacramento → Alameda
6. *(Optional)* Second user **Sofia** for high-income contrast

**Say while recording:**
- “Transactions ground the scenario in real cashflow.”
- “The score is calibrated approval *likelihood* from HMDA — not a personal guarantee.”
- “The map shows all 58 counties; scoring uses four metro buckets with enough sample.”

**Speaker:** Person 2

---

### Slide 4 — Design & methodology [2 pts] (4:30–5:30)

**On slide:** Architecture diagram  
**Say:**
- **Frontend:** React, TypeScript, Vite, D3 — choropleth, scatter, histogram, calibration, risk surface.
- **Backend:** FastAPI — register/login, CSV upload, `/api/mortgage/score`, saved scenarios.
- **ML:** XGBoost pipeline with isotonic calibration; features exclude interest rate and demographics from the score.
- **Storage:** MongoDB Atlas for users (`clarifi.app_store` document); static JSON for HMDA + model artifacts.

**Speaker:** Person 3

---

### Slide 5 — Implementation [2 pts] (5:30–6:15)

**On slide:** Training scope + implementation bullets  
**Say:**
- Trained on train/calibration/test splits (~37k / 9k / 11.6k rows).
- Exported `scenario_inference_config.json` so slider scenarios match training features (county medians, deciles).
- API uses `features_dataframe()` for correct column order to joblib pipeline.
- Linked views: county click filters scatter and histogram; brush on income.
- Fairness: demographic fields reserved for audit discussion, not in readiness score.

**Speaker:** Person 3

---

### Slide 6 — Unexpected challenges [1 pt] (6:15–6:45)

**On slide:** Three challenge bullets  
**Say (use your real issues):**
1. **MongoDB TLS** failures on local network → fallback mode + `scripts/check_mongo.py` for Atlas debugging.
2. **New model export** dropped `calibration` array → calibration chart empty until API merged bins from SHAP report.
3. **sklearn version** warnings loading Colab joblib — documented; scoring still works.
4. *(Optional)* Map initially used misleading readiness — fixed to **approval rate** for all 58 counties.

**Speaker:** Person 1 or 3

---

### Slide 7 — Evaluation: metrics [2 pts] (6:45–7:30)

**On slide:** Metrics chart  
**Say:**
- **Test AUC ≈ 0.80** — solid ranking (baseline logistic ~0.73).
- **Brier ≈ 0.06** after calibration (raw ~0.15).
- **Balanced accuracy ≈ 0.74** at threshold 0.90 (important with 90% approvals).
- **Denial recall ≈ 0.66** — room to improve catching denials.

**Speaker:** Person 2

---

### Slide 8 — Evaluation: calibration [2 pts] (7:30–7:50)

**On slide:** Calibration plot (full slide)  
**Say:**
- “Calibration points near the diagonal — predicted bins match actual approval rates.”

**Speaker:** Person 2

---

### Slide 9 — Evaluation: four demo users [2 pts] (7:50–8:10)

**On slide:** Persona comparison table + scores  
**What we compare (same model, different inputs):**

| User | Target market (scoring region) | Monthly income | Debt | Savings | Target price |
|------|------------------------------|----------------|------|---------|--------------|
| Sofia | Alameda (Bay) | $18,500 | $900 | $240k | $1.45M |
| Arjun | Alameda (Bay) | $12,800 | $1,200 | $130k | $980k |
| Maya | Sacramento | $9,200 | $950 | $85k | $560k |
| Diego | Los Angeles | $6,200 | $1,400 | $35k | $520k |

The model also uses derived **DTI** (debt-to-income), **LTV** (loan-to-value), loan amount, and **county HMDA context** for that market.  
**CSV transactions** ground the demo in real cashflow; the **readiness score** comes from the **scenario sliders** + target market, not from the CSV alone.

**Say:**
- “We hold the model fixed and change market plus affordability inputs.”
- “High Bay income in Alameda scores highest; Diego in LA with lower income and higher DTI scores lowest.”

**Speaker:** Person 2

---

### Slide 10 — Limitations & improvements [1 pt] (8:10–8:35)

**On slide:** Limitations bullets  
**Say:**
- Not underwriting or financial advice.
- Class imbalance and 4 scoring markets (not per-county ML yet).
- HMDA reflects past applications, not this applicant’s lender.
- **Future:** Full CA extract, tune for denial recall, per-county scoring, deployed cloud DB, stronger fairness reporting.

**Speaker:** Person 3

---

### Slide 11 — Division of labor (8:35–8:45) [required]

**On slide:** Table — **edit names and tasks before recording**

| Member | Contributions |
|--------|----------------|
| [Name A] | |
| [Name B] | |
| [Name C] | |

**Say:** “Thank you for watching.” **End recording.**

---

## Presenter split (3 people)

| Person | Sections | ~Time |
|--------|----------|-------|
| 1 | Slides 1–2, challenges (6) | ~3 min |
| 2 | Demo (3), evaluation (7–8) | ~3 min |
| 3 | Design (4–5), limitations (9), labor (10) | ~3 min |

---

## Slide design (College of Engineering template)

- Template: `College of Engineering PPT Template - Clean.pptx` (same style as FinSight ECS 273 deck)
- **Footer on every slide (bottom right):** `ECS 273 Spring Quarter 2026`
- Sections: Outline, Visualisations (image + bullets), Evaluation, Technical Challenges, Limitations, Distribution of Work
- Regenerate: `npm run build:video-presentation` → `docs/ClariFi_Video_Presentation.pptx` (~14 slides)
- Add `docs/presentation_assets/dashboard_screenshot.png` for the live demo slide (optional but recommended)

## Pre-recording checklist

- [ ] Edit title, division-of-labor table, and thank-you slide with real names and email
- [ ] `npm run build:presentation` then `npm run build:video-presentation` (refresh charts + decks)
- [ ] Register Maya + Sofia; upload CSVs from `server/data/user_upload_pack/`
- [ ] `npm run dev:full` — test demo path once
- [ ] Screen recorder: 1920×1080, 30 fps
- [ ] Practice full run with timer — target **8:40**
- [ ] Export final video **≤ 9:00**

---

## Files to reference

| File | Use |
|------|-----|
| `server/data/user_upload_pack/user_profiles_seed.csv` | Demo logins |
| `docs/presentation_assets/*.png` | Chart images |
| `public/data/model_report.json` | Metrics source |
| `scripts/check_mongo.py` | Mongo connectivity test |
