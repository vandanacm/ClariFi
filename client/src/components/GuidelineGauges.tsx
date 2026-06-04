import type { ScoreResult } from "../types";

type GaugeProps = {
  label: string;
  value: number;
  domain: [number, number];
  zones: Array<{ end: number; color: string; label: string }>;
  format: (v: number) => string;
};

function HorizontalGauge({ label, value, domain, zones, format }: GaugeProps) {
  const width = 440;
  const barY = 28;
  const barH = 14;
  const [lo, hi] = domain;
  const span = hi - lo;
  const x = (v: number) => 12 + ((v - lo) / span) * (width - 24);
  const markerX = Math.min(Math.max(x(value), 12), width - 12);

  return (
    <g>
      <text fontSize="10" fontWeight="700" fill="var(--ink)" x={0} y={12}>
        {label}
      </text>
      <text fontSize="10" fontWeight="800" fill="var(--teal)" x={width} y={12} textAnchor="end">
        {format(value)}
      </text>
      {zones.map((zone, i) => {
        const start = i === 0 ? lo : zones[i - 1].end;
        const end = zone.end;
        return (
          <rect
            key={zone.label}
            x={x(start)}
            y={barY}
            width={Math.max(x(end) - x(start), 2)}
            height={barH}
            fill={zone.color}
            opacity={0.75}
            rx={3}
          />
        );
      })}
      <line x1={markerX} y1={barY - 4} x2={markerX} y2={barY + barH + 4} stroke="var(--you)" strokeWidth={2.5} />
      <circle cx={markerX} cy={barY + barH / 2} r={5} fill="var(--you)" />
      <text fontSize="8" fill="var(--muted)" y={barY + barH + 14}>
        {zones.map((z) => z.label).join(" · ")}
      </text>
    </g>
  );
}

export function GuidelineGauges({ score }: { score: ScoreResult }) {
  const height = 120;
  return (
    <svg viewBox={`0 0 440 ${height}`} className="guideline-gauges" role="img" aria-label="DTI and down payment guideline gauges">
      <HorizontalGauge
        label="Debt-to-income"
        value={score.dti}
        domain={[0.15, 0.5]}
        zones={[
          { end: 0.36, color: "#10b981", label: "Ideal <36%" },
          { end: 0.43, color: "#f59e0b", label: "Stretch 36–43%" },
          { end: 0.5, color: "#ef4444", label: "High >43%" },
        ]}
        format={(v) => `${(v * 100).toFixed(1)}%`}
      />
      <g transform="translate(0, 58)">
        <HorizontalGauge
          label="Down payment"
          value={score.downPaymentRate}
          domain={[0, 0.25]}
          zones={[
            { end: 0.03, color: "#ef4444", label: "3%" },
            { end: 0.05, color: "#f59e0b", label: "5%" },
            { end: 0.1, color: "#eab308", label: "10%" },
            { end: 0.2, color: "#84cc16", label: "20% (no PMI)" },
            { end: 0.25, color: "#10b981", label: "20%+" },
          ]}
          format={(v) => `${(v * 100).toFixed(1)}%`}
        />
      </g>
    </svg>
  );
}
