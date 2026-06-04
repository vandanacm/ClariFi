import type { ScoreResult } from "../types";

const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

export function CounterfactualBar({ score }: { score: ScoreResult }) {
  const current = score.approvalLikelihood ?? 0;
  const cf = score.counterfactual;
  const after = cf?.newApproval ?? current;
  const width = 440;
  const barH = 36;
  const maxVal = Math.max(current, after, 0.15) * 1.15;
  const scale = (v: number) => (v / maxVal) * (width - 140);

  if (!cf) {
    return (
      <svg viewBox={`0 0 ${width} 100`} className="counterfactual-bar" role="img">
        <text fontSize="10" fill="var(--muted)" x={0} y={40}>
          Adjust sliders to see the top model-backed improvement suggestion.
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} 120`} className="counterfactual-bar" role="img" aria-label="Before and after approval improvement">
      <text fontSize="10" fontWeight="700" fill="var(--ink)" y={14}>
        Top improvement
      </text>
      <text fontSize="9" fill="var(--muted)" y={28}>
        {cf.suggestion}
      </text>

      <text fontSize="9" fill="var(--muted)" x={0} y={58}>Now</text>
      <rect x={50} y={44} width={Math.max(scale(current), 4)} height={barH} rx={4} fill="var(--muted)" opacity={0.5} />
      <text fontSize="11" fontWeight="800" fill="var(--ink)" x={60 + scale(current)} y={66}>
        {pct.format(current)}
      </text>

      <text fontSize="9" fill="var(--muted)" x={0} y={98}>After</text>
      <rect x={50} y={84} width={Math.max(scale(after), 4)} height={barH} rx={4} fill="var(--teal)" opacity={0.85} />
      <text fontSize="11" fontWeight="800" fill="var(--teal)" x={60 + scale(after)} y={106}>
        {pct.format(after)} (+{pct.format(cf.delta)})
      </text>
    </svg>
  );
}
