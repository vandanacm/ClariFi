import { money } from "./chart-utils";
import {
  conservativeAffordablePrice,
  maxAffordablePrice,
} from "./mortgage-utils";
import type { HmdaModel, ScenarioInput } from "../types";

type Marker = {
  id: string;
  value: number;
  shortLabel: string;
  color: string;
};

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

  const markers: Marker[] = [
    { id: "conservative", value: conservative, shortLabel: "32% DTI cap", color: "var(--teal)" },
    { id: "target", value: scenario.price, shortLabel: "Your target", color: "var(--you)" },
    { id: "max", value: maxPrice, shortLabel: "36% DTI cap", color: "var(--chart-positive)" },
    {
      id: "median",
      value: median,
      shortLabel: `${scenario.market} median`,
      color: "var(--muted)",
    },
  ].sort((a, b) => a.value - b.value);

  const width = 440;
  const barX = 20;
  const barW = width - 40;
  const lo = Math.min(conservative, scenario.price, median) * 0.85;
  const hi = Math.max(maxPrice, scenario.price, median) * 1.08;
  const x = (v: number) => barX + ((v - lo) / (hi - lo)) * barW;

  const footer =
    scenario.price > maxPrice
      ? "Your target is above the 36% DTI ceiling — try lowering price or debt."
      : scenario.price <= conservative
        ? "Your target sits in the conservative band."
        : "Your target is in the stretch band — keep an eye on DTI and cash reserves.";

  return (
    <div className="affordable-price-band-wrap">
      <svg
        viewBox="0 0 440 56"
        className="affordable-price-band"
        role="img"
        aria-label="Affordable home price band"
      >
        <rect x={barX} y={22} width={barW} height={12} rx={6} fill="var(--line)" opacity={0.35} />
        <rect
          x={x(conservative)}
          y={22}
          width={Math.max(x(maxPrice) - x(conservative), 4)}
          height={12}
          rx={6}
          fill="var(--teal)"
          opacity={0.35}
        />
        {markers.map((m) => (
          <g key={m.id}>
            <line
              x1={x(m.value)}
              y1={14}
              x2={x(m.value)}
              y2={40}
              stroke={m.color}
              strokeWidth={2}
            />
            <circle cx={x(m.value)} cy={28} r={4} fill={m.color} />
          </g>
        ))}
      </svg>
      <ul className="afford-price-legend" aria-hidden>
        {markers.map((m) => (
          <li key={m.id}>
            <span className="afford-legend-dot" style={{ background: m.color }} />
            <span className="afford-legend-label">{m.shortLabel}</span>
            <strong>{money.format(m.value)}</strong>
          </li>
        ))}
      </ul>
      <p className="afford-price-footer">{footer}</p>
    </div>
  );
}
