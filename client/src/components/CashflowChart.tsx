import { useState } from "react";
import * as d3 from "d3";
import { money } from "./chart-utils";
import type { ScenarioInput, ScoreResult } from "../types";

type Props = {
  scenario: ScenarioInput;
  score: ScoreResult;
};

export function CashflowChart({ scenario, score }: Props) {
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
    {
      label: "Surplus",
      value: score.monthlySurplus,
      tone: score.monthlySurplus >= 0 ? "surplus" : "shortfall",
    },
  ];
  const max = d3.max(bars, (item) => Math.abs(item.value)) ?? 1;
  const x = d3
    .scaleBand(
      bars.map((item) => item.label),
      [margin.left, width - margin.right]
    )
    .padding(0.28);
  const y = d3.scaleLinear([-max, max], [height - margin.bottom, margin.top]);
  const zero = y(0);

  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  return (
    <svg
      className="cashflow-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Monthly cashflow waterfall"
    >
      <defs>
        <filter id="cashflowGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="5"
            floodColor="currentColor"
            floodOpacity="0.35"
          />
        </filter>
      </defs>
      <line
        className="axis-line"
        x1={margin.left}
        y1={zero}
        x2={width - margin.right}
        y2={zero}
      />
      {bars.map((item) => {
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
            <g
              style={{
                transform: `translateY(${-pop}px)`,
                transition:
                  "transform 140ms cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
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
              <text
                className="cashflow-value"
                x={x0 + x.bandwidth() / 2}
                y={y0 - 9}
                textAnchor="middle"
              >
                {money.format(item.value)}
              </text>
            )}
            <text
              className="tick-label"
              x={x0 + x.bandwidth() / 2}
              y={height - 24}
              textAnchor="middle"
              style={{
                opacity: isAnyHovered && !isHovered ? 0.4 : 1,
                transition: "opacity 140ms ease",
              }}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
