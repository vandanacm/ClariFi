import * as d3 from "d3";
import type { BenchmarkCategory, HmdaModel, ModelReport, ScenarioInput, ScoreResult } from "./types";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

type CashflowProps = {
  scenario: ScenarioInput;
  score: ScoreResult;
};

export function CashflowChart({ scenario, score }: CashflowProps) {
  const width = 720;
  const height = 270;
  const margin = { top: 24, right: 24, bottom: 58, left: 42 };
  const bars = [
    { label: "Income", value: scenario.income, tone: "income" },
    { label: "Housing", value: -score.monthlyHousing, tone: "housing" },
    { label: "Debt", value: -scenario.debt, tone: "debt" },
    { label: "Food", value: -scenario.expenses.food, tone: "flex" },
    { label: "Lifestyle", value: -scenario.expenses.lifestyle, tone: "flex" },
    { label: "Surplus", value: score.monthlySurplus, tone: score.monthlySurplus >= 0 ? "surplus" : "shortfall" }
  ];
  const max = d3.max(bars, item => Math.abs(item.value)) ?? 1;
  const x = d3.scaleBand(bars.map(item => item.label), [margin.left, width - margin.right]).padding(0.28);
  const y = d3.scaleLinear([-max, max], [height - margin.bottom, margin.top]);
  const zero = y(0);

  return (
    <svg className="cashflow-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly cashflow waterfall">
      <line className="axis-line" x1={margin.left} y1={zero} x2={width - margin.right} y2={zero} />
      {bars.map(item => {
        const x0 = x(item.label) ?? 0;
        const y0 = item.value >= 0 ? y(item.value) : zero;
        const h = Math.max(Math.abs(y(item.value) - zero), 8);
        return (
          <g key={item.label}>
            <rect className={`cashflow-bar ${item.tone}`} x={x0} y={y0} width={x.bandwidth()} height={h} rx={7} />
            <text className="cashflow-value" x={x0 + x.bandwidth() / 2} y={y0 - 9} textAnchor="middle">
              {money.format(item.value)}
            </text>
            <text className="tick-label" x={x0 + x.bandwidth() / 2} y={height - 24} textAnchor="middle">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type DonutProps = {
  scenario: ScenarioInput;
  score: ScoreResult;
};

export function ExpenseDonut({ scenario, score }: DonutProps) {
  const items = [
    { label: "Housing", value: score.monthlyHousing, color: "#3867b7" },
    { label: "Debt", value: scenario.debt, color: "#c95d63" },
    { label: "Food", value: scenario.expenses.food, color: "#007f7a" },
    { label: "Transport", value: scenario.expenses.transport, color: "#d99a20" },
    { label: "Lifestyle", value: scenario.expenses.lifestyle, color: "#7b61c8" },
    { label: "Investing", value: scenario.expenses.investing, color: "#2f9e44" }
  ];
  const total = d3.sum(items, item => item.value);
  const arc = d3.arc<d3.PieArcDatum<(typeof items)[number]>>().innerRadius(58).outerRadius(86);
  const pie = d3.pie<(typeof items)[number]>().sort(null).value(item => item.value);

  return (
    <svg className="expense-donut" viewBox="0 0 220 220" role="img" aria-label="Expense mix donut chart">
      <g transform="translate(110,110)">
        {pie(items).map(slice => (
          <path key={slice.data.label} d={arc(slice) ?? undefined} fill={slice.data.color}>
            <title>{slice.data.label}: {money.format(slice.data.value)}</title>
          </path>
        ))}
      </g>
      <text className="donut-center-main" x="110" y="104" textAnchor="middle">{money.format(total)}</text>
      <text className="donut-center-sub" x="110" y="126" textAnchor="middle">monthly outflow</text>
    </svg>
  );
}

type ScatterProps = {
  hmda: HmdaModel;
  scenario: ScenarioInput;
};

export function HmdaScatter({ hmda, scenario }: ScatterProps) {
  const width = 720;
  const height = 380;
  const margin = { top: 24, right: 28, bottom: 62, left: 108 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const points = hmda.scatter.filter(point => point.marketTags.includes(scenario.market));
  const userLoan = scenario.price - scenario.savings;
  const x = d3.scaleLinear([4, 19], [margin.left, margin.left + plotW]);
  const y = d3.scaleLinear([250, 1300], [margin.top + plotH, margin.top]);

  return (
    <svg className="scatter-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="HMDA borrower comparison">
      <line className="axis-line" x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} />
      <line className="axis-line" x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} />
      {[6, 9, 12, 15, 18].map(tick => (
        <g key={tick}>
          <line className="grid-line" x1={x(tick)} y1={margin.top} x2={x(tick)} y2={margin.top + plotH} />
          <text className="tick-label" x={x(tick)} y={height - 26} textAnchor="middle">${tick}k</text>
        </g>
      ))}
      {[400, 700, 1000, 1300].map(tick => (
        <g key={tick}>
          <line className="grid-line" x1={margin.left} y1={y(tick)} x2={margin.left + plotW} y2={y(tick)} />
          <text className="tick-label" x={margin.left - 12} y={y(tick) + 4} textAnchor="end">${tick}k</text>
        </g>
      ))}
      {points.map((point, index) => (
        <circle
          key={`${point.county}-${index}`}
          className="point"
          cx={x(point.incomeMonthly / 1000)}
          cy={y(point.loanAmount / 1000)}
          r={6}
          fill={point.approved ? "var(--teal)" : "var(--rose)"}
        >
          <title>{point.county}: {point.approved ? "approved" : "denied"}</title>
        </circle>
      ))}
      <circle className="user-point" cx={x(scenario.income / 1000)} cy={y(userLoan / 1000)} r={10} />
      <text className="axis-label" x={x(scenario.income / 1000) + 14} y={y(userLoan / 1000) - 13}>User profile</text>
      <text className="axis-label" x={margin.left + plotW / 2} y={height - 6} textAnchor="middle">Monthly income</text>
      <text className="axis-label y-axis-title" x="24" y={margin.top + plotH / 2} textAnchor="middle" transform={`rotate(-90 24 ${margin.top + plotH / 2})`}>Requested loan amount</text>
    </svg>
  );
}

type CalibrationProps = {
  report: ModelReport;
};

export function CalibrationChart({ report }: CalibrationProps) {
  const rows = report.calibration ?? [];
  const width = 620;
  const height = 300;
  const margin = { top: 22, right: 24, bottom: 44, left: 52 };
  const x = d3.scaleLinear([0.45, 1], [margin.left, width - margin.right]);
  const y = d3.scaleLinear([0.45, 1], [height - margin.bottom, margin.top]);

  return (
    <svg className="calibration-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Model calibration chart">
      <line className="grid-line" x1={x(0.5)} y1={y(0.5)} x2={x(1)} y2={y(1)} />
      <path
        className="goal-line"
        d={d3.line<(typeof rows)[number]>().x(row => x(row.predictedRate)).y(row => y(row.actualRate))(rows) ?? undefined}
      />
      {rows.map(row => (
        <circle key={row.bin} className="goal-point" cx={x(row.predictedRate)} cy={y(row.actualRate)} r={5}>
          <title>{row.bin}: predicted {(row.predictedRate * 100).toFixed(1)}%, actual {(row.actualRate * 100).toFixed(1)}%</title>
        </circle>
      ))}
      <text className="axis-label" x={width / 2} y={height - 8} textAnchor="middle">Predicted approval rate</text>
      <text className="axis-label y-axis-title" x="16" y={height / 2} textAnchor="middle" transform={`rotate(-90 16 ${height / 2})`}>Actual approval rate</text>
    </svg>
  );
}

export function BenchmarkBars({
  categories,
  userValues
}: {
  categories: BenchmarkCategory[];
  userValues: Record<string, number>;
}) {
  return (
    <div className="benchmark-list">
      {categories.map(category => {
        const user = userValues[category.key] ?? 0;
        const max = Math.max(user, category.monthlyPeer, 1);
        const tone = category.key === "savings"
          ? user >= category.monthlyPeer ? "positive" : "negative"
          : user <= category.monthlyPeer * 1.1 ? "positive" : "warning";
        return (
          <div className="benchmark-row" key={category.key}>
            <header>
              <span>{category.label}</span>
              <strong className={tone}>{money.format(user - category.monthlyPeer)} vs peer</strong>
            </header>
            <div className="benchmark-bars">
              <span className="peer-bar" style={{ width: `${(category.monthlyPeer / max) * 100}%` }} />
              <span className={`user-bar ${tone}`} style={{ width: `${(user / max) * 100}%` }} />
            </div>
            <footer>
              <span>User {money.format(user)}</span>
              <span>Peer {money.format(category.monthlyPeer)}</span>
            </footer>
          </div>
        );
      })}
    </div>
  );
}
