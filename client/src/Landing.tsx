import { BarChart3, Bot, Home, Landmark, LogIn, Moon, Sun, UserPlus } from "lucide-react";

interface LandingProps {
  onSignIn: () => void;
  onDemo: () => void;
  theme: string;
  toggleTheme: () => void;
}

const PREVIEW_METRICS = [
  { label: "Monthly surplus", value: "$1,661" },
  { label: "Approval odds", value: "68%" },
  { label: "Debt-to-income", value: "44%" },
  { label: "Down payment", value: "15%" }
];

const FEATURES = [
  {
    icon: Home,
    title: "Readiness Score",
    desc: "AI-calculated score benchmarked against real HMDA-approved borrower profiles for your target California county."
  },
  {
    icon: BarChart3,
    title: "Finance Analysis",
    desc: "Upload your transaction CSV and see cashflow, spending vs. BLS peer benchmarks, and monthly surplus trends."
  },
  {
    icon: Landmark,
    title: "HMDA Market Data",
    desc: "Compare your income and loan size to thousands of real California mortgage applicants — approved and denied."
  },
  {
    icon: Bot,
    title: "AI Explainer",
    desc: "Ask ClariFi why your score is what it is and which single change moves the needle most."
  }
];

export function Landing({ onSignIn, onDemo, theme, toggleTheme }: LandingProps) {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-brand" style={{ cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} title="Scroll to top">
          <span className="brand-symbol">
            <img src="/logo.png" alt="ClariFi Logo" />
          </span>
          <div>
            <p className="brand-name landing-brand-name">ClariFi</p>
            <p className="brand-caption landing-brand-caption">AI-Guided Finance</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            type="button"
            className="header-action-btn"
            onClick={toggleTheme}
            style={{ borderRadius: "50%", padding: "10px", display: "grid", placeItems: "center" }}
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} style={{ color: "#f4c95d" }} />}
          </button>
          <button className="landing-signin-btn" type="button" onClick={onSignIn}>
            <LogIn size={15} />
            Sign in
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-text">
          <p className="eyebrow">Mortgage Readiness Analytics</p>
          <h1 className="landing-headline">Know if you're ready to buy — before you apply</h1>
          <p className="landing-sub">
            ClariFi scores your mortgage readiness against real California HMDA lending data
            so you can fix the gaps before walking into a bank.
          </p>
          <div className="landing-ctas">
            <button className="landing-primary-btn" type="button" onClick={onSignIn}>
              <UserPlus size={17} />
              Create free account
            </button>
            <button className="landing-demo-btn" type="button" onClick={onDemo}>
              Explore demo →
            </button>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="landing-preview-card">
            <p className="landing-preview-market">Sacramento County, CA</p>
            <div className="landing-ring-wrap">
              <svg className="landing-ring" viewBox="0 0 140 140">
                <circle className="ring-track" cx="70" cy="70" r="56" />
                <circle
                  className="ring-progress"
                  cx="70" cy="70" r="56"
                  style={{ strokeDashoffset: 352 - 0.72 * 352 }}
                />
              </svg>
              <div className="landing-score-center">
                <span>72</span>
                <small>/100</small>
              </div>
            </div>
            <p className="landing-score-label">Nearly ready</p>
            <div className="landing-metric-list">
              {PREVIEW_METRICS.map(m => (
                <div className="landing-metric-row" key={m.label}>
                  <span>{m.label}</span>
                  <strong>{m.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features">
        {FEATURES.map(f => {
          const Icon = f.icon;
          return (
            <div className="landing-feature" key={f.title}>
              <div className="landing-feature-icon">
                <Icon size={20} />
              </div>
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
            </div>
          );
        })}
      </section>

      <footer className="landing-footer">
        <p>For educational purposes only — not a lending decision or financial advice. California HMDA 2025 data.</p>
        <p className="footer-credits" style={{ marginTop: '8px', opacity: 0.8, fontSize: '0.85rem' }}>
          © 2026 ClariFi. All rights reserved. &bull; Created by <a href="https://lalitha-dasu.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Lalitha</a>, <a href="https://pranavmanimaran.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Pranav</a>, and <a href="https://vandanacm.github.io/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Vandana</a>
        </p>
        <button className="landing-demo-link" type="button" onClick={onDemo}>
          Skip — explore as demo household →
        </button>
      </footer>
    </div>
  );
}
