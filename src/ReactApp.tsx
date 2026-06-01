import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, Bot, Database, Home, Landmark, LogIn, LogOut, Moon, Navigation, Sun, Upload, UserPlus } from "lucide-react";
import { api } from "./api";
import { AuthModal } from "./Login";
import { Landing } from "./Landing";
import { Onboarding } from "./Onboarding";
import {
  BenchmarkBars,
  CalibrationChart,
  CashflowChart,
  ChoroplethMap,
  CountyCalibrationChart,
  ExpenseDonut,
  HmdaScatter,
  IncomeHistogram,
  RiskSurface
} from "./charts";
import type {
  BenchmarkModel,
  FinanceSummary,
  HmdaModel,
  ModelReport,
  ScenarioInput,
  ScoreResult
} from "./types";

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

function formatExplainerLabel(mode: string, loading: boolean): string {
  if (loading) return "Thinking…";
  if (mode === "openrouter-rate-limited") return "OpenRouter · rate limited";
  if (mode === "rule-based") return "Template · LLM offline";
  if (mode === "offline") return "Offline";
  if (mode.startsWith("openrouter/")) return `OpenRouter · ${mode.replace("openrouter/", "")}`;
  return mode;
}

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

function scenarioBudgetContext(scenario: ScenarioInput): ScoreResult {
  const monthlyHousing = Math.round((scenario.price - scenario.savings) * 0.0062);
  const flexible =
    scenario.expenses.food +
    scenario.expenses.transport +
    scenario.expenses.lifestyle +
    scenario.expenses.investing;
  const monthlySurplus = Math.round(scenario.income - scenario.debt - monthlyHousing - flexible);
  const dti = Number(((scenario.debt + monthlyHousing) / Math.max(scenario.income, 1)).toFixed(3));
  const downPaymentRate = Number((scenario.savings / Math.max(scenario.price, 1)).toFixed(3));
  return {
    mode: "pending",
    modelReady: false,
    score: null,
    approvalLikelihood: null,
    monthlyHousing,
    monthlySurplus,
    dti,
    downPaymentRate,
    drivers: [
      { label: "Down payment", value: downPaymentRate, direction: downPaymentRate >= 0.18 ? "positive" : "negative" },
      { label: "Debt-to-income", value: dti, direction: dti > 0.36 ? "negative" : "positive" },
      { label: "Monthly surplus", value: monthlySurplus, direction: monthlySurplus >= 0 ? "positive" : "negative" }
    ]
  };
}

function isModelScore(score: ScoreResult) {
  return score.modelReady === true || score.mode === "calibrated-xgboost";
}

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

async function fetchStaticJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

function hintsFromFinance(summary: FinanceSummary): Partial<ScenarioInput> {
  if (summary.transactionCount === 0) return {};
  const totals = summary.categoryTotals;
  const hints: Partial<ScenarioInput> = {};

  const income = summary.monthlyIncomeObserved;
  if (income > 0) hints.income = Math.round(income);

  const debt = Math.abs(totals["debt"] ?? 0);
  if (debt > 0) hints.debt = Math.round(debt);

  const food = Math.abs(totals["food"] ?? 0);
  const transport = Math.abs(totals["transport"] ?? totals["transportation"] ?? 0);
  const lifestyle = Math.abs(totals["lifestyle"] ?? totals["entertainment"] ?? totals["shopping"] ?? 0);
  const investing = Math.abs(totals["savings"] ?? totals["investing"] ?? totals["investment"] ?? 0);

  if (food > 0 || transport > 0 || lifestyle > 0 || investing > 0) {
    hints.expenses = {
      food: food || 900,
      transport: transport || 525,
      lifestyle: lifestyle || 850,
      investing: investing || 1100
    };
  }
  return hints;
}

function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("clarifi_theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("clarifi_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  const [activeSection, setActiveSection] = useState("readiness");
  const [scenario, setScenario] = useState<ScenarioInput>(initialScenario);
  const [score, setScore] = useState<ScoreResult>(() => scenarioBudgetContext(initialScenario));
  const [hmda, setHmda] = useState<HmdaModel | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkModel | null>(null);
  const [model, setModel] = useState<ModelReport | null>(null);
  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [agentAnswer, setAgentAnswer] = useState("Ask ClariFi to explain the current mortgage-readiness tradeoff.");
  const [agentHighlight, setAgentHighlight] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState("local AI");
  const [agentQuestion, setAgentQuestion] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [modelArtifactPresent, setModelArtifactPresent] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [openRouterConfigured, setOpenRouterConfigured] = useState(false);
  const [openRouterModel, setOpenRouterModel] = useState<string | null>(null);
  const [hmdaChartRows, setHmdaChartRows] = useState(48);
  const [hmdaRawRows, setHmdaRawRows] = useState<number | null>(null);
  const [modelTrainingRows, setModelTrainingRows] = useState<number | null>(null);
  const [databaseConnected, setDatabaseConnected] = useState(false);
  const [databaseMode, setDatabaseMode] = useState("local-json");
  const [selectedHmdaCounty, setSelectedHmdaCounty] = useState<string | null>(null);
  const [brushedIncome, setBrushedIncome] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState("Upload CSV");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(!!api.getToken());
  const [showAuth, setShowAuth] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [hoveredExpenseKey, setHoveredExpenseKey] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      const settled = await Promise.allSettled([
        api.health(),
        api.hmda(),
        api.benchmarks(),
        api.model(),
        api.financeSummary().catch(() => ({
          transactionCount: 0,
          monthlyIncomeObserved: 0,
          monthlyOutflowObserved: 0,
          netCashflowObserved: 0,
          categoryTotals: {}
        } satisfies FinanceSummary)),
        ...(api.getToken() ? [api.me().catch(() => { api.clearToken(); return null; })] : [])
      ]);

      if (ignore) return;

      const health = settled[0].status === "fulfilled" ? settled[0].value : null;
      const hmdaData = settled[1].status === "fulfilled"
        ? settled[1].value
        : await fetchStaticJson<HmdaModel>("/data/hmda_processed.json");
      const benchmarkData = settled[2].status === "fulfilled"
        ? settled[2].value
        : await fetchStaticJson<BenchmarkModel>("/data/bls_benchmarks.json");
      const modelData = settled[3].status === "fulfilled"
        ? settled[3].value
        : await fetchStaticJson<ModelReport>("/data/model_report.json");
      const financeData = settled[4].status === "fulfilled"
        ? settled[4].value
        : { transactionCount: 0, monthlyIncomeObserved: 0, monthlyOutflowObserved: 0, netCashflowObserved: 0, categoryTotals: {} } satisfies FinanceSummary;
      const meData = settled[5]?.status === "fulfilled"
        ? settled[5].value as { user: AuthUser } | null | undefined
        : undefined;

      setApiOnline(Boolean(health?.ok));
      setModelArtifactPresent(Boolean(health?.modelArtifactPresent));
      setModelLoaded(Boolean(health?.modelLoaded));
      setOpenRouterConfigured(Boolean(health?.openRouterConfigured));
      setOpenRouterModel(health?.openRouterModel ?? null);
      setHmdaChartRows(health?.hmdaChart?.scatterRows ?? hmdaData?.source?.scatterRows ?? 48);
      setHmdaRawRows(health?.hmdaChart?.rawRows ?? hmdaData?.source?.rawRows ?? null);
      setModelTrainingRows(health?.modelTraining?.rowsTotal ?? modelData?.rows?.total ?? null);
      setDatabaseMode(health?.databaseStatus?.mode ?? health?.database ?? "local-json");
      setDatabaseConnected(Boolean(health?.databaseStatus?.connected ?? health?.database === "mongodb"));
      if (hmdaData) setHmda(hmdaData);
      if (benchmarkData) setBenchmarks(benchmarkData);
      if (modelData) setModel(modelData);
      setFinanceSummary(financeData);
      if (meData?.user) {
        setAuthUser(meData.user);
        const hints = hintsFromFinance(financeData);
        if (Object.keys(hints).length > 0) {
          setScenario(current => ({
            ...current,
            ...hints,
            expenses: hints.expenses ?? current.expenses
          }));
        }
      }
      setAuthLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setSelectedHmdaCounty(null);
    setBrushedIncome(null);
  }, [scenario.market]);

  useEffect(() => {
    let ignore = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.scoreMortgage(scenario);
        if (!ignore) {
          setScore(result);
          setApiOnline(true);
        }
      } catch (error) {
        console.warn(error);
        if (!ignore) {
          setScore({
            ...scenarioBudgetContext(scenario),
            mode: "model-unavailable",
            modelReady: false,
            message: "Could not reach the scoring API."
          });
          setApiOnline(false);
        }
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [scenario]);

  useEffect(() => {
    if (pathname === "/demo") {
      setScenario(initialScenario);
      setFinanceSummary(null);
      setUploadStatus("Upload CSV");
    }
  }, [pathname]);

  const userBenchmarkValues = useMemo(() => ({
    housing: score.monthlyHousing,
    food: scenario.expenses.food,
    transport: scenario.expenses.transport,
    lifestyle: scenario.expenses.lifestyle,
    savings: Math.max(score.monthlySurplus + scenario.expenses.investing, 0)
  }), [scenario, score]);

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

  async function onAuthSuccess(user: AuthUser) {
    setAuthUser(user);
    setShowAuth(false);
    navigate("/dashboard");
    try {
      const financeData = await api.financeSummary();
      setFinanceSummary(financeData);
      if (financeData.transactionCount === 0) {
        setShowOnboarding(true);
      } else {
        const hints = hintsFromFinance(financeData);
        if (Object.keys(hints).length > 0) {
          setScenario(current => ({
            ...current,
            ...hints,
            expenses: hints.expenses ?? current.expenses
          }));
        }
      }
    } catch {}
  }

  function onOnboardingComplete(summary: import("./types").FinanceSummary | null, hints: Partial<import("./types").ScenarioInput>) {
    setShowOnboarding(false);
    if (summary) setFinanceSummary(summary);
    if (Object.keys(hints).length > 0) {
      setScenario(current => ({
        ...current,
        ...hints,
        expenses: hints.expenses ?? current.expenses
      }));
    }
  }

  function logout() {
    api.clearToken();
    setAuthUser(null);
    setFinanceSummary(null);
    navigate("/");
  }

  async function askAgent(question = "What should I focus on to improve my mortgage readiness?") {
    setAgentLoading(true);
    try {
      const result = await api.explain(question, scenario);
      setAgentAnswer(result.answer);
      setAgentMode(result.agentMode ?? "local AI");
      if (result.highlight) {
        triggerHighlight(result.highlight);
      }
    } catch (error) {
      console.warn(error);
      setAgentAnswer("The API is offline — ClariFi is using local dashboard signals for now.");
      setAgentMode("offline");
    } finally {
      setAgentLoading(false);
    }
  }

  function triggerHighlight(section: string) {
    setAgentHighlight(section);
    const el = document.querySelector(`[data-section="${section}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setAgentHighlight(null), 3000);
  }

  async function uploadTransactions(file?: File) {
    if (!file) return;
    setUploadStatus("Uploading...");
    try {
      const result = await api.uploadTransactions(file);
      setFinanceSummary(result.summary);
      const hints = hintsFromFinance(result.summary);
      if (Object.keys(hints).length > 0) {
        setScenario(current => ({
          ...current,
          ...hints,
          expenses: hints.expenses ?? current.expenses
        }));
      }
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

  if (pathname === "/" || pathname === "") {
    if (authLoading) return null;
    if (authUser) return <Navigate to="/dashboard" replace />;
    return (
      <>
        {showAuth && <AuthModal onSuccess={onAuthSuccess} onClose={() => setShowAuth(false)} />}
        <Landing 
          onSignIn={() => setShowAuth(true)} 
          onDemo={() => navigate("/demo")} 
          theme={theme}
          toggleTheme={toggleTheme}
        />
      </>
    );
  }

  if (pathname === "/dashboard") {
    if (authLoading) return null;
    if (!authUser) return <Navigate to="/" replace />;
  }

  const isDemo = pathname === "/demo";

  return (
    <>
    {showAuth && <AuthModal onSuccess={onAuthSuccess} onClose={() => setShowAuth(false)} />}
    {showOnboarding && authUser && <Onboarding userName={authUser.name} onComplete={onOnboardingComplete} />}
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-mark" onClick={() => navigate("/")} style={{ cursor: "pointer" }} title="Go to landing page">
          <span className="brand-symbol">
            <img src="/logo.png" alt="ClariFi Logo" />
          </span>
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

        <div className="theme-toggle-container">
          <span className="theme-toggle-label">
            {theme === "light" ? <Sun size={14} style={{ color: "#f4c95d" }} /> : <Moon size={14} style={{ color: "#60a5fa" }} />}
            <span>Theme</span>
          </span>
          <label className="theme-toggle-switch" htmlFor="themeCheckbox" title="Toggle Light/Dark Theme">
            <input
              id="themeCheckbox"
              type="checkbox"
              checked={theme === "dark"}
              onChange={toggleTheme}
            />
            <span className="theme-toggle-slider">
              <Sun size={10} style={{ color: "rgba(255, 255, 255, 0.4)" }} />
              <Moon size={10} style={{ color: "rgba(255, 255, 255, 0.4)" }} />
            </span>
          </label>
        </div>

        <div className="profile-strip">
          <span className="profile-dot" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="profile-name">{authUser?.name ?? "Demo Household"}</p>
            <p className="profile-meta">{authUser?.email ?? `${scenario.market}, CA`}</p>
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
            <div className="header-top-row">
              <span className={`status-pill backend-status ${apiOnline ? "" : "alt"}`}>
                {apiOnline
                  ? [
                      isModelScore(score) || modelLoaded
                        ? "XGBoost live"
                        : modelArtifactPresent
                          ? "Model loading"
                          : "No model",
                      openRouterConfigured && openRouterModel
                        ? openRouterModel.split("/").pop()?.replace(":free", "") ?? "LLM"
                        : null
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "API offline"}
              </span>
              <div className="header-controls">
                {authUser ? (
                  <>
                    <label className="header-action-btn" title="Upload new transaction CSV">
                      <Upload size={14} />
                      <span>{uploadStatus}</span>
                      <input type="file" accept=".csv" onChange={event => uploadTransactions(event.target.files?.[0])} />
                    </label>
                    <button className="header-action-btn" type="button" onClick={logout} title={`Sign out ${authUser.name}`}>
                      <LogOut size={14} />
                      <span>Sign out</span>
                    </button>
                  </>
                ) : (
                  <button className="header-signup-btn" type="button" onClick={() => setShowAuth(true)}>
                    <UserPlus size={15} />
                    Sign up free
                  </button>
                )}
              </div>
            </div>
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

        {isDemo && (
          <div className="demo-banner">
            <span className="demo-banner-badge">Demo</span>
            <span>You're viewing sample data. Sign in to connect real transactions and save your scenarios.</span>
            <button className="demo-banner-btn" type="button" onClick={() => setShowAuth(true)}>
              Sign in / Register →
            </button>
          </div>
        )}

        <div className="data-source-banner" role="note" aria-label="Runtime data sources">
          <span className="data-source-badge">Sources</span>
          <span className="data-source-copy">
            HMDA charts: {hmdaRawRows
              ? `${hmdaRawRows.toLocaleString()} CA applications (${hmdaChartRows.toLocaleString()} scatter sample)`
              : `${hmdaChartRows}-row teaching sample`}
            {" · "}
            Scoring: {isModelScore(score)
              ? `HMDA XGBoost · ${modelTrainingRows?.toLocaleString() ?? "58k"} CA training rows`
              : modelLoaded
                ? "XGBoost loaded — scoring…"
                : modelArtifactPresent
                  ? "XGBoost artifact present — restart API if score stays empty"
                  : "XGBoost model not loaded (add joblib from Colab)"}
            {" · "}
            Store: {databaseMode === "mongodb" && databaseConnected ? "MongoDB Atlas" : "local JSON"}
            {" · "}
            Explainer: {openRouterConfigured && openRouterModel
              ? `OpenRouter · ${openRouterModel.split("/").pop()?.replace(":free", "") ?? openRouterModel}`
              : "template when LLM offline"}
          </span>
        </div>

        <section className={`score-band app-section${agentHighlight === "readiness" ? " section-highlighted" : ""}`} data-section="readiness" aria-label="Readiness summary">
          <div className="score-panel">
            <div className="score-ring" aria-label="Mortgage readiness score">
              <svg viewBox="0 0 140 140" role="img">
                <circle className="ring-track" cx="70" cy="70" r="56" />
                <circle
                  className="ring-progress"
                  cx="70"
                  cy="70"
                  r="56"
                  style={{
                    strokeDashoffset:
                      isModelScore(score) && score.score != null
                        ? 352 - (score.score / 100) * 352
                        : 352
                  }}
                />
              </svg>
              <div className="score-center">
                <span>
                  {isModelScore(score) && score.score != null ? score.score : "—"}
                </span>
                <small>/100</small>
              </div>
            </div>
            <div className="score-copy">
              <p className="panel-kicker">Mortgage readiness</p>
              <h2>
                {isModelScore(score) && score.score != null
                  ? classForScore(score.score)
                  : "Model score pending"}
              </h2>
              <p>{scoreNarrative(score)}</p>
              {!isModelScore(score) && score.message && (
                <p className="panel-note model-unavailable-note" role="status">
                  {score.message}
                </p>
              )}
              <p className="panel-note">
                The 0–100 score is the calibrated HMDA XGBoost approval probability for your scenario (income, debt,
                savings, home price, and county). Cash-flow tiles use the same sliders only.
              </p>
              <p className="panel-note">
                <strong>Approval likelihood</strong> is the same model output, shown as a percent. For learning only —
                not a credit decision, prequalification, or legal advice.
              </p>
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
              <strong>
                {isModelScore(score) && score.approvalLikelihood != null
                  ? percent.format(score.approvalLikelihood)
                  : "—"}
              </strong>
              <small>{isModelScore(score) ? "HMDA XGBoost model" : "Model not available"}</small>
            </article>
          </div>
        </section>

        <section className={`finance-strip app-section${agentHighlight === "finances" ? " section-highlighted" : ""}`} data-section="finances" aria-label="Personal finance controls">
          <article className="finance-card cashflow-card">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">D3 cashflow lens</p>
                <h2>Where monthly income goes</h2>
                <p className="panel-note">
                  Monthly waterfall from your scenario: green = money in, red = housing, debt, and flexible spending out;
                  the last bar is surplus (income left after those costs).
                </p>
                <p className="panel-note">
                  Hover any bar for the exact amount. Values follow the sliders below unless a CSV upload pre-filled them.
                </p>
                {financeSummary && financeSummary.monthsObserved != null && financeSummary.monthsObserved > 0 && (
                  <p className="panel-note">
                    Upload context: averaged {financeSummary.monthsObserved} month{financeSummary.monthsObserved === 1 ? "" : "s"} of CSV data
                    {financeSummary.monthlyIncomeObserved > 0
                      ? ` · ${money.format(financeSummary.monthlyIncomeObserved)}/mo observed income`
                      : ""}
                    .
                  </p>
                )}
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
                <p className="panel-note">
                  Donut shows how your flexible monthly outflow splits across food, transport, lifestyle, and investing
                  (center total excludes housing and debt, which are in the cashflow chart).
                </p>
                <p className="panel-note">
                  Use sliders or type dollar amounts to run what-if budgets; surplus in the corner updates readiness above.
                </p>
              </div>
              <strong className={`surplus-value ${score.monthlySurplus < 0 ? "negative" : ""}`}>
                {money.format(score.monthlySurplus)}
              </strong>
            </div>
            <div className="budget-layout">
              <ExpenseDonut
                scenario={scenario}
                score={score}
                hoveredKey={hoveredExpenseKey}
                onHoverChange={setHoveredExpenseKey}
              />
              <div className="mini-slider-stack">
                {(["food", "transport", "lifestyle", "investing"] as const).map(key => (
                  <div
                    className={`mini-range-row${hoveredExpenseKey === key ? " row-highlighted" : ""}`}
                    key={key}
                    onMouseEnter={() => setHoveredExpenseKey(key)}
                    onMouseLeave={() => setHoveredExpenseKey(null)}
                    onClick={() => setHoveredExpenseKey(hoveredExpenseKey === key ? null : key)}
                  >
                    <div className="range-header">
                      <span className="range-label-text" style={{ textTransform: "capitalize" }}>{key}</span>
                      <label className="value-input-wrap">
                        <span className="value-currency">$</span>
                        <input
                          className="value-input"
                          type="number"
                          defaultValue={scenario.expenses[key]}
                          key={`exp-${key}-${scenario.expenses[key]}`}
                          min={0}
                          onBlur={e => {
                            const v = Number(e.target.value);
                            if (!isNaN(v) && v >= 0) updateExpense(key, v);
                          }}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          style={{ width: 60 }}
                        />
                      </label>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={key === "investing" ? 5000 : 3000}
                      step={25}
                      value={scenario.expenses[key]}
                      onChange={event => updateExpense(key, Number(event.target.value))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="workspace-grid">
          <article className="analysis-panel benchmark-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">BLS peer benchmark</p>
                <h2>Spending vs. similar households</h2>
                <p className="panel-note">
                  Compares your scenario spending to a Bureau of Labor Statistics peer group with a similar income band and region.
                </p>
                <p className="panel-note">
                  Each row: gray bar = typical peer monthly spend, colored bar = your scenario. Savings above peer is positive;
                  spending well above peer on needs may tighten your mortgage buffer.
                </p>
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
                <p className="panel-note">
                  Main inputs for the whole dashboard: income, debt, savings, and target home price. Every chart and score
                  on this page reacts to these sliders.
                </p>
                <p className="panel-note">
                  Use the target market dropdown in the header to switch HMDA comparison regions (Sacramento, Alameda, etc.).
                </p>
              </div>
              <span className="status-pill">Scenario synced</span>
            </div>
            <div className="slider-stack">
              {[
                ["income", "Monthly income", 0, 30000, 100],
                ["debt", "Monthly debt", 0, 8000, 50],
                ["savings", "Current savings", 0, 500000, 1000],
                ["price", "Target home price", 100000, 2000000, 5000]
              ].map(([key, label, min, max, step]) => (
                <div className="range-row" key={key as string}>
                  <div className="range-header">
                    <span className="range-label-text">{label as string}</span>
                    <label className="value-input-wrap">
                      <span className="value-currency">$</span>
                      <input
                        className="value-input"
                        type="number"
                        defaultValue={scenario[key as keyof ScenarioInput] as number}
                        key={`si-${key}-${scenario[key as keyof ScenarioInput]}`}
                        min={min as number}
                        max={max as number}
                        onBlur={e => {
                          const v = Number(e.target.value);
                          if (!isNaN(v) && v >= 0) updateNumericScenario(key as "income" | "debt" | "savings" | "price", Math.max(min as number, Math.min(max as number, v)));
                        }}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                    </label>
                  </div>
                  <input
                    type="range"
                    min={min as number}
                    max={max as number}
                    step={step as number}
                    value={scenario[key as keyof ScenarioInput] as number}
                    onChange={event => updateNumericScenario(key as "income" | "debt" | "savings" | "price", Number(event.target.value))}
                  />
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className={`hmda-grid app-section${agentHighlight === "hmda" ? " section-highlighted" : ""}`} data-section="hmda" aria-label="HMDA comparison">
          <article className="analysis-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">HMDA approval by county</p>
                <h2>Historical approval rate by county</h2>
                <p className="panel-note">
                  All 58 California counties are shown. Color = HMDA approval rate in our sample (red = lower, green = higher).
                  Counties with very few local applications use a lighter shade and may show statewide average — see tooltip.
                </p>
                <p className="panel-note">
                  Click any county to filter the charts below and jump to its primary market. Teal outline = selected.
                </p>
              </div>
              <span className="status-pill muted">{hmda?.source.name ?? "Loading HMDA"}</span>
            </div>
            {hmda && (
              <ChoroplethMap
                hmda={hmda}
                scenario={scenario}
                selectedCounty={selectedHmdaCounty}
                onCountySelect={setSelectedHmdaCounty}
                onMarketSelect={marketName => updateScenario("market", marketName)}
              />
            )}
          </article>

          <article className="analysis-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">HMDA borrower comparison</p>
                <h2>Income vs. loan — {selectedHmdaCounty ?? scenario.market}</h2>
                <p className="panel-note">
                  Each dot is one past application in this market: horizontal axis = monthly income,
                  vertical axis = loan amount. Teal = approved, pink = denied.
                </p>
                <p className="panel-note">
                  <strong>Your profile</strong> marks your scenario from the sliders (income, price, savings).
                  It is compared to peers — it is not your personal approval decision.
                </p>
              </div>
              <span className="status-pill">{market ? money.format(market.priceMedian) : "n/a"} median</span>
            </div>
            {selectedHmdaCounty && (
              <button className="link-filter-btn" type="button" onClick={() => setSelectedHmdaCounty(null)}>
                Clear county filter · {selectedHmdaCounty}
              </button>
            )}
            {hmda && (
              <HmdaScatter
                hmda={hmda}
                scenario={scenario}
                selectedCounty={selectedHmdaCounty}
                brushedIncome={brushedIncome}
              />
            )}
          </article>

          <article className="analysis-panel wide-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Income distribution</p>
                <h2>Approved vs. denied — {selectedHmdaCounty ?? scenario.market}</h2>
                <p className="panel-note">
                  Each bar is a monthly-income band for past HMDA loan applications in this market.
                  <strong> Teal (bottom)</strong> = applications that were <strong>approved</strong>.
                  <strong> Red/pink (top)</strong> = applications that were <strong>denied</strong> (not your personal result).
                </p>
                <p className="panel-note">
                  <strong>Teal line</strong> = your scenario income from the sliders. Hover a bar to see that income
                  band’s approved / denied counts in the caption above the chart (gold dashed line when exploring).
                </p>
              </div>
            </div>
            {hmda && (
              <IncomeHistogram
                hmda={hmda}
                scenario={scenario}
                selectedCounty={selectedHmdaCounty}
                onBrushIncome={setBrushedIncome}
              />
            )}
          </article>
        </section>

        <section className={`model-grid app-section${agentHighlight === "model" ? " section-highlighted" : ""}`} data-section="model" aria-label="Model audit">
          <article className="analysis-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">About the model</p>
                <h2>{model?.modelName ?? "Loading model"}</h2>
                <p className="panel-note">
                  Trained on California HMDA data and calibrated for teaching — not a credit decision. The charts below
                  show what drives approvals in general and how well predictions match historical outcomes.
                </p>
              </div>
              <span className="status-pill muted">HMDA 2025</span>
            </div>
            {model?.note && (
              <p className="model-note"><AlertTriangle size={15} /> {model.note}</p>
            )}
          </article>

          <article className="analysis-panel wide-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Calibration</p>
                <h2>Predicted vs. actual approval rates</h2>
                <p className="panel-note">
                  Each dot groups hold-out HMDA applications by predicted approval chance (horizontal) versus the true
                  approval rate in that group (vertical).
                </p>
                <p className="panel-note">
                  Points near the diagonal line are well calibrated; points far above or below it mean the model was
                  over- or under-confident in that score range.
                </p>
              </div>
            </div>
            {model && <CalibrationChart report={model} />}
          </article>

          <article className="analysis-panel wide-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Risk surface</p>
                <h2>Approval likelihood across DTI and down payment</h2>
                <p className="panel-note">
                  Heatmap of estimated approval likelihood from your scenario math: horizontal = debt-to-income ratio,
                  vertical = down-payment rate (savings ÷ target price).
                </p>
                <p className="panel-note">
                  Greener cells = higher estimated approval in that combination. The teal <strong>You</strong> marker shows
                  where your current scenario sits; it updates when you move the sliders.
                </p>
              </div>
              <span className="status-pill muted">Your position marked</span>
            </div>
            <RiskSurface score={score} />
          </article>
        </section>

        <section className="bias-disclaimer" aria-label="Model fairness and limitations">
          <div className="bias-disclaimer-inner">
            <p className="panel-kicker">Fairness &amp; limitations</p>
            <h2>Important: about this model</h2>
            <div className="bias-grid">
              <div className="bias-item">
                <strong>Historical bias</strong>
                <p>This model is trained on 2025 California HMDA loan records, which reflect historical lending decisions that may have been influenced by systemic discrimination. Approval likelihood estimates inherit those patterns.</p>
              </div>
              <div className="bias-item">
                <strong>Not a lending decision</strong>
                <p>The readiness score and approval likelihood are statistical estimates for educational purposes only — not a credit decision, prequalification, or legal advice. Contact a HUD-approved housing counselor for guidance.</p>
              </div>
              <div className="bias-item">
                <strong>Excluded from the score</strong>
                <p>
                  Leakage fields: {(model?.featurePolicy?.excludedLeakageFields ?? ["interest_rate"]).join(", ")}.
                  Fairness audit only (not scored): {(model?.featurePolicy?.fairnessAuditOnlyFields ?? ["applicant_age", "applicant_sex"]).join(", ")}.
                  County-level HMDA patterns may still reflect geographic disparities in historical lending.
                </p>
              </div>
              <div className="bias-item">
                <strong>Geographic calibration</strong>
                <p>Predicted vs. actual approval rates by county (demo markets). Large gaps suggest the model may not transfer evenly across subgroups.</p>
                {model?.countyCalibration && model.countyCalibration.length > 0 && (
                  <>
                    <p className="panel-note">
                      Each county row: teal bar = actual approval share in evaluation data, blue bar = model prediction.
                      <strong> n=</strong> is the number of loans in that county slice.
                    </p>
                    <CountyCalibrationChart rows={model.countyCalibration} />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <footer className="dashboard-footer" style={{
          padding: '24px 0 32px 0',
          textAlign: 'center',
          borderTop: '1px solid var(--line)',
          marginTop: '40px',
          color: 'var(--muted)',
          fontSize: '0.85rem',
          opacity: 0.8
        }}>
          <p>© 2026 ClariFi. All rights reserved. &bull; Created by Lalitha, <a href="https://pranavmanimaran.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Pranav</a>, and <a href="https://vandanacm.github.io/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Vandana</a></p>
        </footer>

        <div className={`agent-float${agentOpen ? " open" : ""}`}>
          <button
            className={`agent-float-toggle${agentLoading ? " busy" : ""}`}
            type="button"
            onClick={() => setAgentOpen(o => !o)}
            title="Ask ClariFi"
          >
            <Bot size={22} />
          </button>
          {agentOpen && (
            <div className="agent-float-panel">
              <div className="agent-float-header">
                <div>
                  <p className="panel-kicker">Explainer · {formatExplainerLabel(agentMode, agentLoading)}</p>
                  <h2>Ask ClariFi</h2>
                </div>
                <button className="agent-float-close" type="button" onClick={() => setAgentOpen(false)}>✕</button>
              </div>
              <div className="agent-float-body">
                {!agentLoading && (agentMode === "offline" || agentMode === "rule-based" || agentMode === "openrouter-rate-limited") && (
                  <p className="agent-template-notice" role="status">
                    {agentMode === "offline"
                      ? "API unreachable — start npm run dev:api in a second terminal, then refresh."
                      : agentMode === "openrouter-rate-limited"
                        ? "OpenRouter accepted your key but the free Llama model is rate-limited. Wait 10–30s and try again."
                        : openRouterConfigured
                          ? "OpenRouter is configured but the last call failed — often rate limits on the free model. Restart dev:api after .env changes, wait, and retry."
                          : "No cloud LLM — set OPENROUTER_API_KEY in .env, run npm run dev:api, then refresh."}
                  </p>
                )}
                <form
                  className="agent-input-row"
                  onSubmit={e => { e.preventDefault(); askAgent(agentQuestion || undefined); }}
                >
                  <input
                    className="agent-input"
                    type="text"
                    placeholder="Ask anything about your scenario…"
                    value={agentQuestion}
                    onChange={e => setAgentQuestion(e.target.value)}
                    disabled={agentLoading}
                  />
                  <button className="agent-send" type="submit" disabled={agentLoading || !agentQuestion.trim()}>
                    {agentLoading ? "…" : "Ask"}
                  </button>
                </form>
                <div className="agent-summary">
                  <span>Current guidance</span>
                  <strong>{agentAnswer}</strong>
                  {agentHighlight && (
                    <button
                      className="agent-highlight-btn"
                      type="button"
                      onClick={() => triggerHighlight(agentHighlight)}
                    >
                      <Navigation size={13} />
                      Jump to {agentHighlight} view
                    </button>
                  )}
                </div>
                {score.counterfactual && (
                  <div className="counterfactual-card">
                    <p className="panel-kicker">Top improvement{score.explanationMode === "model-perturbation" ? " (model what-if)" : ""}</p>
                    <p className="panel-note">
                      One feasible change the engine thinks would raise estimated approval the most (lower debt, more savings, or a smaller target price).
                    </p>
                    <strong>{score.counterfactual.suggestion}</strong>
                    <span className="cf-delta">
                      Approval +{percent.format(score.counterfactual.delta)} → {percent.format(score.counterfactual.newApproval)}
                    </span>
                  </div>
                )}
                <div className="local-shap-list">
                  <p className="panel-kicker" style={{ marginBottom: 6 }}>
                    Local factor impact{score.explanationMode === "model-perturbation" ? " (model perturbation)" : ""}
                  </p>
                  <p className="panel-note">
                    How nudging each part of <em>your</em> scenario would move estimated approval up or down. Positive = helpful for approval; negative = drag.
                  </p>
                  {(score.localShap ?? score.drivers.map(d => ({
                    feature: d.label,
                    label: d.label,
                    value: d.value,
                    ideal: 0,
                    impact: d.direction === "positive" ? 0.05 : -0.05,
                    direction: d.direction
                  }))).map(insight => (
                    <div className="shap-row" key={insight.feature}>
                      <span className="shap-label">{insight.label}</span>
                      <div className="shap-bar-track">
                        <div
                          className={`shap-bar-fill ${insight.direction}`}
                          style={{ width: `${Math.min(Math.abs(insight.impact) * 400, 100)}%` }}
                        />
                      </div>
                      <span className={`shap-value ${insight.direction}`}>
                        {insight.impact > 0 ? "+" : ""}{(insight.impact * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
    </>
  );
}

export default App;
