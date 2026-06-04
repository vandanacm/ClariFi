# ClariFi — Exact 9-minute video script

**Reference:** `videoplayback.mp4` (FinSight ECS273 deck, ~10:30) — same slide style, trimmed to **9:00 hard stop**  
**Deck:** `docs/ClariFi_Video_Presentation.pptx` (College of Engineering template)  
**Team:** Lalitha · Pranav · Vandana

---

## Before you record

1. Regenerate deck: `.venv/bin/python scripts/build_video_presentation.py`
2. Optional screenshot: run app → save as `docs/presentation_assets/dashboard_screenshot.png` → regenerate deck
3. Terminal 1: `cd server && uvicorn main:app --host 127.0.0.1 --port 8001`
4. Terminal 2: `cd client && npm run dev`
5. Register **Maya** (`maya.sac@clarifi.test` / `Testpass123`) and upload `server/data/user_upload_pack/sacramento_mid_income_transactions.csv`
6. Screen recorder: 1920×1080, 30 fps, mic on
7. Practice once with a timer — target **8:55** finish

---

## Rubric timing (total 9:00)

| Time | Slide | Speaker | Rubric |
|------|-------|---------|--------|
| 0:00–0:25 | Title | Lalitha | Intro |
| 0:25–0:55 | Introduction | Lalitha | Motivation |
| 0:55–1:35 | Motivation & Problem | Lalitha | Motivation |
| 1:35–2:15 | Datasets & Challenges | Lalitha | Motivation / data |
| 2:15–2:50 | Related Work | Lalitha | Related work |
| 2:50–3:25 | Methodology | Pranav | Design |
| 3:25–3:50 | Architecture | Pranav | Design |
| 3:50–4:05 | Dashboard layout | Vandana | UI flow |
| 4:05–6:25 | **LIVE DEMO** | Vandana | Demo (2 pts) |
| 6:25–7:35 | Evaluation (4 slides) | Pranav | Evaluation (2 pts) |
| 7:35–8:05 | Technical Challenges | Vandana | Challenges (1 pt) |
| 8:05–8:30 | Limitations | Lalitha | Limitations (1 pt) |
| 8:30–8:50 | Division of Labor | All | Required |
| 8:50–9:00 | Thank you | All | End |

---

## What to say (condensed)

### 0:00 Title (25 sec)
"We are Lalitha, Pranav, and Vandana. Our project is **ClariFi** — a California mortgage readiness dashboard."

### 0:25 Introduction (30 sec)
"ClariFi combines personal cashflow, HMDA market data, and a calibrated XGBoost model in eighteen linked D3 views — starting with the budget donut. Educational only, not lending decisions."

### 0:55 Motivation (40 sec)
"Credit scores don't show regional approval context. We link income, debt, savings, and target price to what happened to similar HMDA applicants."

### 1:35 Datasets & Challenges (40 sec)
"HMDA 2025 has about twelve million rows nationally. We filtered to California and sampled about five thousand per month for roughly fifty-eight thousand training rows. Challenges include class imbalance, leakage control, and syncing the Colab model with our API."

### 2:15 Related Work (35 sec)
"Affordability tools and credit apps don't combine calibrated ML with linked HMDA visualizations — that's our contribution."

### 2:50 Methodology (35 sec)
"XGBoost with isotonic calibration. Features include DTI and LTV; we exclude interest rate and demographics from the score."

### 3:25 Architecture (25 sec)
"React and D3 client, FastAPI backend, joblib pipeline, MongoDB Atlas with local JSON fallback."

### 3:50 Dashboard layout (15 sec)
"Top to bottom: readiness score, budget mixer and cashflow, simulator, eight planning panels, linked HMDA map and scatter, then model audit."

### 4:05 LIVE DEMO (2 min 20 sec) — **record screen**
1. Login as Maya or Arjun (San Diego)
2. Readiness score + metrics
3. Budget mixer donut — move housing/debt sliders
4. Cashflow waterfall updates
5. Simulator sliders
6. County map (fixed 38–85% colors) — click county
7. Scatter + histogram brush
8. Risk surface — click cell
9. *(Optional)* Agent: "What about my DTI?"

**Say:** "The score is calibrated approval likelihood from HMDA, not a personal guarantee."

### 6:25 Evaluation (70 sec)
- Metrics: use values on slide (AUC ~0.80, Brier ~0.06)
- Calibration: "Points near the diagonal."
- Training patterns: "DTI dominates on fifty-eight thousand loans; your scenario chart shows personal drivers."
- Personas: "Sofia Alameda highest; Arjun San Diego; Maya Sacramento; Diego LA."

### 7:35 Challenges (30 sec)
"MongoDB fallback, client-side rate curve when API offline, fixed county color scale, affordability legend for overlapping prices."

### 8:05 Limitations (25 sec)
"Not financial advice. Four scoring metros. HMDA reflects past applications."

### 8:30 Division of Labor (20 sec)
Briefly point at table — who did ML, frontend, backend, demo.

### 8:50 Thank you (10 sec)
"Thank you for watching."

---

## How to assemble the final video

**Option A — Record in one take (recommended)**
1. Open `ClariFi_Video_Presentation.pptx` in Presenter View
2. Start screen + mic recording
3. Advance slides on script timing
4. On slide "Live System Demonstration": Alt-Tab to browser at http://127.0.0.1:5173/demo
5. Return to slides for evaluation through thank you
6. Trim only dead air at start/end — keep total ≤ 9:00

**Option B — Edit together**
1. Record slide narration separately (~6 min)
2. Record demo screen capture (~2.5 min)
3. Insert demo clip over slide 8 in iMovie / Premiere / DaVinci
4. Export MP4 ≤ 9:00

---

## FinSight vs ClariFi slide map

| FinSight (reference video) | ClariFi (our deck) |
|----------------------------|-------------------|
| Introduction | Introduction |
| Motivation & Problem | Motivation & Problem |
| Datasets & Challenges | Datasets & Challenges |
| Related Work | Related Work |
| Methodology & Algorithm | Methodology & Algorithm |
| System Architecture | System Architecture |
| Dashboard demo | Live System Demonstration |
| Investment plan demo | *(included in demo: map, risk surface, agent)* |
| Evaluation | Evaluation (metrics, calibration, training patterns, personas) |
| Limitations & Future Scope | Limitations & Future Scope |
| Division of Labor | Division of Labor |
