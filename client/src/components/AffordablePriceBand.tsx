import { money } from "./chart-utils";
import {
  conservativeAffordablePrice,
  maxAffordablePrice,
} from "./mortgage-utils";
import type { HmdaModel, ScenarioInput } from "../types";

export function AffordablePriceBand({
  scenario,
  hmda,
}: {
  scenario: ScenarioInput;
  hmda?: HmdaModel | null;
}) {
  const maxPrice = maxAffordablePrice(scenario.income, scenario.debt, scenario.savings);
  const conservative = conservativeAffordablePrice(scenario.income, scenario.debt, scenario.savings);
  const median = hmda?.markets[scenario.market]?.priceMedian ?? scenario.price;
  const width = 440;
  const barX = 20;
  const barW = width - 40;
  const lo = Math.min(conservative, scenario.price, median) * 0.85;
  const hi = Math.max(maxPrice, scenario.price, median) * 1.08;
  const x = (v: number) => barX + ((v - lo) / (hi - lo)) * barW;

  const markers = [
    { value: conservative, label: "Conservative", color: "var(--teal)" },
    { value: maxPrice, label: "36% DTI max", color: "var(--chart-positive)" },
    { value: scenario.price, label: "Your target", color: "var(--you)" },
    { value: median, label: `${scenario.market} median`, color: "var(--muted)" },
  ].sort((a, b) => a.value - b.value);

  return (
    <svg viewBox="0 0 440 130" className="affordable-price-band" role="img" aria-label="Affordable home price band">
      <text fontSize="10" fontWeight="700" fill="var(--ink)" y={14}>
        Affordable price range
      </text>
      <text fontSize="9" fill="var(--muted)" y={28}>
        Based on 32–36% back-end DTI at current income and debt
      </text>
      <rect x={barX} y={44} width={barW} height={12} rx={6} fill="var(--line)" opacity={0.35} />
      <rect
        x={x(conservative)}
        y={44}
        width={Math.max(x(maxPrice) - x(conservative), 4)}
        height={12}
        rx={6}
        fill="var(--teal)"
        opacity={0.35}
      />
      {markers.map((m) => (
        <g key={m.label}>
          <line x1={x(m.value)} y1={38} x2={x(m.value)} y2={62} stroke={m.color} strokeWidth={2} />
          <circle cx={x(m.value)} cy={50} r={4} fill={m.color} />
          <text fontSize="8" fill={m.color} x={x(m.value)} y={78} textAnchor="middle">
            {m.label}
          </text>
          <text fontSize="8" fontWeight="700" fill="var(--ink)" x={x(m.value)} y={90} textAnchor="middle">
            {money.format(m.value)}
          </text>
        </g>
      ))}
      <text fontSize="8" fill="var(--muted)" x={barX} y={118}>
        {scenario.price > maxPrice
          ? "Target price is above the 36% DTI ceiling — consider lowering price or debt."
          : scenario.price <= conservative
            ? "Target sits in the conservative band."
            : "Target is within stretch range — watch DTI and reserves."}
      </text>
    </svg>
  );
}
