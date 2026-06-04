# ClariFi — 9-minute video script (full)

**Deck:** `docs/ClariFi_Video_Presentation.pptx`  
**Team:** Lalitha · Pranav · Vandana  
**Demo user:** **Maya Gomez** — `maya.sac@clarifi.test` / `Testpass123`  
**Upload:** `server/data/user_upload_pack/sacramento_mid_income_transactions.csv`  
**Market:** Sacramento · Target home **$560,000**

---

## Screenshot captions (for slides, report, or video lower-thirds)

| # | File / view | Caption |
|---|-------------|---------|
| 1 | Readiness planning grid | **What-if planning:** BLS peer benchmarks, simulator sliders, lender gauges, DTI breakdown, top improvement, savings path, affordability band, payment stack, loan programs, and rate sensitivity — all driven by one buyer profile. |
| 2 | HMDA linked views | **Market context:** California county approval map (fixed 38–85% scale), income vs. loan scatter for Sacramento, and brushed income histogram — map click and histogram brush filter each other and highlight “Your profile.” |
| 3 | Model audit | **Model transparency:** Test metrics (AUC 0.80), peer comparison, global HMDA feature weights (*relative importance % of global SHAP magnitude*), calibration, risk surface, and per-scenario drivers. |
| 4 | Scenario history | **Scenario comparison:** Side-by-side saved profiles across markets and dates — income, approval %, readiness score, DTI, down payment, and monthly surplus. |
| 5 | Fairness footer | **Ethics & limits:** Historical HMDA bias disclaimer, educational-use notice, excluded leakage/fairness-only fields, and county-level predicted vs. actual calibration. |

Copy images into `docs/presentation_assets/` if you embed them in the deck.

---

## Linked views — summary for narration

**Global control:** What-if simulator (income, debt, savings, target price) debounces ~250 ms and refreshes readiness score, planning panels, HMDA peer marker, and model audit.

| Zone | Views | Links |
|------|-------|-------|
| Budget | Expense donut ↔ housing/debt/flexible sliders ↔ cashflow waterfall | Donut and sliders stay in sync; waterfall reflects category totals. |
| Planning | Guideline gauges, DTI stack, counterfactual, savings timeline, affordability band, payment stack, loan checklist, rate sensitivity | All recompute from simulator + model score. |
| HMDA | Choropleth map ↔ scatter ↔ income histogram | **Map click** → filter scatter & histogram to county. **Histogram brush** → filter scatter; vertical line shows your income. **Scatter hover** → highlight county on map. |
| Model | Metrics, peer bars, global importance, calibration, risk surface, local drivers, county fairness bars | Risk surface **cell click** → applies DTI/DP to sliders. Agent can annotate readiness / finances / HMDA / model sections. |
| Meta | Scenario history table | Compares saved scenarios (market, date, score, DTI, surplus). |

**18 D3 views** total (see README linked-views table).

---

## Presenter note — “Relative importance (% of global SHAP magnitude)”

**What it means (say in ~15 sec):** Each bar is how much that factor mattered **on average across all ~58k CA HMDA training loans** — not for one user. SHAP measures average impact on approve/deny predictions; we show each feature as a **percent of the total** (DTI ~69%, down payment ~15%, etc.).

**What it is not:** Not Maya’s personal breakdown — that is **“What moves your approval likelihood”** beside the risk surface. Not a lender rule — it is **what the model learned** from historical HMDA.

**PPT one-liner:** *Share of total model influence from each feature across ~58k CA loans (population-level).*

---

## Before you record

1. `cd server && uvicorn main:app --host 127.0.0.1 --port 8001`
2. `cd client && npm run dev` → http://127.0.0.1:5173
3. Register **Maya Gomez**, upload `sacramento_mid_income_transactions.csv`
4. Set simulator: income **~$10,750**, debt **~$805**, savings **$82,000**, price **$560,000** (matches your screenshots after CSV aggregation)
5. Save one scenario for the **Scenario history** slide
6. Screen record 1920×1080; practice to finish by **8:55**

---

## Rubric timing (total 9:00)

| Time | Section | Speaker |
|------|---------|---------|
| 0:00–0:25 | Title | Lalitha |
| 0:25–0:55 | Introduction | Lalitha |
| 0:55–1:35 | Motivation & Problem | Lalitha |
| 1:35–2:15 | Datasets & Challenges | Lalitha |
| 2:15–2:50 | Related Work | Lalitha |
| 2:50–3:25 | Methodology | Pranav |
| 3:25–3:50 | Architecture | Pranav |
| 3:50–4:05 | Dashboard layout | Vandana |
| 4:05–6:25 | **LIVE DEMO (Maya)** | Vandana |
| 6:25–7:35 | Evaluation | Pranav |
| 7:35–8:05 | Technical challenges | Vandana |
| 8:05–8:30 | Limitations | Lalitha |
| 8:30–8:50 | Division of labor | All |
| 8:50–9:00 | Thank you | All |

---

## Full spoken script

### 0:00 — Title (25 sec) · Lalitha

"Hello. We are Lalitha, Pranav, and Vandana from ECS 273. Our project is **ClariFi** — an AI-guided mortgage readiness dashboard for California home buyers."

---

### 0:25 — Introduction (30 sec) · Lalitha

"ClariFi combines personal cashflow, Bureau of Labor Statistics peer spending, and a calibrated XGBoost model trained on roughly fifty-eight thousand California HMDA applications. The interface has **eighteen linked D3 views** that update together when you change income, debt, savings, or target price. Everything here is **educational** — not a credit decision or lending advice."

---

### 0:55 — Motivation & problem (40 sec) · Lalitha

"Most affordability calculators ignore **regional approval context**. A strong income in one county does not mean the same outcome elsewhere. ClariFi links your monthly budget to **what actually happened** to similar HMDA applicants — approved versus denied — so users can see readiness, market position, and model drivers in one place."

---

### 1:35 — Datasets & challenges (40 sec) · Lalitha

"We use the **2025 HMDA Modified LAR**, roughly twelve million rows nationally. We filtered to California and stratified sampling to about **five thousand rows per month**, near **fifty-eight thousand** training records. Challenges included **class imbalance**, **leakage control** — we drop interest rate from the score — and exporting the Colab pipeline so FastAPI serves the same calibrated probabilities as the notebook."

---

### 2:15 — Related work (35 sec) · Lalitha

"Consumer apps show credit scores; government sites publish HMDA aggregates. Research tools explain models in isolation. ClariFi’s contribution is **calibrated ML plus linked visual analytics** — budget, HMDA geography, and explainability in one coordinated dashboard."

---

### 2:50 — Methodology (35 sec) · Pranav

"We train **XGBoost** with **isotonic calibration** — about three hundred trees. Features include debt-to-income, loan-to-value, loan size versus county median, and loan type. Sensitive fields like age and sex are **excluded from scoring** and used only in fairness views. The readiness score is **approval likelihood** on a hold-out test set, not a bank’s internal policy engine."

---

### 3:25 — Architecture (25 sec) · Pranav

"The **React** front end uses **D3** for charts. **FastAPI** loads the joblib pipeline and scenario config from `client/public/data/model_outputs`. User data goes to **MongoDB Atlas**, with **local JSON fallback** seeded from `local_store.seed.json`. Static HMDA and BLS JSON are served from the Vite public folder."

---

### 3:50 — Dashboard layout (15 sec) · Vandana

"Top to bottom: **readiness score**, **budget donut and cashflow**, **simulator and BLS benchmarks**, **eight planning panels**, **linked HMDA map, scatter, and histogram**, then **model audit** and the **fairness footer**."

---

### 4:05 — LIVE DEMO — Maya Gomez (2 min 20 sec) · Vandana

**Setup on screen:** Logged in as **Maya Gomez**, Sacramento, CSV uploaded.

**4:05–4:25 Readiness & budget**

"I’m logged in as **Maya**, our mid-income Sacramento buyer — email `maya.sac@clarifi.test`. After uploading her transaction CSV, the readiness panel shows about a **ninety-seven percent** calibrated approval likelihood and a high readiness score, with DTI near **thirty-five percent** — right at the common thirty-six percent guideline.

In the **budget mixer**, I move the housing and debt sliders; the **donut** and **cashflow waterfall** update together so spending categories stay consistent."

**4:25–4:55 Planning grid *(Screenshot 1)***

"The **what-if simulator** sets income near **ten thousand seven hundred fifty**, debt near **eight hundred**, savings **eighty-two thousand**, and target price **five hundred sixty thousand**.

The planning row shows **BLS peer benchmarks** — how Maya’s spending compares to similar Western households — then **lender gauges**, **DTI breakdown**, a **counterfactual** suggesting more savings toward twenty percent down, **savings timeline**, **affordability band** — her target sits in the stretch zone versus Sacramento median — **monthly payment stack**, **loan program checklist**, and **rate sensitivity** versus a seven point two five percent baseline."

**4:55–5:20 HMDA linked views *(Screenshot 2)***

"On the **county map**, colors use a **fixed thirty-eight to eighty-five percent** approval scale so hues are comparable statewide. I click **Sacramento**; the **scatter** and **income histogram** filter to that market.

I brush an income band on the histogram — scatter points filter, and **your profile** stays marked. Hovering a peer dot can highlight its county on the map. This is **bidirectional brushing** across three views."

**5:20–5:45 Model audit *(Screenshot 3)***

"In **model audit**, we show **test AUC near zero point eight zero** and **Brier near zero point zero six**. **Peer comparison** places Maya against approved Sacramento applicants.

The chart **What HMDA emphasized in training** uses **relative importance — percent of global SHAP magnitude**. That means: across roughly fifty-eight thousand California loans, how much each feature moved the model on average. **Debt-to-income is about sixty-nine percent** — by far the largest share. Down payment, loan size versus county, and income versus county median matter too, but less. This is **population-level** — not Maya’s profile. For her specifically, use **What moves your approval likelihood** next to the risk surface.

The **calibration** chart tracks predicted versus actual approval rates. On the **risk surface**, Maya sits in a green region at thirty-five percent DTI and about fifteen percent down; **local drivers** show which inputs would move her score. The score is **HMDA-calibrated probability**, not a personal loan guarantee."

**5:45–6:05 Scenario history & agent *(Screenshot 4 — optional)***

"I **save a scenario** and open **scenario history** to compare Sacramento versus other saved profiles — approval, DTI, and surplus side by side.

*(Optional)* I ask the agent, **‘What about my DTI?’** — it highlights the readiness or model section using the same numbers on screen."

**6:05–6:25 Fairness footer *(Screenshot 5)***

"The footer states **historical bias** in HMDA, that this is **not a lending decision**, which fields are **excluded from the score**, and **county calibration** bars for fairness review."

---

### 6:25 — Evaluation (70 sec) · Pranav

"On the evaluation slides: **test AUC about zero point eight zero**, balanced accuracy near **seventy-three percent**, **Brier about zero point zero six** — strong probability calibration. The calibration plot stays near the diagonal.

The **training patterns** slide repeats global feature weights: **relative importance as a percent of global SHAP magnitude** — DTI about sixty-nine percent on average across the training set. The live dashboard’s **scenario chart** shows **Maya’s** personal drivers, which can differ from those population averages.

Our four test personas: **Sofia** in Alameda scores ninety-four; **Arjun** in San Diego ninety-six; **Maya** in Sacramento ninety-seven; **Diego** in Los Angeles eight — same model, different inputs. **Maya** is our best live-demo story."

---

### 7:35 — Technical challenges (30 sec) · Vandana

"We handled **MongoDB fallback** to local JSON, **client-side rate sensitivity** when the API is offline, a **fixed county color scale** instead of relative quantiles, and **affordability band** layout so price labels do not overlap."

---

### 8:05 — Limitations (25 sec) · Lalitha

"ClariFi is **not financial advice**. Scoring uses **four California metro markets** in the API. HMDA reflects **past** applications, not future policy. Users should treat readiness as **exploration**, not approval."

---

### 8:30 — Division of labor (20 sec) · All

"Briefly: [Name] led ML and notebook export; [Name] frontend and D3; [Name] backend and integration; [Name] demo and documentation — adjust to your slide."

---

### 8:50 — Thank you (10 sec) · All

"Thank you for watching ClariFi. We’re happy to take questions on fairness, data, or the linked views."

---

## Why Maya for the demo (not Sofia or Diego)

| User | Why / why not |
|------|----------------|
| **Maya Gomez** ✓ | **Best for video:** “Good fit” Sacramento story, ~$560k target matches your UI screenshots, DTI in stretch band (35%), strong score with clear improvement path (save toward 20% down), all planning + HMDA + model panels look rich without looking “too easy.” |
| Sofia Chen | Very high income / Alameda — impressive but less relatable; scenario table makes her look unrealistically strong. |
| Arjun Patel | San Diego borderline — good second example; slightly more negative narrative. |
| Diego Rivera | LA constrained — better for limitations slide than hero demo. |

---

## Demo checklist (day of recording)

- [ ] Maya registered + CSV uploaded
- [ ] Simulator aligned with screenshots (~$10,750 / $805 / $82k / $560k)
- [ ] Sacramento selected on map; one histogram brush practiced
- [ ] One scenario saved for history table
- [ ] Deck regenerated; total runtime ≤ 9:00
- [ ] Practice **global SHAP vs. local drivers** line in model audit (~15 sec)
