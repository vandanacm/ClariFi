import { useMemo, useState } from "react";
import * as d3 from "d3";
import { chartExtent, domainIncluding, money } from "./chart-utils";
import type { HmdaModel, ScenarioInput } from "../types";

type Props = {
  hmda: HmdaModel;
  scenario: ScenarioInput;
  selectedCounty?: string | null;
  brushedIncome?: number | null;
  onScatterBrushCounty?: (county: string | null) => void;
  agentAnnotation?: { highlightApproved?: boolean } | null;
};

export function HmdaScatter({
  hmda,
  scenario,
  selectedCounty = null,
  brushedIncome = null,
  onScatterBrushCounty,
  agentAnnotation,
}: Props) {
  const width = 720;
  const height = 380;
  const margin = { top: 24, right: 28, bottom: 62, left: 108 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const points = useMemo(() => {
    let filtered = hmda.scatter.filter((point) =>
      point.marketTags.includes(scenario.market)
    );
    if (selectedCounty) {
      filtered = filtered.filter((point) => point.county === selectedCounty);
    }
    return filtered;
  }, [hmda.scatter, scenario.market, selectedCounty]);

  const userLoan = scenario.price - scenario.savings;
  const userIncomeK = scenario.income / 1000;
  const userLoanK = userLoan / 1000;

  const xDomain = useMemo(() => {
    const base = chartExtent(
      points.map((p) => p.incomeMonthly / 1000),
      [5, 16]
    );
    return domainIncluding(userIncomeK, base);
  }, [points, userIncomeK]);

  const yDomain = useMemo(() => {
    const base = chartExtent(
      points.map((p) => p.loanAmount / 1000),
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
    <svg
      className="scatter-plot"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="HMDA borrower comparison"
    >
      <defs>
        <clipPath id="scatter-plot-clip">
          <rect
            x={margin.left}
            y={margin.top}
            width={plotW}
            height={plotH}
          />
        </clipPath>
      </defs>
      <line
        className="axis-line"
        x1={margin.left}
        y1={margin.top + plotH}
        x2={margin.left + plotW}
        y2={margin.top + plotH}
      />
      <line
        className="axis-line"
        x1={margin.left}
        y1={margin.top}
        x2={margin.left}
        y2={margin.top + plotH}
      />
      {xTicks.map((tick) => (
        <g key={tick}>
          <line
            className="grid-line"
            x1={x(tick)}
            y1={margin.top}
            x2={x(tick)}
            y2={margin.top + plotH}
          />
          <text
            className="tick-label"
            x={x(tick)}
            y={height - 26}
            textAnchor="middle"
          >
            ${tick.toFixed(0)}k
          </text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            className="grid-line"
            x1={margin.left}
            y1={y(tick)}
            x2={margin.left + plotW}
            y2={y(tick)}
          />
          <text
            className="tick-label"
            x={margin.left - 12}
            y={y(tick) + 4}
            textAnchor="end"
          >
            ${tick.toFixed(0)}k
          </text>
        </g>
      ))}
      <g clipPath="url(#scatter-plot-clip)">
        {points.map((point, index) => {
          const nearBrush =
            brushedIncome != null &&
            Math.abs(point.incomeMonthly - brushedIncome) <= brushBand;
          const dimmed = brushedIncome != null && !nearBrush;
          const isHovered = hoveredPoint === index;
          const agentDim =
            agentAnnotation?.highlightApproved != null &&
            point.approved !== agentAnnotation.highlightApproved;
          return (
            <circle
              key={`${point.county}-${index}`}
              className="point"
              cx={x(point.incomeMonthly / 1000)}
              cy={y(point.loanAmount / 1000)}
              r={isHovered ? 11 : nearBrush ? 8 : 6}
              fill={
                point.approved ? "var(--teal)" : "var(--rose)"
              }
              opacity={
                agentDim
                  ? 0.12
                  : dimmed
                    ? 0.18
                    : nearBrush
                      ? 1
                      : 0.82
              }
              stroke={
                isHovered
                  ? "var(--ink)"
                  : nearBrush
                    ? "var(--you)"
                    : "none"
              }
              strokeWidth={isHovered ? 2.5 : nearBrush ? 2 : 0}
              style={{ cursor: "pointer", transition: "r 120ms ease, opacity 120ms ease" }}
              onMouseEnter={() => {
                setHoveredPoint(index);
                onScatterBrushCounty?.(point.county);
              }}
              onMouseLeave={() => {
                setHoveredPoint(null);
                onScatterBrushCounty?.(null);
              }}
            >
              <title>
                {point.county}: {point.approved ? "approved" : "denied"} ·{" "}
                {money.format(point.incomeMonthly)}/mo ·{" "}
                {money.format(point.loanAmount)} loan
              </title>
            </circle>
          );
        })}
        {brushedIncome != null && (
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
        )}
      </g>
      {brushedIncome != null && (
        <text
          className="axis-label"
          x={Math.min(
            x(brushedIncome / 1000) + 8,
            margin.left + plotW - 90
          )}
          y={margin.top + 14}
        >
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
        if (labelY + labelH > plotBottom - 4)
          labelY = userCy - labelH - 14;
        const anchorX = Math.min(
          Math.max(userCx, labelX + 12),
          labelX + labelW - 12
        );
        const anchorY = labelY + labelH;
        return (
          <g
            className="user-profile-marker"
            aria-label="Your profile on the HMDA scatter plot"
          >
            <circle
              className="user-point-halo"
              cx={userCx}
              cy={userCy}
              r={15}
              strokeWidth={2}
            />
            <circle
              className="user-point"
              cx={userCx}
              cy={userCy}
              r={9}
            />
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
      <text
        className="axis-label"
        x={margin.left + plotW / 2}
        y={height - 6}
        textAnchor="middle"
      >
        Monthly income
      </text>
      <text
        className="axis-label y-axis-title"
        x="24"
        y={margin.top + plotH / 2}
        textAnchor="middle"
        transform={`rotate(-90 24 ${margin.top + plotH / 2})`}
      >
        Requested loan amount
      </text>
    </svg>
  );
}
