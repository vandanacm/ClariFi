import { useState } from "react";
import * as d3 from "d3";
import { money } from "./chart-utils";
import type { ScenarioInput, ScoreResult } from "../types";

type Props = {
  scenario: ScenarioInput;
  score: ScoreResult;
  hoveredKey?: string | null;
  onHoverChange?: (key: string | null) => void;
};

export function ExpenseDonut({ scenario, score, hoveredKey, onHoverChange }: Props) {
  const items = [
    { label: "Housing", value: score.monthlyHousing, color: "var(--blue)", key: "housing" },
    { label: "Debt", value: scenario.debt, color: "var(--rose)", key: "debt" },
    { label: "Food", value: scenario.expenses.food, color: "var(--teal)", key: "food" },
    { label: "Transport", value: scenario.expenses.transport, color: "var(--chart-transport)", key: "transport" },
    { label: "Lifestyle", value: scenario.expenses.lifestyle, color: "var(--chart-violet)", key: "lifestyle" },
    { label: "Investing", value: scenario.expenses.investing, color: "var(--chart-positive)", key: "investing" },
  ];
  const total = d3.sum(items, (item) => item.value);

  const [localHovered, setLocalHovered] = useState<(typeof items)[number] | null>(null);

  const activeKey = hoveredKey !== undefined ? hoveredKey : localHovered?.key;
  const activeItem = items.find((item) => item.key === activeKey) || null;

  const setHover = (item: (typeof items)[number] | null) => {
    if (onHoverChange) {
      onHoverChange(item ? item.key : null);
    } else {
      setLocalHovered(item);
    }
  };

  const arc = d3.arc<d3.PieArcDatum<(typeof items)[number]>>().innerRadius(58).outerRadius(84);
  const activeArc = d3.arc<d3.PieArcDatum<(typeof items)[number]>>().innerRadius(58).outerRadius(92);
  const pie = d3.pie<(typeof items)[number]>().sort(null).value((item) => item.value);

  return (
    <svg className="expense-donut" viewBox="0 0 220 220" role="img" aria-label="Expense mix donut chart">
      <g transform="translate(110,110)">
        {pie(items).map((slice) => {
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
                opacity: activeItem === null || isHovered ? 1 : 0.65,
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
          fontSize: "1.18rem",
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
          letterSpacing: "0.06em",
        }}
      >
        {activeItem ? activeItem.label : "monthly outflow"}
      </text>
    </svg>
  );
}
