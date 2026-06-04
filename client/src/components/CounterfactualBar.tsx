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
      <p className="chart-empty-note">
        Tighten debt or raise down payment — the model will suggest your best next step here.
      </p>
    );
  }

  const barStart = 50;
  const labelPad = 8;
  const nowW = Math.max(scale(current), 4);
  const afterW = Math.max(scale(after), 4);
  const nowEnd = barStart + nowW;
  const afterEnd = barStart + afterW;
  const labelsOverlap = Math.abs(nowEnd - afterEnd) < 48;

  return (
    <svg viewBox={`0 0 ${width} 108`} className="counterfactual-bar" role="img" aria-label="Before and after approval improvement">
      <text fontSize="9" fill="var(--muted)" x={0} y={18}>
        {cf.suggestion}
      </text>

      <text fontSize="9" fill="var(--muted)" x={0} y={48}>Now</text>
      <rect x={barStart} y={34} width={nowW} height={barH} rx={4} fill="var(--muted)" opacity={0.5} />
      <text
        fontSize="11"
        fontWeight="800"
        fill="var(--ink)"
        x={labelsOverlap ? barStart + nowW + labelPad : barStart + nowW + labelPad}
        y={56}
        textAnchor="start"
      >
        {pct.format(current)}
      </text>

      <text fontSize="9" fill="var(--muted)" x={0} y={92}>After</text>
      <rect x={barStart} y={78} width={afterW} height={barH} rx={4} fill="var(--teal)" opacity={0.85} />
      <text
        fontSize="11"
        fontWeight="800"
        fill="var(--teal)"
        x={labelsOverlap ? width - 8 : barStart + afterW + labelPad}
        y={labelsOverlap ? 56 : 100}
        textAnchor={labelsOverlap ? "end" : "start"}
      >
        {pct.format(after)}
        {cf.delta > 0.005 ? ` (+${pct.format(cf.delta)})` : ""}
      </text>
      {labelsOverlap && cf.delta <= 0.005 && (
        <text fontSize="9" fill="var(--muted)" x={width - 8} y={100} textAnchor="end">
          Little change at this step — try another slider
        </text>
      )}
    </svg>
  );
}
