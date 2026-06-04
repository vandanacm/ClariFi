import * as d3 from "d3";
import { money } from "./chart-utils";
import { monthsToDownPaymentTarget, monthlySaveCapacity } from "./mortgage-utils";
import type { ScenarioInput, ScoreResult } from "../types";

export function SavingsTimeline({
  scenario,
  score,
}: {
  scenario: ScenarioInput;
  score: ScoreResult;
}) {
  const target20 = Math.round(scenario.price * 0.2);
  const target10 = Math.round(scenario.price * 0.1);
  const monthlySave = monthlySaveCapacity(scenario, score);
  const months20 = monthsToDownPaymentTarget(scenario.savings, target20, monthlySave);
  const months10 = monthsToDownPaymentTarget(scenario.savings, target10, monthlySave);

  const width = 440;
  const height = 130;
  const mg = { top: 36, right: 16, bottom: 28, left: 48 };
  const plotW = width - mg.left - mg.right;
  const plotH = height - mg.top - mg.bottom;

  const horizon = months20 != null ? Math.min(Math.max(months20, 6), 60) : 60;
  const points = d3.range(0, horizon + 1).map((m) => ({
    month: m,
    savings: scenario.savings + monthlySave * m,
  }));

  const x = d3.scaleLinear().domain([0, horizon]).range([0, plotW]);
  const y = d3.scaleLinear().domain([0, Math.max(target20 * 1.05, points[points.length - 1]?.savings ?? 0)]).range([plotH, 0]);
  const line = d3.line<{ month: number; savings: number }>()
    .x((d) => x(d.month))
    .y((d) => y(d.savings));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="savings-timeline" role="img" aria-label="Savings timeline to down payment targets">
      <text fontSize="10" fontWeight="700" fill="var(--ink)" x={0} y={14}>
        Path to down payment milestones
      </text>
      <text fontSize="9" fill="var(--muted)" x={0} y={28}>
        Saving {money.format(monthlySave)}/mo (surplus + investing)
        {months20 != null ? ` · 20% in ~${months20} mo` : " · increase savings rate to reach 20%"}
      </text>

      <g transform={`translate(${mg.left},${mg.top})`}>
        <line x1={0} y1={y(target20)} x2={plotW} y2={y(target20)} stroke="var(--teal)" strokeDasharray="4,3" opacity={0.6} />
        <text fontSize="8" fill="var(--teal)" x={plotW - 4} y={y(target20) - 4} textAnchor="end">20% · {money.format(target20)}</text>
        <line x1={0} y1={y(target10)} x2={plotW} y2={y(target10)} stroke="var(--muted)" strokeDasharray="4,3" opacity={0.45} />
        <text fontSize="8" fill="var(--muted)" x={plotW - 4} y={y(target10) - 4} textAnchor="end">10% · {money.format(target10)}</text>
        <path d={line(points) ?? ""} fill="none" stroke="var(--you)" strokeWidth={2.5} />
        {points.filter((_, i) => i % Math.max(Math.floor(horizon / 6), 1) === 0 || i === points.length - 1).map((d) => (
          <circle key={d.month} cx={x(d.month)} cy={y(d.savings)} r={3} fill="var(--you)" />
        ))}
        <text fontSize="8" fill="var(--muted)" x={plotW / 2} y={plotH + 18} textAnchor="middle">Months</text>
      </g>
      {months10 != null && months10 <= 60 && (
        <text fontSize="8" fill="var(--muted)" x={mg.left} y={height - 4}>
          10% down in ~{months10} months
        </text>
      )}
    </svg>
  );
}
