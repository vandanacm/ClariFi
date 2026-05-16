import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Bot, Database, Home, Landmark, LogIn, Upload } from "lucide-react";
import { api } from "./api";
import {
  BenchmarkBars,
  CalibrationChart,
  CashflowChart,
  ExpenseDonut,
  HmdaScatter
} from "./charts";
import type { BenchmarkModel, FinanceSummary, HmdaModel, ModelReport, ScenarioInput, ScoreResult } from "./types";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0
});

const compact = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3
});

const initialScenario: ScenarioInput = {
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
  }
};

const fallbackScore: ScoreResult = {
  mode: "browser-fallback",
  score: 72,
  approvalLikelihood: 0.68,
  monthlyHousing: 2964,
  monthlySurplus: 1661,
  dti: 0.448,
  downPaymentRate: 0.146,
  drivers: [
    { label: "Down payment", value: 0.146, direction: "negative" },
    { label: "Debt-to-income", value: 0.448, direction: "negative" },
    { label: "Monthly surplus", value: 1661, direction: "positive" }
  ]
};

function classForScore(score: number) {
  if (score >= 78) return "Ready to compete";
  if (score >= 62) return "Nearly ready";
  return "Needs a stronger buffer";
}

function scoreNarrative(score: ScoreResult) {
  if (score.dti > 0.38) {
    return "Debt plus projected housing cost is the main pressure point in this scenario.";
  }
  if (score.downPaymentRate < 0.18) {
    return "Down payment progress is improving, but the profile still needs a stronger savings buffer.";
  }
  return "This profile is close to approved-borrower patterns for the selected market.";
}

function metricText(value?: number | null, formatter: (value: number) => string = compact.format) {
  return value === null || value === undefined ? "n/a" : formatter(value);
}

function App() {
  const [activeSection, setActiveSection] = useState("readiness");
  const [scenario, setScenario] = useState<ScenarioInput>(initialScenario);
  const [score, setScore] = useState<ScoreResult>(fallbackScore);
  const [hmda, setHmda] = useState<HmdaModel | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkModel | null>(null);
  const [model, setModel] = useState<ModelReport | null>(null);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [agentAnswer, setAgentAnswer] = useState("Ask ClariFi to explain the current mortgage-readiness tradeoff.");
  const [apiOnline, setApiOnline] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("Upload CSV");

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [health, hmdaData, benchmarkData, modelData, financeData] = await Promise.all([
          api.health(),
          api.hmda(),
          api.benchmarks(),
          api.model(),
          api.financeSummary()
        ]);
        if (ignore) return;
        setApiOnline(health.ok);
        setHmda(hmdaData);
        setBenchmarks(benchmarkData);
        setModel(modelData);
        setFinanceSummary(financeData);
      } catch (error) {
        console.warn(error);
        setApiOnline(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function scoreScenario() {
      try {
        const result = await api.scoreMortgage(scenario);
        if (!ignore) {
          setScore(result);
          setApiOnline(true);
        }
      } catch (error) {
        console.warn(error);
        setApiOnline(false);
      }
    }

    scoreScenario();
    return () => {
      ignore = true;
    };
  }, [scenario]);

  const userBenchmarkValues = useMemo(() => ({
    housing: score.monthlyHousing,
    food: scenario.expenses.food,
    transport: scenario.expenses.transport,
    lifestyle: scenario.expenses.lifestyle,
    savings: Math.max(score.monthlySurplus + scenario.expenses.investing, 0)
  }), [scenario, score]);

  const modelDrivers = (model?.features ?? []).slice(0, 4);
  const markets = hmda ? Object.keys(hmda.markets) : ["Sacramento", "Alameda", "San Diego", "Los Angeles"];
  const market = hmda?.markets[scenario.market];

  function updateScenario<K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) {
    setScenario(current => ({ ...current, [key]: value }));
  }

  function updateNumericScenario(key: "income" | "debt" | "savings" | "price", value: number) {
    setScenario(current => ({ ...current, [key]: value }));
  }

  function updateExpense(key: keyof ScenarioInput["expenses"], value: number) {
    setScenario(current => ({
      ...current,
      expenses: {
        ...current.expenses,
        [key]: value
      }
    }));
  }

  async function askAgent() {
    try {
      const result = await api.explain("What should I focus on in this scenario?", scenario);
      setAgentAnswer(result.answer);
    } catch (error) {
      console.warn(error);
      setAgentAnswer("The API is offline, so ClariFi is using the local dashboard signals for now.");
    }
  }

  async function uploadTransactions(file?: File) {
    if (!file) return;
    setUploadStatus("Uploading...");
    try {
      const result = await api.uploadTransactions(file);
      setFinanceSummary(result.summary);
      setUploadStatus(`${result.imported} rows imported`);
    } catch (error) {
      console.warn(error);
      setUploadStatus("Upload failed");
    }
  }

  const nav = [
    { id: "readiness", label: "Readiness", icon: Home },
    { id: "finances", label: "Finances", icon: BarChart3 },
    { id: "hmda", label: "HMDA", icon: Landmark },
    { id: "model", label: "Model", icon: Database }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-mark">
          <span className="brand-symbol">C</span>
          <div>
            <p className="brand-name">ClariFi</p>
            <p className="brand-caption">AI-Guided Finance</p>
          </div>
        </div>

        <nav className="nav-stack">
          {nav.map(item => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${activeSection === item.id ? "active" : ""}`}
                type="button"
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  document.querySelector(`[data-section="${item.id}"]`)?.scrollIntoView({ block: "start" });
                }}
              >
                <span className="nav-icon"><Icon size={17} /></span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="profile-strip">
          <span className="profile-dot" />
          <div>
            <p className="profile-name">Demo Household</p>
            <p className="profile-meta">{scenario.market}, CA</p>
          </div>
        </div>
      </aside>

      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">React + D3 + FastAPI Visual Analytics</p>
            <h1>Can this household stay resilient and buy in its target market?</h1>
          </div>
          <div className="header-actions">
            <span className={`status-pill backend-status ${apiOnline ? "" : "alt"}`}>
              {apiOnline ? "FastAPI connected" : "Static fallback"}
            </span>
            <label className="select-label" htmlFor="marketSelect">Target market</label>
            <select
              id="marketSelect"
              className="market-select"
              value={scenario.market}
              onChange={event => updateScenario("market", event.target.value)}
            >
              {markets.map(item => <option key={item} value={item}>{item} County</option>)}
            </select>
          </div>
        </header>

        <section className="score-band app-section" data-section="readiness" aria-label="Readiness summary">
          <div className="score-panel">
            <div className="score-ring" aria-label="Mortgage readiness score">
              <svg viewBox="0 0 140 140" role="img">
                <circle className="ring-track" cx="70" cy="70" r="56" />
                <circle
                  className="ring-progress"
                  cx="70"
                  cy="70"
                  r="56"
                  style={{ strokeDashoffset: 352 - (score.score / 100) * 352 }}
                />
              </svg>
              <div className="score-center">
                <span>{score.score}</span>
                <small>/100</small>
              </div>
            </div>
            <div className="score-copy">
              <p className="panel-kicker">Mortgage readiness</p>
              <h2>{classForScore(score.score)}</h2>
              <p>{scoreNarrative(score)}</p>
            </div>
          </div>

          <div className="metric-grid">
            <article className="metric-tile">
              <span className="metric-label">Monthly income</span>
              <strong>{money.format(scenario.income)}</strong>
              <small>gross household</small>
            </article>
            <article className="metric-tile">
              <span className="metric-label">Monthly surplus</span>
              <strong>{money.format(score.monthlySurplus)}</strong>
              <small>after housing and expenses</small>
            </article>
            <article className="metric-tile">
              <span className="metric-label">Debt-to-income</span>
              <strong>{percent.format(score.dti)}</strong>
              <small>target below 36%</small>
            </article>
            <article className="metric-tile">
              <span className="metric-label">Approval likelihood</span>
              <strong>{percent.format(score.approvalLikelihood)}</strong>
              <small>{score.mode}</small>
            </article>
          </div>
        </section>

        <section className="finance-strip app-section" data-section="finances" aria-label="Personal finance controls">
          <article className="finance-card cashflow-card">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">D3 cashflow lens</p>
                <h2>Where monthly income goes</h2>
              </div>
              <span className={`status-pill ${score.monthlySurplus < 0 ? "danger" : ""}`}>
                {score.monthlySurplus >= 0 ? "Positive buffer" : "Over budget"}
              </span>
            </div>
            <CashflowChart scenario={scenario} score={score} />
          </article>

          <article className="finance-card expense-card">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Budget mixer</p>
                <h2>Tune flexible spending</h2>
              </div>
              <strong className={`surplus-value ${score.monthlySurplus < 0 ? "negative" : ""}`}>
                {money.format(score.monthlySurplus)}
              </strong>
            </div>
            <div className="budget-layout">
              <ExpenseDonut scenario={scenario} score={score} />
              <div className="mini-slider-stack">
                {(["food", "transport", "lifestyle", "investing"] as const).map(key => (
                  <label className="mini-range-row" key={key}>
                    <span>{key} <strong>{money.format(scenario.expenses[key])}</strong></span>
                    <input
                      type="range"
                      min={key === "investing" ? 0 : 100}
                      max={key === "investing" ? 3200 : 2200}
                      step={25}
                      value={scenario.expenses[key]}
                      onChange={event => updateExpense(key, Number(event.target.value))}
                    />
                  </label>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="workspace-grid">
          <article className="analysis-panel agent-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Explainer agent</p>
                <h2>Ask ClariFi</h2>
              </div>
              <button className="icon-action" type="button" title="Ask the agent" onClick={askAgent}>
                <Bot size={17} />
              </button>
            </div>
            <div className="agent-summary">
              <span>Current guidance</span>
              <strong>{agentAnswer}</strong>
            </div>
            <div className="agent-list">
              {score.drivers.map(driver => (
                <article className="agent-card" key={driver.label}>
                  <span>{driver.direction === "positive" ? "Strength" : "Risk"}</span>
                  <strong>{driver.label}</strong>
                  <small>{typeof driver.value === "number" ? compact.format(driver.value) : driver.value}</small>
                </article>
              ))}
            </div>
          </article>

          <article className="analysis-panel benchmark-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">BLS peer benchmark</p>
                <h2>Spending vs. similar households</h2>
              </div>
              <span className="status-pill muted">{benchmarks?.source.name ?? "Loading"}</span>
            </div>
            {benchmarks && (
              <>
                <div className="benchmark-meta">
                  <span>Peer group</span><strong>{benchmarks.peerGroup.label}</strong>
                  <span>Region</span><strong>{benchmarks.peerGroup.region}</strong>
                  <span>Income band</span><strong>{money.format(benchmarks.peerGroup.annualIncome)}/yr</strong>
                </div>
                <BenchmarkBars categories={benchmarks.categories} userValues={userBenchmarkValues} />
              </>
            )}
          </article>

          <article className="analysis-panel simulator-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">What-if simulator</p>
                <h2>Adjust the buyer profile</h2>
              </div>
              <span className="status-pill">Scenario synced</span>
            </div>
            <div className="slider-stack">
              {[
                ["income", "Monthly income", 4500, 18000, 100],
                ["debt", "Monthly debt", 0, 4200, 50],
                ["savings", "Current savings", 10000, 220000, 1000],
                ["price", "Target home price", 320000, 1200000, 5000]
              ].map(([key, label, min, max, step]) => (
                <label className="range-row" key={key}>
                  <span>{label}<strong>{money.format(scenario[key as keyof ScenarioInput] as number)}</strong></span>
                  <input
                    type="range"
                    min={min as number}
                    max={max as number}
                    step={step as number}
                    value={scenario[key as keyof ScenarioInput] as number}
                    onChange={event => updateNumericScenario(key as "income" | "debt" | "savings" | "price", Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
            <label className="upload-button">
              <Upload size={16} />
              <span>{uploadStatus}</span>
              <input type="file" accept=".csv" onChange={event => uploadTransactions(event.target.files?.[0])} />
            </label>
          </article>
        </section>

        <section className="hmda-grid app-section" data-section="hmda" aria-label="HMDA comparison">
          <article className="analysis-panel wide-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">HMDA borrower comparison</p>
                <h2>Income and loan amount context</h2>
              </div>
              <span className="status-pill muted">{hmda?.source.name ?? "Loading HMDA"}</span>
            </div>
            {hmda && <HmdaScatter hmda={hmda} scenario={scenario} />}
          </article>

          <article className="analysis-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">County readiness</p>
                <h2>{scenario.market} peers</h2>
              </div>
              <span className="status-pill">{market ? money.format(market.priceMedian) : "n/a"} median</span>
            </div>
            <div className="county-map">
              {(market?.counties ?? []).map(county => (
                <button className="county-cell" type="button" key={county.name}>
                  <strong>{county.name}</strong>
                  <span>{county.readiness}/100</span>
                  <small>{percent.format(county.approvalRate ?? 0)} approved · {county.applications ?? 0} apps</small>
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="model-grid app-section" data-section="model" aria-label="Model audit">
          <article className="analysis-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Model audit</p>
                <h2>{model?.modelName ?? "Loading model"}</h2>
              </div>
              <span className="status-pill muted">HMDA 2025</span>
            </div>
            <div className="model-meta">
              <span>Rows</span><strong>{model ? model.rows.total.toLocaleString() : "n/a"}</strong>
              <span>AUC</span><strong>{metricText(model?.metrics.testAuc)}</strong>
              <span>Balanced accuracy</span><strong>{metricText(model?.metrics.balancedAccuracy, percent.format)}</strong>
              <span>Brier score</span><strong>{metricText(model?.metrics.brierScore)}</strong>
              <span>Denied recall</span><strong>{metricText(model?.metrics.denialRecall, percent.format)}</strong>
            </div>
            <p className="model-note"><AlertTriangle size={15} /> {model?.note}</p>
          </article>

          <article className="analysis-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">SHAP drivers</p>
                <h2>Top model signals</h2>
              </div>
            </div>
            <div className="driver-list">
              {modelDrivers.map(feature => (
                <div className="driver-row" key={feature.feature}>
                  <header>
                    <span>{feature.label}</span>
                    <strong>{feature.coefficient > 0 ? "+" : ""}{compact.format(feature.coefficient)} SHAP</strong>
                  </header>
                  <div className="bar-track">
                    <div className={`bar-fill ${feature.direction}`} style={{ width: `${Math.max(feature.magnitude / (modelDrivers[0]?.magnitude ?? 1), 0.08) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="analysis-panel wide-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Calibration</p>
                <h2>Predicted vs. actual approval rates</h2>
              </div>
            </div>
            {model && <CalibrationChart report={model} />}
          </article>
        </section>

        <section className="integration-strip">
          <LogIn size={17} />
          <strong>Next backend mode:</strong>
          <span>Add MongoDB Atlas URI and copy the Colab `.joblib` files into `public/data/model_outputs` for live XGBoost inference.</span>
        </section>
      </main>
    </div>
  );
}

export default App;
