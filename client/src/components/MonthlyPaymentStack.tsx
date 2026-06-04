import { money, getRoundedTopPath } from "./chart-utils";
import { paymentBreakdown } from "./mortgage-utils";
import type { ScenarioInput } from "../types";

export function MonthlyPaymentStack({ scenario }: { scenario: ScenarioInput }) {
  const { pi, tax, insurance, pmi, total } = paymentBreakdown(scenario.price, scenario.savings);
  const segments = [
    { label: "Principal & interest", value: pi, color: "var(--blue)" },
    { label: "Property tax", value: tax, color: "var(--chart-violet)" },
    { label: "Insurance", value: insurance, color: "var(--chart-transport)" },
    ...(pmi > 0 ? [{ label: "PMI", value: pmi, color: "var(--rose)" }] : []),
  ];

  const width = 440;
  const barW = 72;
  const maxH = 90;
  const x0 = 48;
  const gap = 18;

  return (
    <svg viewBox="0 0 440 130" className="monthly-payment-stack" role="img" aria-label="Monthly housing payment breakdown">
      <text fontSize="10" fontWeight="700" fill="var(--ink)" y={14}>
        Total monthly housing cost
      </text>
      <text fontSize="9" fill="var(--muted)" y={28}>
        P&amp;I plus estimated tax, insurance{pmi > 0 ? ", and PMI" : ""} · {money.format(total)}/mo
      </text>

      {segments.map((seg, i) => {
        const h = (seg.value / total) * maxH;
        const x = x0 + i * (barW + gap);
        const y = 118 - h;
        return (
          <g key={seg.label}>
            <path d={getRoundedTopPath(x, y, barW, h, 4)} fill={seg.color} opacity={0.85} />
            <text fontSize="8" fill="var(--ink)" fontWeight="700" x={x + barW / 2} y={y - 4} textAnchor="middle">
              {money.format(seg.value)}
            </text>
            <text fontSize="8" fill="var(--muted)" x={x + barW / 2} y={126} textAnchor="middle">
              {seg.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
