import type { ModelReport } from "../types";

const METRICS = [
  { key: "testAuc", label: "Test AUC", hint: "Ranking quality", higherBetter: true },
  { key: "balancedAccuracy", label: "Balanced accuracy", hint: "At threshold 0.90", higherBetter: true },
  { key: "brierScore", label: "Brier score", hint: "Lower = better calibration", higherBetter: false },
  { key: "denialRecall", label: "Denial recall", hint: "Catching denials", higherBetter: true },
] as const;

export function ModelMetricsChart({ report }: { report: ModelReport }) {
  const m = report.metrics;
  const rows = METRICS.map(({ key, label, hint, higherBetter }) => {
    const raw = m[key as keyof typeof m];
    const value = typeof raw === "number" ? raw : 0;
    return { label, hint, value, higherBetter };
  });

  return (
    <div className="model-metrics-chart" role="img" aria-label="XGBoost model performance metrics">
      <div className="model-metrics-meta">
        <span>{report.rows.total.toLocaleString()} CA loans</span>
        <span>Train {report.rows.train.toLocaleString()} · Test {report.rows.test.toLocaleString()}</span>
      </div>
      {rows.map((row) => {
        const display = row.label === "Brier score" ? row.value.toFixed(3) : `${(row.value * 100).toFixed(1)}%`;
        const barWidth = row.label === "Brier score"
          ? Math.min(row.value / 0.2, 1) * 100
          : row.value * 100;
        const tone = row.higherBetter
          ? row.value >= 0.7 ? "positive" : row.value >= 0.5 ? "neutral" : "warning"
          : row.value <= 0.08 ? "positive" : row.value <= 0.12 ? "neutral" : "warning";
        return (
          <div className="model-metric-row" key={row.label}>
            <header>
              <span>{row.label}</span>
              <strong className={tone}>{display}</strong>
            </header>
            <div className="model-metric-track">
              <span className={`model-metric-fill ${tone}`} style={{ width: `${barWidth}%` }} />
            </div>
            <footer>{row.hint}</footer>
          </div>
        );
      })}
      <p className="model-metrics-footnote">
        Calibrated XGBoost on HMDA 2025 CA · educational use only
      </p>
    </div>
  );
}
