import { useMemo, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { BenchmarkCategory, HmdaModel, ModelReport, ScenarioInput, ScoreResult } from "./types";

import usAtlasData from "us-atlas/counties-10m.json";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _caGeo = feature(usAtlasData as any, (usAtlasData as any).objects.counties) as unknown as GeoJSON.FeatureCollection;
const caFeatures = _caGeo.features.filter(f => String(f.id).startsWith("06"));

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

function chartExtent(values: number[], fallback: [number, number], pad = 0.08): [number, number] {
  const valid = values.filter(v => Number.isFinite(v) && v > 0);
  if (!valid.length) return fallback;
  const sorted = [...valid].sort(d3.ascending);
  const lo = d3.quantile(sorted, 0.03) ?? sorted[0];
  const hi = d3.quantile(sorted, 0.97) ?? sorted[sorted.length - 1];
  const span = Math.max(hi - lo, 1);
  return [Math.max(0, lo - span * pad), hi + span * pad];
}

function domainIncluding(value: number, domain: [number, number], padRatio = 0.06): [number, number] {
  if (!Number.isFinite(value)) return domain;
  let [lo, hi] = domain;
  if (value < lo) lo = value - (hi - lo) * padRatio;
  if (value > hi) hi = value + (hi - lo) * padRatio;
  return [lo, hi];
}

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
    { label: "Transport", value: -scenario.expenses.transport, tone: "flex" },
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
            {isHovered && (
              <g>
                <rect
                  x={x0 + x.bandwidth() / 2 - 34}
                  y={y0 - pop - 30}
                  width={68}
                  height={20}
                  rx={6}
                  fill="var(--chart-surface)"
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
    { label: "Housing", value: score.monthlyHousing, color: "var(--blue)", key: "housing" },
    { label: "Debt", value: scenario.debt, color: "var(--rose)", key: "debt" },
    { label: "Food", value: scenario.expenses.food, color: "var(--teal)", key: "food" },
    { label: "Transport", value: scenario.expenses.transport, color: "var(--chart-transport)", key: "transport" },
    { label: "Lifestyle", value: scenario.expenses.lifestyle, color: "var(--chart-violet)", key: "lifestyle" },
    { label: "Investing", value: scenario.expenses.investing, color: "var(--chart-positive)", key: "investing" }
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
          fill: activeItem ? activeItem.color : "var(--teal)",
          transition: "fill 150ms ease",
          opacity: activeItem ? 0.95 : 1,
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
  selectedCounty?: string | null;
  brushedIncome?: number | null;
};

export function HmdaScatter({ hmda, scenario, selectedCounty = null, brushedIncome = null }: ScatterProps) {
  const width = 720;
  const height = 380;
  const margin = { top: 24, right: 28, bottom: 62, left: 108 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const points = useMemo(() => {
    let filtered = hmda.scatter.filter(point => point.marketTags.includes(scenario.market));
    if (selectedCounty) {
      filtered = filtered.filter(point => point.county === selectedCounty);
    }
    return filtered;
  }, [hmda.scatter, scenario.market, selectedCounty]);
  const userLoan = scenario.price - scenario.savings;
  const userIncomeK = scenario.income / 1000;
  const userLoanK = userLoan / 1000;

  const xDomain = useMemo(() => {
    const base = chartExtent(
      points.map(p => p.incomeMonthly / 1000),
      [5, 16]
    );
    return domainIncluding(userIncomeK, base);
  }, [points, userIncomeK]);

  const yDomain = useMemo(() => {
    const base = chartExtent(
      points.map(p => p.loanAmount / 1000),
      [200, 900]
    );
    return domainIncluding(userLoanK, base);
  }, [points, userLoanK]);

  const x = d3.scaleLinear(xDomain, [margin.left, margin.left + plotW]);
  const y = d3.scaleLinear(yDomain, [margin.top + plotH, margin.top]);
  const brushBand = Math.max(400, (xDomain[1] - xDomain[0]) * 80);
  const xTicks = x.ticks(5);
  const yTicks = y.ticks(4);

  return (
    <svg className="scatter-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="HMDA borrower comparison">
      <defs>
        <clipPath id="scatter-plot-clip">
          <rect x={margin.left} y={margin.top} width={plotW} height={plotH} />
        </clipPath>
      </defs>
      <line className="axis-line" x1={margin.left} y1={margin.top + plotH} x2={margin.left + plotW} y2={margin.top + plotH} />
      <line className="axis-line" x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotH} />
      {xTicks.map(tick => (
        <g key={tick}>
          <line className="grid-line" x1={x(tick)} y1={margin.top} x2={x(tick)} y2={margin.top + plotH} />
          <text className="tick-label" x={x(tick)} y={height - 26} textAnchor="middle">${tick.toFixed(0)}k</text>
        </g>
      ))}
      {yTicks.map(tick => (
        <g key={tick}>
          <line className="grid-line" x1={margin.left} y1={y(tick)} x2={margin.left + plotW} y2={y(tick)} />
          <text className="tick-label" x={margin.left - 12} y={y(tick) + 4} textAnchor="end">${tick.toFixed(0)}k</text>
        </g>
      ))}
      <g clipPath="url(#scatter-plot-clip)">
      {points.map((point, index) => {
        const nearBrush = brushedIncome != null && Math.abs(point.incomeMonthly - brushedIncome) <= brushBand;
        const dimmed = brushedIncome != null && !nearBrush;
        return (
        <circle
          key={`${point.county}-${index}`}
          className="point"
          cx={x(point.incomeMonthly / 1000)}
          cy={y(point.loanAmount / 1000)}
          r={nearBrush ? 8 : 6}
          fill={point.approved ? "var(--teal)" : "var(--rose)"}
          opacity={dimmed ? 0.18 : nearBrush ? 1 : 0.82}
          stroke={nearBrush ? "var(--you)" : "none"}
          strokeWidth={nearBrush ? 2 : 0}
        >
          <title>{point.county}: {point.approved ? "approved" : "denied"}</title>
        </circle>
      );})}
      {brushedIncome != null && (
        <>
          <line
            x1={x(brushedIncome / 1000)}
            y1={margin.top}
            x2={x(brushedIncome / 1000)}
            y2={margin.top + plotH}
            stroke="var(--you)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.75}
          />
        </>
      )}
      </g>
      {brushedIncome != null && (
        <text className="axis-label" x={Math.min(x(brushedIncome / 1000) + 8, margin.left + plotW - 90)} y={margin.top + 14}>
          Brushed ${Math.round(brushedIncome / 1000)}k/mo
        </text>
      )}
      {(() => {
        const userCx = x(userIncomeK);
        const userCy = y(userLoanK);
        const labelW = 108;
        const labelH = 24;
        const plotRight = margin.left + plotW;
        const plotBottom = margin.top + plotH;
        let labelX = userCx + 16;
        let labelY = userCy - labelH - 12;
        if (labelX + labelW > plotRight - 4) labelX = userCx - labelW - 16;
        if (labelX < margin.left + 4) labelX = margin.left + 4;
        if (labelY < margin.top + 4) labelY = userCy + 14;
        if (labelY + labelH > plotBottom - 4) labelY = userCy - labelH - 14;
        const anchorX = Math.min(Math.max(userCx, labelX + 12), labelX + labelW - 12);
        const anchorY = labelY + labelH;
        return (
          <g className="user-profile-marker" aria-label="Your profile on the HMDA scatter plot">
            <circle className="user-point-halo" cx={userCx} cy={userCy} r={15} strokeWidth={2} />
            <circle className="user-point" cx={userCx} cy={userCy} r={9} />
            <line
              x1={userCx}
              y1={userCy}
              x2={anchorX}
              y2={anchorY}
              stroke="var(--you)"
              strokeWidth={1.5}
              opacity={0.85}
            />
            <rect
              className="user-profile-pill-bg"
              x={labelX}
              y={labelY}
              width={labelW}
              height={labelH}
              rx={6}
              strokeWidth={1.5}
            />
            <text
              x={labelX + labelW / 2}
              y={labelY + 16}
              textAnchor="middle"
              className="user-profile-label"
            >
              Your profile
            </text>
          </g>
        );
      })()}
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

type ChoroplethProps = {
  hmda: HmdaModel;
  scenario: ScenarioInput;
  selectedCounty?: string | null;
  onCountySelect?: (county: string | null) => void;
  onMarketSelect?: (market: string) => void;
};

const _choroplethProjection = d3.geoMercator().fitExtent(
  [[10, 10], [490, 570]],
  { type: "FeatureCollection" as const, features: caFeatures }
);
const _choroplethPath = d3.geoPath(_choroplethProjection);

export function ChoroplethMap({
  hmda,
  scenario,
  selectedCounty = null,
  onCountySelect,
  onMarketSelect
}: ChoroplethProps) {
  const readinessMap = useMemo(() => {
    const map: Record<
      string,
      { readiness: number; approvalRate?: number; applications?: number; dataSource?: string }
    > = {};
    if (hmda.counties) {
      Object.entries(hmda.counties).forEach(([name, county]) => {
        map[name] = {
          readiness: county.readiness,
          approvalRate: county.approvalRate,
          applications: county.applications,
          dataSource: county.dataSource
        };
      });
    } else {
      Object.values(hmda.markets).forEach(market => {
        market.counties.forEach(county => {
          map[county.name] = {
            readiness: county.readiness,
            approvalRate: county.approvalRate,
            applications: county.applications,
            dataSource: county.dataSource
          };
        });
      });
    }
    return map;
  }, [hmda]);

  const countyToMarket = useMemo(() => {
    if (hmda.countyPrimaryMarket) return hmda.countyPrimaryMarket;
    const map: Record<string, string> = {};
    Object.entries(hmda.markets).forEach(([market, data]) => {
      data.counties.forEach(county => {
        map[county.name] = market;
      });
    });
    return map;
  }, [hmda.countyPrimaryMarket, hmda.markets]);

  const selectedCountyNames = useMemo(() => {
    if (hmda.countyPrimaryMarket) {
      return new Set(
        Object.entries(hmda.countyPrimaryMarket)
          .filter(([, market]) => market === scenario.market)
          .map(([name]) => name)
      );
    }
    return new Set(hmda.markets[scenario.market]?.counties.map(c => c.name) ?? []);
  }, [hmda, scenario.market]);

  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const hoveredInfo = hoveredCounty ? readinessMap[hoveredCounty] : null;

  const approvalExtent = useMemo(() => {
    const rates = Object.values(readinessMap)
      .map(entry => entry.approvalRate)
      .filter((rate): rate is number => rate != null && rate > 0);
    if (!rates.length) return [0.4, 0.85] as [number, number];
    const lo = Math.min(...rates);
    const hi = Math.max(...rates);
    const pad = Math.max((hi - lo) * 0.06, 0.02);
    return [Math.max(0, lo - pad), Math.min(1, hi + pad)] as [number, number];
  }, [readinessMap]);

  const approvalColor = useMemo(
    () => d3.scaleSequential(approvalExtent, d3.interpolateRdYlGn),
    [approvalExtent]
  );

  return (
    <svg viewBox="0 0 500 580" className="choropleth-map" role="img" aria-label="California county HMDA approval rate map">
      <defs>
        <linearGradient id="readinessLegendGrad" x1="0" y1="0" x2="1" y2="0">
          {d3.range(0, 1.01, 0.1).map((t, i) => (
            <stop key={i} offset={`${(t * 100).toFixed(0)}%`} stopColor={approvalColor(approvalExtent[0] + t * (approvalExtent[1] - approvalExtent[0]))} />
          ))}
        </linearGradient>
      </defs>
      {caFeatures.map(feat => {
        const name = (feat.properties as { name?: string })?.name ?? "";
        const info = readinessMap[name];
        const inMarket = selectedCountyNames.has(name);
        const hasRate = info?.approvalRate != null;
        const isSparse = info?.dataSource === "sparse" || info?.dataSource === "state-average";
        const fill = hasRate
          ? approvalColor(info.approvalRate!)
          : "var(--chart-choropleth-empty)";
        const isSelected = selectedCounty === name;
        const isHovered = hoveredCounty === name;
        const pathD = _choroplethPath(feat) ?? "";
        return (
          <path
            key={String(feat.id)}
            d={pathD}
            fill={fill}
            stroke={isSelected ? "var(--you)" : isHovered ? "var(--teal)" : "var(--line)"}
            strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : 0.45}
            opacity={hasRate ? (isSparse ? 0.72 : inMarket ? 1 : 0.9) : 0.5}
            style={{ cursor: hasRate ? "pointer" : "default", transition: "stroke 100ms ease, stroke-width 100ms ease" }}
            onMouseEnter={() => hasRate && setHoveredCounty(name)}
            onMouseLeave={() => setHoveredCounty(null)}
            onClick={() => {
              if (!hasRate) return;
              if (selectedCounty === name) {
                onCountySelect?.(null);
                return;
              }
              onCountySelect?.(name);
              const market = countyToMarket[name];
              if (market) onMarketSelect?.(market);
            }}
          />
        );
      })}

      <g transform="translate(10,530)">
        <text fontSize="9" fontWeight="700" fill="var(--muted)" letterSpacing="0.04em" y={-8}>HMDA APPROVAL RATE</text>
        <rect x={0} y={0} width={150} height={10} rx={3} fill="url(#readinessLegendGrad)" />
        <text fontSize="9" fill="var(--muted)" y={22}>{(approvalExtent[0] * 100).toFixed(0)}%</text>
        <text fontSize="9" fill="var(--muted)" x={150} y={22} textAnchor="end">{(approvalExtent[1] * 100).toFixed(0)}%</text>
      </g>

      {hoveredCounty && hoveredInfo && (
        <g transform="translate(250,490)">
          <rect x={-95} y={-14} width={190} height={36} rx={8} fill="var(--chart-surface)" stroke="var(--line)" strokeWidth={0.8} opacity={0.96} />
          <text fontSize="11" fontWeight="800" fill="var(--ink)" textAnchor="middle" y={2}>
            {hoveredCounty}
          </text>
          <text fontSize="9" fill="var(--muted)" textAnchor="middle" y={16}>
            {hoveredInfo.approvalRate != null
              ? `${(hoveredInfo.approvalRate * 100).toFixed(0)}% HMDA approval`
              : "No rate in sample"}
            {hoveredInfo.applications != null ? ` · ${hoveredInfo.applications} apps` : ""}
            {hoveredInfo.dataSource === "sparse"
              ? " · thin sample"
              : hoveredInfo.dataSource === "state-average"
                ? " · state avg (no local apps)"
                : ""}
          </text>
        </g>
      )}
    </svg>
  );
}

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
      {(() => {
        const cx = mg.left + uCol * cellW + cellW / 2;
        const cy = mg.top + uRow * cellH + cellH / 2;
        return (
          <g className="risk-surface-you" aria-hidden>
            <circle className="pulse-ring" cx={cx} cy={cy} r={16} fill="none" stroke="var(--you)" strokeWidth={2} opacity={0.55} />
            <circle cx={cx} cy={cy} r={13} fill="var(--chart-surface)" stroke="var(--you)" strokeWidth={2.5} opacity={0.96} />
            <circle className="risk-surface-you-dot" cx={cx} cy={cy} r={7} strokeWidth={2} />
            <g transform={`translate(${cx}, ${mg.top + uRow * cellH - 10})`}>
              <rect className="user-profile-pill" x={-18} y={-12} width={36} height={14} rx={7} strokeWidth={1} />
              <text className="user-marker-label-on-pill" textAnchor="middle" y={-1}>You</text>
            </g>
          </g>
        );
      })()}
      {_dtiSteps.map((dti, i) => (
        <text key={dti} fontSize="9" fill="var(--muted)" textAnchor="middle"
          x={mg.left + i * cellW + cellW / 2}
          y={H - mg.bottom + 14}>
          {(dti * 100).toFixed(0)}%
        </text>
      ))}
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

function getRoundedTopPath(x: number, y: number, w: number, h: number, r: number) {
  const currentR = Math.min(r, h, w / 2);
  if (currentR <= 0) return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
  return `M ${x},${y + h} L ${x},${y + currentR} A ${currentR},${currentR} 0 0 1 ${x + currentR},${y} L ${x + w - currentR},${y} A ${currentR},${currentR} 0 0 1 ${x + w},${y + currentR} L ${x + w},${y + h} Z`;
}

type HistogramProps = {
  hmda: HmdaModel;
  scenario: ScenarioInput;
  selectedCounty?: string | null;
  onBrushIncome?: (income: number | null) => void;
};

function findIncomeBin(
  bins: Array<d3.Bin<{ incomeMonthly: number; approved: boolean }, number>>,
  income: number
) {
  return bins.find(b => income >= (b.x0 ?? 0) && income < (b.x1 ?? Infinity)) ?? null;
}

function binCenter(bin: d3.Bin<{ incomeMonthly: number; approved: boolean }, number>) {
  return ((bin.x0 ?? 0) + (bin.x1 ?? 0)) / 2;
}

function binStats(bin: d3.Bin<{ incomeMonthly: number; approved: boolean }, number>) {
  const approved = bin.filter(d => d.approved).length;
  return { approved, denied: bin.length - approved, total: bin.length };
}

export function IncomeHistogram({
  hmda,
  scenario,
  selectedCounty = null,
  onBrushIncome
}: HistogramProps) {
  const W = 480;
  const H = 272;
  const mg = { top: 52, right: 16, bottom: 44, left: 40 };
  const plotW = W - mg.left - mg.right;
  const plotH = H - mg.top - mg.bottom;

  const points = useMemo(() => {
    let filtered = hmda.scatter.filter(p => p.marketTags.includes(scenario.market));
    if (selectedCounty) {
      filtered = filtered.filter(p => p.county === selectedCounty);
    }
    return filtered;
  }, [hmda.scatter, scenario.market, selectedCounty]);

  const domain = useMemo<[number, number]>(() => {
    const incomes = points.map(p => p.incomeMonthly);
    const base = chartExtent(incomes, [3500, 18000]);
    return domainIncluding(scenario.income, base);
  }, [points, scenario.income]);

  const x = d3.scaleLinear(domain, [mg.left, W - mg.right]);

  const bins = d3.histogram<{ incomeMonthly: number; approved: boolean }, number>()
    .value(d => d.incomeMonthly)
    .domain(domain)
    .thresholds(x.ticks(8))(points);

  const maxCount = d3.max(bins, b => b.length) ?? 1;
  const y = d3.scaleLinear([0, maxCount], [H - mg.bottom, mg.top]);

  const userBin = useMemo(() => findIncomeBin(bins, scenario.income), [bins, scenario.income]);
  const userX = Math.min(Math.max(x(scenario.income), mg.left), W - mg.right);

  const [hoverBin, setHoverBin] = useState<d3.Bin<{ incomeMonthly: number; approved: boolean }, number> | null>(
    null
  );

  const hoverStats = hoverBin && hoverBin.length > 0 ? binStats(hoverBin) : null;
  const userStats = userBin && userBin.length > 0 ? binStats(userBin) : null;
  const hoverX = hoverBin ? Math.min(Math.max(x(binCenter(hoverBin)), mg.left), W - mg.right) : null;
  const sameAsUser =
    hoverBin != null &&
    userBin != null &&
    (hoverBin.x0 ?? 0) === (userBin.x0 ?? 0) &&
    (hoverBin.x1 ?? 0) === (userBin.x1 ?? 0);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = W / rect.width;
    const svgX = (e.clientX - rect.left) * scale;
    if (svgX < mg.left || svgX > W - mg.right) {
      setHoverBin(null);
      onBrushIncome?.(null);
      return;
    }
    const bin = findIncomeBin(bins, x.invert(svgX));
    setHoverBin(bin);
    onBrushIncome?.(bin ? binCenter(bin) : null);
  };

  const infoLine = hoverStats
    ? sameAsUser
      ? `Your income · $${(scenario.income / 1000).toFixed(1)}k/mo · ${hoverStats.approved} approved · ${hoverStats.denied} denied`
      : `$${((hoverBin?.x0 ?? 0) / 1000).toFixed(0)}k–$${((hoverBin?.x1 ?? 0) / 1000).toFixed(0)}k/mo · ${hoverStats.approved} approved · ${hoverStats.denied} denied`
    : userStats
      ? `Your income · $${(scenario.income / 1000).toFixed(1)}k/mo · ${userStats.approved} approved · ${userStats.denied} denied in your band`
      : `Your income · $${(scenario.income / 1000).toFixed(1)}k/mo`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="histogram-chart"
      role="img"
      aria-label="Histogram of HMDA applications by monthly income, stacked approved versus denied"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoverBin(null);
        onBrushIncome?.(null);
      }}
    >
      <defs>
        <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-approved-start)" />
          <stop offset="100%" stopColor="var(--chart-approved-end)" />
        </linearGradient>
        <linearGradient id="deniedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-denied-start)" />
          <stop offset="100%" stopColor="var(--chart-denied-end)" />
        </linearGradient>
      </defs>

      <rect
        x={mg.left}
        y={mg.top}
        width={plotW}
        height={plotH}
        rx={8}
        fill="var(--soft)"
        opacity={0.55}
      />

      <text x={mg.left} y={18} fontSize="10" fontWeight="700" fill="var(--ink)">
        {infoLine}
      </text>

      <g className="histogram-legend" transform={`translate(${W - mg.right - 76}, 8)`}>
        <rect x={0} y={0} width={8} height={8} rx={2} fill="url(#approvedGrad)" />
        <text fontSize="9" fontWeight="700" fill="var(--muted)" x={12} y={8}>
          Approved
        </text>
        <rect x={0} y={14} width={8} height={8} rx={2} fill="url(#deniedGrad)" />
        <text fontSize="9" fontWeight="700" fill="var(--muted)" x={12} y={22}>
          Denied
        </text>
      </g>

      {[0.25, 0.5, 0.75, 1].map((p, idx) => {
        const ly = y(maxCount * p);
        return (
          <line
            key={idx}
            x1={mg.left}
            y1={ly}
            x2={W - mg.right}
            y2={ly}
            stroke="var(--line)"
            strokeOpacity={0.2}
          />
        );
      })}

      <line
        x1={mg.left}
        y1={H - mg.bottom}
        x2={W - mg.right}
        y2={H - mg.bottom}
        stroke="var(--line)"
        opacity={0.45}
      />

      {bins.map((bin, i) => {
        const pad = 2;
        const bx = x(bin.x0 ?? 0) + pad;
        const bw = Math.max(x(bin.x1 ?? 0) - x(bin.x0 ?? 0) - pad * 2, 2);
        const { approved, denied } = binStats(bin);
        const baseline = H - mg.bottom;
        const yApproved = y(approved);
        const approvedH = baseline - yApproved;
        const deniedH = baseline - y(denied);
        const isUser =
          userBin != null && (bin.x0 ?? 0) === (userBin.x0 ?? 0) && (bin.x1 ?? 0) === (userBin.x1 ?? 0);
        const isHover =
          hoverBin != null && (bin.x0 ?? 0) === (hoverBin.x0 ?? 0) && (bin.x1 ?? 0) === (hoverBin.x1 ?? 0);

        return (
          <g key={i} aria-label={`${approved} approved, ${denied} denied`}>
            {(isUser || isHover) && (
              <rect
                x={bx - 1}
                y={mg.top}
                width={bw + 2}
                height={plotH}
                fill={isUser ? "var(--you)" : "var(--chart-brush-stroke)"}
                opacity={isUser ? 0.1 : 0.07}
                rx={4}
              />
            )}
            {approved > 0 &&
              (denied > 0 ? (
                <rect x={bx} y={yApproved} width={bw} height={approvedH} fill="url(#approvedGrad)" />
              ) : (
                <path
                  d={getRoundedTopPath(bx, yApproved, bw, approvedH, 3)}
                  fill="url(#approvedGrad)"
                />
              ))}
            {denied > 0 && (
              <path
                d={getRoundedTopPath(bx, yApproved - deniedH, bw, deniedH, 3)}
                fill="url(#deniedGrad)"
              />
            )}
          </g>
        );
      })}

      <g style={{ pointerEvents: "none" }}>
        <line
          x1={userX}
          y1={mg.top}
          x2={userX}
          y2={H - mg.bottom}
          stroke="var(--you)"
          strokeWidth={2}
          opacity={0.85}
        />
        <polygon
          points={`${userX},${H - mg.bottom} ${userX - 5},${H - mg.bottom + 7} ${userX + 5},${H - mg.bottom + 7}`}
          fill="var(--you)"
        />
        {hoverX != null && !sameAsUser && (
          <line
            x1={hoverX}
            y1={mg.top}
            x2={hoverX}
            y2={H - mg.bottom}
            stroke="var(--chart-brush-stroke)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.9}
          />
        )}
      </g>

      {x.ticks(5).map(tick => (
        <text
          key={tick}
          fontSize="9"
          fill="var(--muted)"
          fontWeight="600"
          textAnchor="middle"
          x={x(tick)}
          y={H - mg.bottom + 16}
        >
          ${(tick / 1000).toFixed(0)}k
        </text>
      ))}

      <text
        fontSize="10"
        fill="var(--muted)"
        fontWeight="600"
        textAnchor="middle"
        x={mg.left + plotW / 2}
        y={H - 4}
      >
        Monthly income
      </text>
    </svg>
  );
}

const COUNTY_LABELS: Record<string, string> = {
  "6037.0": "Los Angeles",
  "6073.0": "San Diego",
  "6067.0": "Sacramento",
  "6001.0": "Alameda",
};

export function CountyCalibrationChart({
  rows
}: {
  rows: Array<{
    county: string;
    actualApprovalRate: number;
    predictedApprovalRate: number;
    rows: number;
  }>;
}) {
  const width = 520;
  const height = 220;
  const margin = { top: 18, right: 20, bottom: 42, left: 108 };
  const plotW = width - margin.left - margin.right;
  const barH = 24;
  const gap = 10;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="county-calibration-chart" role="img" aria-label="County approval calibration">
      {rows.map((row, index) => {
        const y = margin.top + index * (barH + gap);
        const label = COUNTY_LABELS[row.county] ?? row.county;
        const actualW = row.actualApprovalRate * plotW;
        const predictedW = row.predictedApprovalRate * plotW;
        return (
          <g key={row.county}>
            <text fontSize="10" fill="var(--muted)" x={margin.left - 8} y={y + barH / 2 + 4} textAnchor="end">{label}</text>
            <rect x={margin.left} y={y} width={plotW} height={barH} rx={4} fill="var(--soft)" opacity={0.65} />
            <rect x={margin.left} y={y + 4} width={actualW} height={8} rx={3} fill="var(--teal)" opacity={0.85} />
            <rect x={margin.left} y={y + 13} width={predictedW} height={8} rx={3} fill="var(--blue)" opacity={0.85} />
            <text fontSize="9" fill="var(--muted)" x={margin.left + plotW + 6} y={y + barH / 2 + 3}>
              n={row.rows}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${margin.left}, ${height - 18})`}>
        <rect x={0} y={0} width={8} height={8} rx={2} fill="var(--teal)" />
        <text fontSize="9" fill="var(--muted)" x={12} y={8}>Actual</text>
        <rect x={70} y={0} width={8} height={8} rx={2} fill="var(--blue)" />
        <text fontSize="9" fill="var(--muted)" x={82} y={8}>Predicted</text>
      </g>
    </svg>
  );
}

export function ShapWaterfallChart({ score }: { score: ScoreResult }) {
  const raw = score.localShap ?? score.drivers.map(d => ({
    feature: d.label,
    label: d.label,
    value: d.value,
    ideal: 0,
    impact: d.direction === "positive" ? 0.05 : -0.05,
    direction: d.direction as "positive" | "negative"
  }));

  const data = [...raw]
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 7);

  const width = 520;
  const margin = { top: 10, right: 64, bottom: 28, left: 138 };
  const barH = 22;
  const gap = 7;
  const plotW = width - margin.left - margin.right;
  const plotH = data.length * (barH + gap);
  const height = margin.top + plotH + margin.bottom;

  const maxAbs = Math.max(...data.map(d => Math.abs(d.impact)), 0.05);
  const x = d3.scaleLinear().domain([-maxAbs * 1.2, maxAbs * 1.2]).range([0, plotW]);
  const zero = x(0);

  const ticks = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].filter(
    v => v >= -maxAbs * 1.2 && v <= maxAbs * 1.2
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="shap-waterfall-chart"
      role="img"
      aria-label="Feature impact on approval likelihood"
    >
      {/* zero reference line */}
      <line
        x1={margin.left + zero} y1={margin.top}
        x2={margin.left + zero} y2={margin.top + plotH}
        stroke="var(--muted)" strokeWidth={1} strokeDasharray="3,3" opacity={0.45}
      />

      {data.map((d, i) => {
        const y = margin.top + i * (barH + gap);
        const barW = Math.max(Math.abs(x(d.impact) - zero), 2);
        const barX = d.impact >= 0 ? margin.left + zero : margin.left + zero - barW;
        const fill = d.direction === "positive" ? "#10b981" : "#ef4444";
        const labelX = d.impact >= 0
          ? margin.left + zero + barW + 5
          : margin.left + zero - barW - 5;
        return (
          <g key={d.feature}>
            <text
              fontSize="10" fill="var(--muted)"
              x={margin.left - 8} y={y + barH / 2 + 4}
              textAnchor="end"
            >
              {d.label}
            </text>
            <rect x={barX} y={y} width={barW} height={barH} rx={3} fill={fill} opacity={0.82} />
            <text
              fontSize="9" fill={fill} fontWeight="600"
              x={labelX} y={y + barH / 2 + 3}
              textAnchor={d.impact >= 0 ? "start" : "end"}
            >
              {d.impact >= 0 ? "+" : ""}{(d.impact * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}

      {/* x-axis ticks */}
      {ticks.map(v => (
        <text
          key={v} fontSize="9" fill="var(--muted)"
          x={margin.left + x(v)} y={margin.top + plotH + 16}
          textAnchor="middle"
        >
          {v === 0 ? "0" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`}
        </text>
      ))}

      {/* legend */}
      <g transform={`translate(${margin.left}, ${margin.top + plotH + 20})`}>
        <rect x={0} y={0} width={8} height={8} rx={2} fill="#10b981" opacity={0.82} />
        <text fontSize="9" fill="var(--muted)" x={12} y={8}>Raises approval</text>
        <rect x={100} y={0} width={8} height={8} rx={2} fill="#ef4444" opacity={0.82} />
        <text fontSize="9" fill="var(--muted)" x={112} y={8}>Lowers approval</text>
      </g>
    </svg>
  );
}
