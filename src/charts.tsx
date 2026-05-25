import { useMemo, useState } from "react";
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

  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  return (
    <svg className="cashflow-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly cashflow waterfall">
      <defs>
        <filter id="cashflowGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="currentColor" floodOpacity="0.35" />
        </filter>
      </defs>
      <line className="axis-line" x1={margin.left} y1={zero} x2={width - margin.right} y2={zero} />
      {bars.map(item => {
        const x0 = x(item.label) ?? 0;
        const y0 = item.value >= 0 ? y(item.value) : zero;
        const h = Math.max(Math.abs(y(item.value) - zero), 8);
        const isHovered = hoveredBar === item.label;
        const isAnyHovered = hoveredBar !== null;
        const pop = isHovered ? 5 : 0;
        return (
          <g
            key={item.label}
            onMouseEnter={() => setHoveredBar(item.label)}
            onMouseLeave={() => setHoveredBar(null)}
            style={{ cursor: "default" }}
          >
            <g style={{ transform: `translateY(${-pop}px)`, transition: "transform 140ms cubic-bezier(0.34,1.56,0.64,1)" }}>
              <rect
                className={`cashflow-bar ${item.tone}`}
                x={x0}
                y={y0}
                width={x.bandwidth()}
                height={h + pop}
                rx={7}
                style={{
                  opacity: isAnyHovered && !isHovered ? 0.4 : 1,
                  transition: "opacity 140ms ease",
                  filter: isHovered ? "url(#cashflowGlow)" : undefined,
                }}
              />
            </g>
            {/* Hover tooltip card */}
            {isHovered && (
              <g>
                <rect
                  x={x0 + x.bandwidth() / 2 - 34}
                  y={y0 - pop - 30}
                  width={68}
                  height={20}
                  rx={6}
                  fill="var(--surface-2, #1e2a3a)"
                  stroke="var(--line)"
                  strokeWidth={0.8}
                  opacity={0.95}
                />
                <text
                  x={x0 + x.bandwidth() / 2}
                  y={y0 - pop - 15}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={800}
                  fill="var(--ink)"
                >
                  {money.format(item.value)}
                </text>
              </g>
            )}
            {/* Static value label — hide when hovered (tooltip replaces it) */}
            {!isHovered && (
              <text className="cashflow-value" x={x0 + x.bandwidth() / 2} y={y0 - 9} textAnchor="middle">
                {money.format(item.value)}
              </text>
            )}
            <text
              className="tick-label"
              x={x0 + x.bandwidth() / 2}
              y={height - 24}
              textAnchor="middle"
              style={{ opacity: isAnyHovered && !isHovered ? 0.4 : 1, transition: "opacity 140ms ease" }}
            >
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
  hoveredKey?: string | null;
  onHoverChange?: (key: string | null) => void;
};

export function ExpenseDonut({ scenario, score, hoveredKey, onHoverChange }: DonutProps) {
  const items = [
    { label: "Housing", value: score.monthlyHousing, color: "#3867b7", key: "housing" },
    { label: "Debt", value: scenario.debt, color: "#c95d63", key: "debt" },
    { label: "Food", value: scenario.expenses.food, color: "#007f7a", key: "food" },
    { label: "Transport", value: scenario.expenses.transport, color: "#d99a20", key: "transport" },
    { label: "Lifestyle", value: scenario.expenses.lifestyle, color: "#7b61c8", key: "lifestyle" },
    { label: "Investing", value: scenario.expenses.investing, color: "#2f9e44", key: "investing" }
  ];
  const total = d3.sum(items, item => item.value);
  
  const [localHovered, setLocalHovered] = useState<(typeof items)[number] | null>(null);

  const activeKey = hoveredKey !== undefined ? hoveredKey : localHovered?.key;
  const activeItem = items.find(item => item.key === activeKey) || null;

  const setHover = (item: (typeof items)[number] | null) => {
    if (onHoverChange) {
      onHoverChange(item ? item.key : null);
    } else {
      setLocalHovered(item);
    }
  };

  const arc = d3.arc<d3.PieArcDatum<(typeof items)[number]>>().innerRadius(58).outerRadius(84);
  const activeArc = d3.arc<d3.PieArcDatum<(typeof items)[number]>>().innerRadius(58).outerRadius(92);
  const pie = d3.pie<(typeof items)[number]>().sort(null).value(item => item.value);

  return (
    <svg className="expense-donut" viewBox="0 0 220 220" role="img" aria-label="Expense mix donut chart">
      <g transform="translate(110,110)">
        {pie(items).map(slice => {
          const isHovered = activeItem?.label === slice.data.label;
          return (
            <path
              key={slice.data.label}
              d={(isHovered ? activeArc(slice) : arc(slice)) ?? undefined}
              fill={slice.data.color}
              onMouseEnter={() => setHover(slice.data)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(isHovered ? null : slice.data)}
              style={{
                cursor: "pointer",
                transition: "d 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms ease",
                opacity: activeItem === null || isHovered ? 1 : 0.65
              }}
            >
              <title>{slice.data.label}: {money.format(slice.data.value)}</title>
            </path>
          );
        })}
      </g>
      <text
        className="donut-center-main"
        x="110"
        y="105"
        textAnchor="middle"
        style={{
          fill: activeItem ? activeItem.color : "var(--ink)",
          transition: "fill 150ms ease",
          fontSize: "1.18rem"
        }}
      >
        {activeItem ? money.format(activeItem.value) : money.format(total)}
      </text>
      <text
        className="donut-center-sub"
        x="110"
        y="123"
        textAnchor="middle"
        style={{
          fill: activeItem ? activeItem.color : "var(--muted)",
          transition: "fill 150ms ease",
          opacity: activeItem ? 0.9 : 0.65,
          fontSize: "0.62rem",
          letterSpacing: "0.06em"
        }}
      >
        {activeItem ? activeItem.label : "monthly outflow"}
      </text>
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

  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const hoveredInfo = hoveredCounty ? readinessMap[hoveredCounty] : null;

  return (
    <svg viewBox="0 0 500 580" className="choropleth-map" role="img" aria-label="California county readiness map">
      <defs>
        <linearGradient id="readinessLegendGrad" x1="0" y1="0" x2="1" y2="0">
          {d3.range(0, 1.01, 0.1).map((t, i) => (
            <stop key={i} offset={`${(t * 100).toFixed(0)}%`} stopColor={_readinessColor(40 + t * 60)} />
          ))}
        </linearGradient>
      </defs>
      {caFeatures.map(feat => {
        const name = (feat.properties as { name?: string })?.name ?? "";
        const info = readinessMap[name];
        const fill = info != null ? _readinessColor(info.readiness) : "#d7e1e6";
        const isHighlighted = selectedCountyNames.has(name);
        const isHovered = hoveredCounty === name;
        const pathD = _choroplethPath(feat) ?? "";
        return (
          <path
            key={String(feat.id)}
            d={pathD}
            fill={fill}
            stroke={isHovered ? "white" : isHighlighted ? "var(--ink)" : "var(--line)"}
            strokeWidth={isHovered ? 2 : isHighlighted ? 2 : 0.5}
            opacity={info != null ? 1 : 0.65}
            style={{ cursor: info != null ? "pointer" : "default", transition: "stroke 100ms ease, stroke-width 100ms ease" }}
            onMouseEnter={() => info != null && setHoveredCounty(name)}
            onMouseLeave={() => setHoveredCounty(null)}
          />
        );
      })}

      {/* Smooth gradient legend */}
      <g transform="translate(10,530)">
        <text fontSize="9" fontWeight="700" fill="var(--muted)" letterSpacing="0.04em" y={-8}>READINESS SCORE</text>
        <rect x={0} y={0} width={150} height={10} rx={3} fill="url(#readinessLegendGrad)" />
        <text fontSize="9" fill="var(--muted)" y={22}>Low</text>
        <text fontSize="9" fill="var(--muted)" x={150} y={22} textAnchor="end">High</text>
      </g>

      {/* Custom hover tooltip fixed at bottom of map */}
      {hoveredCounty && hoveredInfo && (
        <g transform="translate(250,490)">
          <rect x={-95} y={-14} width={190} height={36} rx={8} fill="var(--surface-2, #1e2a3a)" stroke="var(--line)" strokeWidth={0.8} opacity={0.96} />
          <text fontSize="11" fontWeight="800" fill="var(--ink)" textAnchor="middle" y={2}>
            {hoveredCounty}
          </text>
          <text fontSize="9" fill="var(--muted)" textAnchor="middle" y={16}>
            Readiness {hoveredInfo.readiness}/100
            {hoveredInfo.approvalRate != null ? ` · ${(hoveredInfo.approvalRate * 100).toFixed(0)}% approved` : ""}
          </text>
        </g>
      )}
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
      {/* User marker — glow ring + circle + pill label */}
      <circle
        className="pulse-ring"
        cx={mg.left + uCol * cellW + cellW / 2}
        cy={mg.top + uRow * cellH + cellH / 2}
        r={14}
        fill="none"
        stroke="white"
        strokeWidth={1}
      />
      <circle
        cx={mg.left + uCol * cellW + cellW / 2}
        cy={mg.top + uRow * cellH + cellH / 2}
        r={9}
        fill="none"
        stroke="white"
        strokeWidth={2.5}
      />
      {/* "You" pill label */}
      <g transform={`translate(${mg.left + uCol * cellW + cellW / 2}, ${mg.top + uRow * cellH - 8})`}>
        <rect x={-14} y={-12} width={28} height={13} rx={4} fill="rgba(15,23,42,0.82)" stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
        <text fontSize="8" fontWeight="800" fill="white" textAnchor="middle" y={-2}>You</text>
      </g>
      {/* DTI axis */}
      {_dtiSteps.map((dti, i) => (
        <text key={dti} fontSize="9" fill="var(--muted)" textAnchor="middle"
          x={mg.left + i * cellW + cellW / 2}
          y={H - mg.bottom + 14}>
          {(dti * 100).toFixed(0)}%
        </text>
      ))}
      {/* Down payment axis */}
      {_dpSteps.slice().reverse().map((dp, i) => (
        <text key={dp} fontSize="9" fill="var(--muted)" textAnchor="end"
          x={mg.left - 6}
          y={mg.top + i * cellH + cellH / 2 + 4}>
          {(dp * 100).toFixed(0)}%
        </text>
      ))}
      <text fontSize="10" fill="var(--muted)" textAnchor="middle"
        x={mg.left + (W - mg.left - mg.right) / 2} y={H - 8}>DTI ratio</text>
      <text fontSize="10" fill="var(--muted)" textAnchor="middle"
        transform={`rotate(-90 14 ${mg.top + (H - mg.top - mg.bottom) / 2})`}
        x={14} y={mg.top + (H - mg.top - mg.bottom) / 2}>Down payment %</text>
    </svg>
  );
}

// ── Income distribution histogram ──────────────────────────────────────────

function getRoundedTopPath(x: number, y: number, w: number, h: number, r: number) {
  const currentR = Math.min(r, h, w / 2);
  if (currentR <= 0) return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
  return `M ${x},${y + h} L ${x},${y + currentR} A ${currentR},${currentR} 0 0 1 ${x + currentR},${y} L ${x + w - currentR},${y} A ${currentR},${currentR} 0 0 1 ${x + w},${y + currentR} L ${x + w},${y + h} Z`;
}

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

  const [cursor, setCursor] = useState<{ svgX: number; income: number } | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = W / rect.width;
    const svgX = (e.clientX - rect.left) * scale;
    if (svgX >= mg.left && svgX <= W - mg.right) {
      setCursor({ svgX, income: x.invert(svgX) });
    } else {
      setCursor(null);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="histogram-chart"
      role="img"
      aria-label="Income distribution for selected market"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setCursor(null)}
    >
      <defs>
        <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="deniedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((p, idx) => {
        const val = maxCount * p;
        const ly = y(val);
        return (
          <line
            key={idx}
            x1={mg.left}
            y1={ly}
            x2={W - mg.right}
            y2={ly}
            stroke="var(--line)"
            strokeOpacity={0.12}
            strokeDasharray="3 3"
          />
        );
      })}

      <line className="axis-line" x1={mg.left} y1={H - mg.bottom} x2={W - mg.right} y2={H - mg.bottom} stroke="var(--line)" opacity={0.3} />
      
      {bins.map((bin, i) => {
        const bx = x(bin.x0 ?? 0) + 1;
        const bw = Math.max(x(bin.x1 ?? 0) - x(bin.x0 ?? 0) - 2, 0);
        const approved = bin.filter(d => d.approved).length;
        const denied = bin.length - approved;
        const yApproved = y(approved);
        const baseline = H - mg.bottom;

        const approvedH = baseline - yApproved;
        const deniedH = baseline - y(denied); // Denied height based on its raw count scale

        return (
          <g key={i}>
            {/* Approved Bar (bottom stacked portion) */}
            {approved > 0 && (
              denied > 0 ? (
                /* Flat top when denied bar sits on top of it */
                <rect
                  x={bx}
                  y={yApproved}
                  width={bw}
                  height={approvedH}
                  fill="url(#approvedGrad)"
                >
                  <title>{approved} approved</title>
                </rect>
              ) : (
                /* Rounded top when it's the only bar segment */
                <path
                  d={getRoundedTopPath(bx, yApproved, bw, approvedH, 4)}
                  fill="url(#approvedGrad)"
                >
                  <title>{approved} approved</title>
                </path>
              )
            )}

            {/* Denied Bar (sits on top of approved) */}
            {denied > 0 && (
              <path
                d={getRoundedTopPath(bx, yApproved - deniedH, bw, deniedH, 4)}
                fill="url(#deniedGrad)"
              >
                <title>{denied} denied</title>
              </path>
            )}
          </g>
        );
      })}

      {/* User income marker (Glowing Golden Pin & Pulsing Dot) */}
      <line x1={x(scenario.income)} y1={mg.top + 8} x2={x(scenario.income)} y2={H - mg.bottom}
        stroke="var(--gold)" strokeWidth={3} opacity={0.2} strokeLinecap="round" />
      <line x1={x(scenario.income)} y1={mg.top + 8} x2={x(scenario.income)} y2={H - mg.bottom}
        stroke="var(--gold)" strokeWidth={1} strokeDasharray="3 3" />
      
      {/* Target intersection glowing circle */}
      <circle cx={x(scenario.income)} cy={H - mg.bottom} r={4} fill="var(--gold)" opacity={0.8} />
      <circle cx={x(scenario.income)} cy={H - mg.bottom} r={8} fill="none" stroke="var(--gold)" strokeWidth={1.5} opacity={0.4} />

      <g transform={`translate(${x(scenario.income)}, ${mg.top + 6})`}>
        <rect x={-16} y={-8} width={32} height={16} rx={8} fill="var(--gold)" />
        <text fontSize="8" fontWeight="900" fill="#0f172a" textAnchor="middle" y={3}>YOU</text>
      </g>

      {/* X ticks */}
      {x.ticks(6).map(tick => (
        <text key={tick} fontSize="9" fill="var(--muted)" fontWeight="600" textAnchor="middle"
          x={x(tick)} y={H - mg.bottom + 14}>${(tick / 1000).toFixed(0)}k</text>
      ))}

      {/* Elegant Legend */}
      <g transform={`translate(${W - mg.right - 90}, ${mg.top - 8})`}>
        <rect x={0} y={0} width={8} height={8} rx={2} fill="url(#approvedGrad)" />
        <text fontSize="9" fontWeight="700" fill="var(--muted)" x={12} y={8}>Approved</text>
        
        <rect x={0} y={14} width={8} height={8} rx={2} fill="url(#deniedGrad)" />
        <text fontSize="9" fontWeight="700" fill="var(--muted)" x={12} y={22}>Denied</text>
      </g>

      <text fontSize="10" fill="var(--muted)" fontWeight="600" textAnchor="middle"
        x={mg.left + (W - mg.left - mg.right) / 2} y={H - 6}>Monthly income</text>

      {/* Crosshair */}
      {cursor && (
        <g style={{ pointerEvents: "none" }}>
          <line
            x1={cursor.svgX}
            y1={mg.top}
            x2={cursor.svgX}
            y2={H - mg.bottom}
            stroke="var(--muted)"
            strokeWidth={1}
            strokeDasharray="4 3"
            opacity={0.55}
          />
          <g transform={`translate(${cursor.svgX}, ${H - mg.bottom + 2})`}>
            <rect x={-18} y={0} width={36} height={14} rx={4} fill="var(--surface-2, #1e2a3a)" stroke="var(--line)" strokeWidth={0.6} />
            <text fontSize="8" fontWeight="700" fill="var(--muted)" textAnchor="middle" y={10}>
              ${(cursor.income / 1000).toFixed(1)}k
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
