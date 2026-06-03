import * as d3 from "d3";
import type { ScoreResult } from "../types";

export function ShapWaterfallChart({ score }: { score: ScoreResult }) {
  const raw =
    score.localShap ??
    score.drivers.map((d) => ({
      feature: d.label,
      label: d.label,
      value: d.value,
      ideal: 0,
      impact: d.direction === "positive" ? 0.05 : -0.05,
      direction: d.direction as "positive" | "negative",
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

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.impact)), 0.05);
  const x = d3
    .scaleLinear()
    .domain([-maxAbs * 1.2, maxAbs * 1.2])
    .range([0, plotW]);
  const zero = x(0);

  const ticks = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3].filter(
    (v) => v >= -maxAbs * 1.2 && v <= maxAbs * 1.2
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="shap-waterfall-chart"
      role="img"
      aria-label="Feature impact on approval likelihood"
    >
      <line
        x1={margin.left + zero}
        y1={margin.top}
        x2={margin.left + zero}
        y2={margin.top + plotH}
        stroke="var(--muted)"
        strokeWidth={1}
        strokeDasharray="3,3"
        opacity={0.45}
      />
      {data.map((d, i) => {
        const y = margin.top + i * (barH + gap);
        const barW = Math.max(Math.abs(x(d.impact) - zero), 2);
        const barX =
          d.impact >= 0
            ? margin.left + zero
            : margin.left + zero - barW;
        const fill = d.direction === "positive" ? "#10b981" : "#ef4444";
        const labelX =
          d.impact >= 0
            ? margin.left + zero + barW + 5
            : margin.left + zero - barW - 5;
        return (
          <g key={d.feature}>
            <text
              fontSize="10"
              fill="var(--muted)"
              x={margin.left - 8}
              y={y + barH / 2 + 4}
              textAnchor="end"
            >
              {d.label}
            </text>
            <rect
              x={barX}
              y={y}
              width={barW}
              height={barH}
              rx={3}
              fill={fill}
              opacity={0.82}
            />
            <text
              fontSize="9"
              fill={fill}
              fontWeight="600"
              x={labelX}
              y={y + barH / 2 + 3}
              textAnchor={d.impact >= 0 ? "start" : "end"}
            >
              {d.impact >= 0 ? "+" : ""}
              {(d.impact * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}
      {ticks.map((v) => (
        <text
          key={v}
          fontSize="9"
          fill="var(--muted)"
          x={margin.left + x(v)}
          y={margin.top + plotH + 16}
          textAnchor="middle"
        >
          {v === 0 ? "0" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`}
        </text>
      ))}
      <g
        transform={`translate(${margin.left}, ${margin.top + plotH + 20})`}
      >
        <rect x={0} y={0} width={8} height={8} rx={2} fill="#10b981" opacity={0.82} />
        <text fontSize="9" fill="var(--muted)" x={12} y={8}>Raises approval</text>
        <rect x={100} y={0} width={8} height={8} rx={2} fill="#ef4444" opacity={0.82} />
        <text fontSize="9" fill="var(--muted)" x={112} y={8}>Lowers approval</text>
      </g>
    </svg>
  );
}
