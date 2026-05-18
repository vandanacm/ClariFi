import { useMemo } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { BenchmarkCategory, HmdaModel, ModelReport, ScenarioInput, ScoreResult } from "./types";

// ── California counties from us-atlas (pre-parsed once) ────────────────────
import usAtlasData from "us-atlas/counties-10m.json";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _caGeo = feature(usAtlasData as any, (usAtlasData as any).objects.counties) as unknown as GeoJSON.FeatureCollection;
const caFeatures = _caGeo.features.filter(f => String(f.id).startsWith("06"));

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

// ── California county choropleth ────────────────────────────────────────────

type ChoroplethProps = {
  hmda: HmdaModel;
  scenario: ScenarioInput;
};

const _choroplethProjection = d3.geoMercator().fitExtent(
  [[10, 10], [490, 570]],
  { type: "FeatureCollection" as const, features: caFeatures }
);
const _choroplethPath = d3.geoPath(_choroplethProjection);
const _readinessColor = d3.scaleSequential([40, 100], d3.interpolateRdYlGn);

export function ChoroplethMap({ hmda, scenario }: ChoroplethProps) {
  const readinessMap = useMemo(() => {
    const map: Record<string, { readiness: number; approvalRate?: number }> = {};
    Object.values(hmda.markets).forEach(market => {
      market.counties.forEach(county => {
        map[county.name] = { readiness: county.readiness, approvalRate: county.approvalRate };
      });
    });
    return map;
  }, [hmda]);

  const selectedCountyNames = useMemo(
    () => new Set(hmda.markets[scenario.market]?.counties.map(c => c.name) ?? []),
    [hmda, scenario.market]
  );

  return (
    <svg viewBox="0 0 500 580" className="choropleth-map" role="img" aria-label="California county readiness map">
      {caFeatures.map(feat => {
        const name = (feat.properties as { name?: string })?.name ?? "";
        const info = readinessMap[name];
        const fill = info != null ? _readinessColor(info.readiness) : "#d7e1e6";
        const isHighlighted = selectedCountyNames.has(name);
        const pathD = _choroplethPath(feat) ?? "";
        return (
          <path
            key={String(feat.id)}
            d={pathD}
            fill={fill}
            stroke={isHighlighted ? "#152331" : "#b8c8d0"}
            strokeWidth={isHighlighted ? 2 : 0.5}
            opacity={info != null ? 1 : 0.65}
          >
            <title>
              {name}{info != null ? `: ${info.readiness}/100 readiness · ${info.approvalRate != null ? `${(info.approvalRate * 100).toFixed(0)}% approved` : ""}` : ": no data"}
            </title>
          </path>
        );
      })}
      {/* Legend */}
      <g transform="translate(10,550)">
        <text fontSize="9" fontWeight="700" fill="#657383" y={-6}>Readiness score</text>
        {d3.range(40, 101, 12).map((v, i) => (
          <rect key={v} x={i * 22} y={0} width={22} height={10} fill={_readinessColor(v)} />
        ))}
        <text fontSize="9" fill="#657383" y={20}>Low</text>
        <text fontSize="9" fill="#657383" x={130} y={20}>High</text>
      </g>
    </svg>
  );
}

// ── DTI × Down-payment risk surface ────────────────────────────────────────

type RiskSurfaceProps = {
  score: ScoreResult;
};

function _approvalFromFactors(dti: number, dp: number): number {
  const s = Math.min(Math.max(34 + dp * 118 + (1 - Math.abs(dti - 0.32)) * 26 - Math.max(dti - 0.36, 0) * 360 + 1000 / 1800, 18), 96);
  return Math.min(Math.max(0.52 + (s - 60) / 130, 0.08), 0.97);
}

const _dtiSteps = d3.range(0.15, 0.56, 0.05);
const _dpSteps = d3.range(0.05, 0.31, 0.05);
const _riskColor = d3.scaleSequential([0.2, 0.95], d3.interpolateRdYlGn);

export function RiskSurface({ score }: RiskSurfaceProps) {
  const W = 480; const H = 300;
  const mg = { top: 32, right: 20, bottom: 52, left: 68 };
  const cellW = (W - mg.left - mg.right) / _dtiSteps.length;
  const cellH = (H - mg.top - mg.bottom) / _dpSteps.length;

  // User's nearest cell
  const uCol = _dtiSteps.reduce((best, d, i) => Math.abs(d - score.dti) < Math.abs(_dtiSteps[best] - score.dti) ? i : best, 0);
  const uRow = _dpSteps.slice().reverse().reduce((best, d, i) => Math.abs(d - score.downPaymentRate) < Math.abs(_dpSteps.slice().reverse()[best] - score.downPaymentRate) ? i : best, 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="risk-surface" role="img" aria-label="DTI vs down payment approval likelihood surface">
      {_dpSteps.slice().reverse().map((dp, row) =>
        _dtiSteps.map((dti, col) => {
          const approval = _approvalFromFactors(dti, dp);
          return (
            <rect
              key={`${row}-${col}`}
              x={mg.left + col * cellW}
              y={mg.top + row * cellH}
              width={cellW - 1}
              height={cellH - 1}
              fill={_riskColor(approval)}
              rx={2}
            >
              <title>DTI {(dti * 100).toFixed(0)}% · Down {(dp * 100).toFixed(0)}% → {(approval * 100).toFixed(0)}% approval</title>
            </rect>
          );
        })
      )}
      {/* User marker */}
      <circle
        cx={mg.left + uCol * cellW + cellW / 2}
        cy={mg.top + uRow * cellH + cellH / 2}
        r={9}
        fill="none"
        stroke="#152331"
        strokeWidth={2.5}
      />
      <text fontSize="9" fontWeight="700" fill="#152331"
        x={mg.left + uCol * cellW + cellW / 2}
        y={mg.top + uRow * cellH - 4}
        textAnchor="middle">You</text>
      {/* DTI axis */}
      {_dtiSteps.map((dti, i) => (
        <text key={dti} fontSize="9" fill="#657383" textAnchor="middle"
          x={mg.left + i * cellW + cellW / 2}
          y={H - mg.bottom + 14}>
          {(dti * 100).toFixed(0)}%
        </text>
      ))}
      {/* Down payment axis */}
      {_dpSteps.slice().reverse().map((dp, i) => (
        <text key={dp} fontSize="9" fill="#657383" textAnchor="end"
          x={mg.left - 6}
          y={mg.top + i * cellH + cellH / 2 + 4}>
          {(dp * 100).toFixed(0)}%
        </text>
      ))}
      <text fontSize="10" fill="#657383" textAnchor="middle"
        x={mg.left + (W - mg.left - mg.right) / 2} y={H - 8}>DTI ratio</text>
      <text fontSize="10" fill="#657383" textAnchor="middle"
        transform={`rotate(-90 14 ${mg.top + (H - mg.top - mg.bottom) / 2})`}
        x={14} y={mg.top + (H - mg.top - mg.bottom) / 2}>Down payment %</text>
    </svg>
  );
}

// ── Income distribution histogram ──────────────────────────────────────────

type HistogramProps = {
  hmda: HmdaModel;
  scenario: ScenarioInput;
};

export function IncomeHistogram({ hmda, scenario }: HistogramProps) {
  const W = 480; const H = 250;
  const mg = { top: 22, right: 20, bottom: 52, left: 48 };

  const points = hmda.scatter.filter(p => p.marketTags.includes(scenario.market));
  const domain: [number, number] = [2000, 20000];
  const x = d3.scaleLinear(domain, [mg.left, W - mg.right]);

  const bins = d3.histogram<{ incomeMonthly: number; approved: boolean }, number>()
    .value(d => d.incomeMonthly)
    .domain(domain)
    .thresholds(x.ticks(10))(points);

  const maxCount = d3.max(bins, b => b.length) ?? 1;
  const y = d3.scaleLinear([0, maxCount], [H - mg.bottom, mg.top]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="histogram-chart" role="img" aria-label="Income distribution for selected market">
      <line className="axis-line" x1={mg.left} y1={H - mg.bottom} x2={W - mg.right} y2={H - mg.bottom} />
      {bins.map((bin, i) => {
        const bx = x(bin.x0 ?? 0) + 1;
        const bw = Math.max(x(bin.x1 ?? 0) - x(bin.x0 ?? 0) - 2, 0);
        const approved = bin.filter(d => d.approved).length;
        const denied = bin.length - approved;
        const yApproved = y(approved);
        const yDenied = y(denied);
        const baseline = H - mg.bottom;
        return (
          <g key={i}>
            {denied > 0 && (
              <rect x={bx} y={baseline - (baseline - yApproved) - (baseline - yDenied)}
                width={bw} height={baseline - yDenied} fill="var(--rose)" opacity={0.75}>
                <title>{denied} denied</title>
              </rect>
            )}
            {approved > 0 && (
              <rect x={bx} y={yApproved} width={bw} height={baseline - yApproved} fill="var(--teal)" opacity={0.8}>
                <title>{approved} approved</title>
              </rect>
            )}
          </g>
        );
      })}
      {/* User income marker */}
      <line x1={x(scenario.income)} y1={mg.top} x2={x(scenario.income)} y2={H - mg.bottom}
        stroke="#152331" strokeWidth={2} strokeDasharray="5 3" />
      <text fontSize="9" fontWeight="700" fill="#152331"
        x={x(scenario.income) + 5} y={mg.top + 12}>You</text>
      {/* X ticks */}
      {x.ticks(6).map(tick => (
        <text key={tick} fontSize="9" fill="#657383" textAnchor="middle"
          x={x(tick)} y={H - mg.bottom + 14}>${(tick / 1000).toFixed(0)}k</text>
      ))}
      {/* Legend */}
      <rect x={W - mg.right - 70} y={mg.top} width={10} height={10} fill="var(--teal)" opacity={0.8} />
      <text fontSize="9" fill="#657383" x={W - mg.right - 57} y={mg.top + 9}>Approved</text>
      <rect x={W - mg.right - 70} y={mg.top + 14} width={10} height={10} fill="var(--rose)" opacity={0.75} />
      <text fontSize="9" fill="#657383" x={W - mg.right - 57} y={mg.top + 23}>Denied</text>
      <text fontSize="10" fill="#657383" textAnchor="middle"
        x={mg.left + (W - mg.left - mg.right) / 2} y={H - 6}>Monthly income</text>
    </svg>
  );
}
