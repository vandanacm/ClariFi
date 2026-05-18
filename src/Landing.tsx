import { BarChart3, Bot, Home, Landmark, LogIn, UserPlus } from "lucide-react";

interface LandingProps {
  onSignIn: () => void;
  onDemo: () => void;
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

export function Landing({ onSignIn, onDemo }: LandingProps) {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="landing-brand">
          <span className="brand-symbol">C</span>
          <div>
            <p className="brand-name landing-brand-name">ClariFi</p>
            <p className="brand-caption landing-brand-caption">AI-Guided Finance</p>
          </div>
        </div>
        <button className="landing-signin-btn" type="button" onClick={onSignIn}>
          <LogIn size={15} />
          Sign in
        </button>
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
        <button className="landing-demo-link" type="button" onClick={onDemo}>
          Skip — explore as demo household →
        </button>
      </footer>
    </div>
  );
}
