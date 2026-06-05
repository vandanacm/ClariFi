# ClariFi — Final 9-minute video script

**Deck:** `docs/ECS273.pptx` (22 slides)  
**Team:** Lalitha Dasu · Pranav Manimaran · Vandana Mansur · Team 7  
**Format:** **~8:00 slides** → **~1:00 live UI** → hard stop at **9:00**  
**Live demo login:** Maya Gomez — `maya.sac@clarifi.test` / `Testpass123` · CSV: `sacramento_mid_income_transactions.csv`

---

## Flow at a glance

| Time | What | Slides |
|------|------|--------|
| 0:00–0:25 | Title | 1 |
| 0:25–1:35 | Intro + motivation | 2–3 |
| 1:35–2:50 | Data + related work | 4–5 |
| 2:50–4:10 | Method + architecture + implementation + layout | 6–9 |
| 4:10–6:10 | UI screenshots (embedded in deck) | 10–14 |
| 6:10–7:35 | Evaluation | 15–18 |
| 7:35–8:00 | Challenges + limitations + team + thanks | 19–22 |
| **8:00–9:00** | **Live browser demo** | *(no slides)* |

*Practice to **7:55** on slides so you have a clean handoff to the browser.*

---

## PART 1 — Slides (~8:00)

### Slide 1 · Title · 0:00–0:25 · Lalitha

"Hi — we’re **Lalitha, Pranav, and Vandana**, Team 7 for ECS 273. Our project is **ClariFi**: a California **mortgage readiness** dashboard that combines personal cashflow, HMDA market data, and a calibrated machine-learning model — all in one linked visual analytics interface."

---

### Slide 2 · Introduction · 0:25–0:55 · Lalitha

"ClariFi helps households **explore readiness before they apply**, not after a denial. The dashboard has **eighteen linked D3 views** — budget donut, planning panels, HMDA map and scatter, and a full model audit. The score is trained on about **fifty-eight thousand California HMDA loans**. Everything we show is **educational** — it is **not** a lending decision or financial advice."

---

### Slide 3 · Motivation · 0:55–1:35 · Lalitha

"Here’s the problem we kept hitting: **credit scores and Zillow prices don’t tell you regional approval context.** Two buyers with similar income can look fine on paper but sit in very different parts of the HMDA distribution depending on **county, loan size, and DTI**.

ClariFi puts **income, debt, savings, target price, and county-level HMDA patterns** in one place — and links them to a **calibrated approval likelihood** plus optional **AI explanations** when you ask what to improve."

---

### Slide 4 · Datasets & challenges · 1:35–2:15 · Lalitha

"Data-wise, we start from **HMDA 2025** — roughly **twelve million** national rows. We filtered to California, stratified about **five thousand rows per month**, and ended up near **fifty-eight thousand** training records. We also pull **BLS Consumer Expenditure** for peer spending benchmarks.

The hard parts were real: **class imbalance** — around ninety percent approvals in the sample — **keeping the Colab model and FastAPI in sync**, and **sparse counties** where we had to fall back to statewide averages for map color only."

---

### Slide 5 · Related work · 2:15–2:50 · Lalitha

"Affordability calculators give you a payment estimate but **not calibrated outcomes on real HMDA data**. Credit apps give you a personal score but **not how similar borrowers fared in your county**.

Our contribution is the combination: **XGBoost plus eighteen linked views**, a **budget-first** layout, and an **agent** that can highlight the chart section your question is about."

---

### Slide 6 · Methodology · 2:50–3:20 · Pranav

"We use **XGBoost** — about three hundred trees — with **isotonic calibration** on filtered California purchase loans. The score uses **DTI, LTV, down payment, loan versus county context** — and we **deliberately exclude interest rate** from the readiness score to avoid leakage.

For explainability we added a **risk grid** of real model predictions, **local perturbation** — what we show as scenario drivers — and **counterfactual suggestions**, like how much debt to cut to approach a thirty-six percent DTI band."

---

### Slide 7 · System architecture · 3:20–3:40 · Pranav

"Architecturally it’s a three-tier flow: **React and D3** on the client, **FastAPI** on the server loading the **joblib pipeline**, and **MongoDB Atlas** for users and saved scenarios — with a **local JSON fallback** if the network blocks Atlas. Static HMDA and BLS JSON live under the Vite public folder so charts load fast."

---

### Slide 8 · Notebook → API · 3:40–4:00 · Pranav

"Getting from notebook to live app was its own project. We used stratified splits — about **thirty-seven thousand train**, **nine thousand calibration**, **eleven point six thousand test**.

We exported **`scenario_inference_config.json`** so slider scenarios use the **same county medians and feature order** as training. The API rebuilds the feature frame in the **exact column order** the pipeline expects.

On the viz side, **county click filters scatter and histogram**; **income brushing** goes both ways. And for fairness: **age and sex are audit-only** — they never enter the readiness score."

---

### Slide 9 · Dashboard layout · 4:00–4:10 · Vandana

"Before we jump into the UI, the flow top to bottom is: **readiness score**, **budget mixer and cashflow**, **simulator and BLS peers**, **eight planning panels**, **linked HMDA map, scatter, and histogram**, then **model audit** and the **fairness footer**. One simulator drives almost everything — with a short debounce so it feels responsive without spamming the API."

---

### Slides 10–14 · UI screenshots in deck · 4:10–6:10 · Vandana

*Use your embedded screenshots; speak to what’s on screen. ~25 sec per slide.*

**Slide 10 — Readiness & budget mixer**

"This is our demo user **Maya** in Sacramento — readiness around **ninety-seven**, DTI near **thirty-five percent**. The **donut and sliders** are linked: move housing or debt and the **cashflow waterfall** and readiness metrics update together."

**Slide 11 — HMDA linked views**

"Here’s the **California county map** on a **fixed thirty-eight to eighty-five percent approval scale** — so colors are comparable statewide, not re-ranked every time. Click a county and the **scatter** and **income histogram** filter to that market; **your profile** stays marked. Brushing an income band on the histogram filters the scatter — that’s **bidirectional linking**."

**Slide 12 — Planning panels**

"The **what-if simulator** drives eight panels: **BLS peer benchmarks**, lender **DTI and down-payment gauges**, **counterfactual** savings suggestions, **affordability band** versus Sacramento median, **payment stack**, **loan programs**, and **rate sensitivity** around a seven point two five percent baseline."

**Slide 13 — Model audit**

"In model audit we show **test metrics**, **peer comparison** to approved Sacramento borrowers, and **what HMDA emphasized in training**. The axis **relative importance, percent of global SHAP magnitude** means: across all fifty-eight thousand loans, **how much each feature moved the model on average** — **DTI is about sixty-nine percent**. That’s **population-level**, not Maya’s profile.

For **her** inputs, use **what moves your approval likelihood** beside the **risk surface** — green cells are higher approval, red lower; **click a cell** to apply that DTI and down payment to the sliders."

**Slide 14 — Agent & scenario history**

"The **Ask ClariFi** agent turns model output into plain language — for example, saving toward twenty percent down. **Saved scenarios** persist per user; the table compares the **four most recent** saves by market, approval, DTI, and surplus. In a moment we’ll show this **live** in the browser."

---

### Slide 15 · Metrics · 6:10–6:30 · Pranav

"On evaluation: **test AUC zero point eight zero four**, **Brier zero point zero six three**, **balanced accuracy zero point seven three five** — we care about balanced accuracy because approvals dominate the dataset. Calibrated XGBoost clearly beats a logistic baseline on these hold-out rows."

---

### Slide 16 · Calibration · 6:30–6:45 · Pranav

"The calibration plot shows **predicted versus actual approval by score bin** — points hug the diagonal, which means when the model says seventy percent, roughly seventy percent of that bin were actually approved in HMDA. That’s what lets us show a readiness percentage users can interpret."

---

### Slide 17 · Training patterns · 6:45–7:00 · Pranav

"This slide repeats the global feature story: **SHAP magnitude as a percent of the total** — DTI dominates, then down payment and county-relative loan size. Again — **training patterns are global**; the dashboard’s **scenario chart** is **personal**."

---

### Slide 18 · Four personas · 7:00–7:20 · Pranav

"Same model, four test users — only inputs change. **Sofia** in Alameda: ninety-four. **Arjun** in San Diego: ninety-six. **Maya** in Sacramento: ninety-seven. **Diego** in Los Angeles: **eight** — high DTI, thin down payment. That contrast is intentional: the model reflects **historical HMDA patterns**, not ‘highest income always wins.’"

---

### Slide 19 · Technical challenges · 7:20–7:40 · Vandana

"Unexpected challenges we’d share with the next team: **MongoDB TLS** failing on some networks — we fall back to **local JSON** seeded from a template file. **Rate sensitivity and the risk grid** need the API — we added **client-side estimates** when offline. The county map needed a **fixed color scale** instead of relative quantiles. And **affordability band** labels had to move to a **legend below the bar** so price tags didn’t overlap."

---

### Slide 20 · Limitations · 7:40–7:50 · Lalitha

"Limitations: this is a **prototype**, not underwriting. Scoring uses **four metro markets** in the API while the map shows **all fifty-eight counties**. HMDA is **historical** — it doesn’t predict any one lender’s policy tomorrow. Future work: **full California LAR**, better **denial recall**, **per-county scoring**, and stronger **fairness reporting**."

---

### Slides 21–22 · Team & thank you · 7:50–8:00 · All

"Quick division of labor — Lalitha on motivation and narrative, Pranav on ML and backend, Vandana on dashboard and demo — everyone touched integration and the deck. **Thank you** — we’ll finish with a **one-minute live walkthrough**."

---

## PART 2 — Live demo (~1:00) · 8:00–9:00 · Vandana

**Before recording:** Backend on `:8001`, frontend on `:5173`, Maya logged in, CSV uploaded, simulator at ~**$10,750** income / **$805** debt / **$82k** savings / **$560k** price, **Sacramento** in header dropdown.

**8:00–8:15 · Readiness + budget**

"Live in ClariFi as Maya — readiness **ninety-seven**, DTI **thirty-five**. I drag **housing** on the budget mixer; watch the **donut and surplus** update."

**8:15–8:30 · HMDA link**

"I set **Los Angeles** in the header dropdown, then click **Sacramento** on the map — scatter and histogram filter. One **histogram brush** — linked filtering."

**8:30–8:45 · Model audit**

"Scroll to **model audit**: global chart — **DTI sixty-nine percent** of training influence. **Risk surface** — Maya in the green zone; **local drivers** on the right."

**8:45–9:00 · Save + close**

"**Save scenario** — header shows **Saved · Sacramento**. Scenario history shows the **latest four** with market and time. That’s ClariFi — thank you."

*Hard stop at 9:00.*

---

## Speaker cheat sheet

| Person | Slides | Live |
|--------|--------|------|
| **Lalitha** | 1–5, 20, 21–22 intro | — |
| **Pranav** | 6–8, 15–18 | — |
| **Vandana** | 9–14, 19 | 8:00–9:00 live |

---

## Day-of checklist

- [ ] Open `docs/ECS273.pptx` in Presenter View
- [ ] Browser tab ready: http://127.0.0.1:5173/dashboard · Maya logged in
- [ ] `uvicorn` + `npm run dev` running
- [ ] Rehearse slide portion to **7:55**; live portion to **0:55**
- [ ] Alt-Tab: slides → browser at **8:00** → optional return to slide 22 if time left

---

## One-line captions (if you add text to slides 10–14)

1. Readiness & budget — *Maya’s score, budget donut, and linked cashflow.*
2. HMDA views — *Fixed 38–85% map, scatter, and brushed histogram.*
3. Planning panels — *Simulator-driven BLS peers, DTI, affordability, and rates.*
4. Model audit — *Global SHAP training weights vs. personal risk surface.*
5. Agent & history — *Plain-language agent and saved scenario comparison.*
