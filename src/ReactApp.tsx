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
  ExpenseDonut,
  HmdaScatter,
  IncomeHistogram,
  RiskSurface
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

function calculateLocalScore(scenario: ScenarioInput): ScoreResult {
  const price = Number(scenario.price);
  const savings = Number(scenario.savings);
  const income = Number(scenario.income);
  const debt = Number(scenario.debt);
  
  const monthlyHousing = Math.round((price - savings) * 0.0062);
  const flexibleExpenses = Number(scenario.expenses.food) + 
                           Number(scenario.expenses.transport) + 
                           Number(scenario.expenses.lifestyle) + 
                           Number(scenario.expenses.investing);
  const monthlySurplus = Math.round(income - debt - monthlyHousing - flexibleExpenses);
  
  const dti = Number(((debt + monthlyHousing) / income).toFixed(3));
  const downPaymentRate = Number((savings / price).toFixed(3));
  
  // Calculate a realistic local score
  const incomeMedian = 7800; // Median Sacramento income
  const priceMedian = 490000;
  const incomeFit = income / incomeMedian;
  const priceFit = priceMedian / price;
  
  const clampVal = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
  
  const rawScore = 34 +
    downPaymentRate * 118 +
    (1 - Math.abs(dti - 0.32)) * 26 +
    incomeFit * 17 +
    priceFit * 11 -
    Math.max(dti - 0.36, 0) * 360 +
    clampVal(monthlySurplus / 1800, -8, 9);
    
  const score = Math.round(clampVal(rawScore, 18, 96));
  
  const approvalBase = 0.52;
  const approval = Number(clampVal(
    approvalBase +
      (score - 70) / 180 +
      (downPaymentRate - 0.15) * 0.8 -
      Math.max(dti - 0.36, 0) * 1.2,
    0.18,
    0.94
  ).toFixed(3));

  return {
    mode: "local estimate",
    score,
    approvalLikelihood: approval,
    monthlyHousing,
    monthlySurplus,
    dti,
    downPaymentRate,
    drivers: [
      { label: "Down payment", value: downPaymentRate, direction: "negative" },
      { label: "Debt-to-income", value: dti, direction: "negative" },
      { label: "Monthly surplus", value: monthlySurplus, direction: "positive" }
    ]
  };
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
  const [score, setScore] = useState<ScoreResult>(fallbackScore);
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
      try {
        const calls: Promise<unknown>[] = [
          api.health(),
          api.hmda(),
          api.benchmarks(),
          api.model(),
          api.financeSummary()
        ];
        if (api.getToken()) {
          calls.push(api.me().catch(() => { api.clearToken(); return null; }));
        }
        const [health, hmdaData, benchmarkData, modelData, financeData, meData] = await Promise.all(calls) as [
          Awaited<ReturnType<typeof api.health>>,
          HmdaModel,
          BenchmarkModel,
          ModelReport,
          FinanceSummary,
          { user: AuthUser } | null | undefined
        ];
        if (ignore) return;
        setApiOnline(health.ok);
        setHmda(hmdaData);
        setBenchmarks(benchmarkData);
        setModel(modelData);
        setFinanceSummary(financeData);
        if (meData?.user) {
          setAuthUser(meData.user);
          // Apply real spending data to scenario for returning authenticated users
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
      } catch (error) {
        console.warn(error);
        setApiOnline(false);
        setAuthLoading(false);
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
        if (!ignore) {
          setScore(calculateLocalScore(scenario));
          setApiOnline(false);
        }
      }
    }

    scoreScenario();
    return () => {
      ignore = true;
    };
  }, [scenario]);

  // Reset to hardcoded demo values whenever entering /demo so it's always clean
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
        // User has real transaction data — update scenario sliders to match
        const hints = hintsFromFinance(financeData);
        if (Object.keys(hints).length > 0) {
          setScenario(current => ({
            ...current,
            ...hints,
            expenses: hints.expenses ?? current.expenses
          }));
        }
      }
    } catch { /* ignore */ }
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
    // Scroll to the highlighted section
    const el = document.querySelector(`[data-section="${section}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Remove highlight class after animation completes
    setTimeout(() => setAgentHighlight(null), 3000);
  }

  async function uploadTransactions(file?: File) {
    if (!file) return;
    setUploadStatus("Uploading...");
    try {
      const result = await api.uploadTransactions(file);
      setFinanceSummary(result.summary);
      // Immediately update scenario sliders so metrics refresh without a manual page reload
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

  // Route: / — landing page (redirect to dashboard if already authenticated)
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

  // Route: /dashboard — requires authentication
  if (pathname === "/dashboard") {
    if (authLoading) return null;
    if (!authUser) return <Navigate to="/" replace />;
  }

  // /demo or /dashboard: render the dashboard shell
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
                {apiOnline ? "FastAPI connected" : "Static fallback"}
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
              <small>{score.mode === "browser-fallback" ? "local estimate" : score.mode}</small>
            </article>
          </div>
        </section>

        <section className={`finance-strip app-section${agentHighlight === "finances" ? " section-highlighted" : ""}`} data-section="finances" aria-label="Personal finance controls">
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
                <p className="panel-kicker">California county readiness</p>
                <h2>Approval likelihood by county</h2>
              </div>
              <span className="status-pill muted">{hmda?.source.name ?? "Loading HMDA"}</span>
            </div>
            {hmda && <ChoroplethMap hmda={hmda} scenario={scenario} />}
          </article>

          <article className="analysis-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">HMDA borrower comparison</p>
                <h2>Income vs. loan — {scenario.market}</h2>
              </div>
              <span className="status-pill">{market ? money.format(market.priceMedian) : "n/a"} median</span>
            </div>
            {hmda && <HmdaScatter hmda={hmda} scenario={scenario} />}
          </article>

          <article className="analysis-panel wide-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Income distribution</p>
                <h2>Approved vs. denied applicants — {scenario.market}</h2>
              </div>
            </div>
            {hmda && <IncomeHistogram hmda={hmda} scenario={scenario} />}
          </article>
        </section>

        <section className={`model-grid app-section${agentHighlight === "model" ? " section-highlighted" : ""}`} data-section="model" aria-label="Model audit">
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

          <article className="analysis-panel wide-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Risk surface</p>
                <h2>Approval likelihood across DTI and down payment</h2>
              </div>
              <span className="status-pill muted">Your position circled</span>
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
                <strong>Protected attributes excluded</strong>
                <p>Race, ethnicity, sex, and age are excluded from the scoring model. County-level approval patterns visible in the HMDA view may still reflect geographic disparities in historical lending.</p>
              </div>
              <div className="bias-item">
                <strong>Model uncertainty</strong>
                <p>Calibration is tuned to real approval rates, but the 60,000-row California sample may not represent all subgroups equally. Check the calibration chart for confidence in the predicted–actual alignment.</p>
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
                  <p className="panel-kicker">Explainer · {agentLoading ? "Thinking…" : agentMode}</p>
                  <h2>Ask ClariFi</h2>
                </div>
                <button className="agent-float-close" type="button" onClick={() => setAgentOpen(false)}>✕</button>
              </div>
              <div className="agent-float-body">
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
                    <p className="panel-kicker">Top improvement</p>
                    <strong>{score.counterfactual.suggestion}</strong>
                    <span className="cf-delta">
                      Approval +{percent.format(score.counterfactual.delta)} → {percent.format(score.counterfactual.newApproval)}
                    </span>
                  </div>
                )}
                <div className="local-shap-list">
                  <p className="panel-kicker" style={{ marginBottom: 6 }}>Local factor impact</p>
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
