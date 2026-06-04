import { money } from "./chart-utils";
import type { ScenarioInput, ScoreResult } from "../types";

export function DtiDecomposition({
  scenario,
  score,
}: {
  scenario: ScenarioInput;
  score: ScoreResult;
}) {
  const frontEnd = score.monthlyHousing / Math.max(scenario.income, 1);
  const debtOnly = scenario.debt / Math.max(scenario.income, 1);
  const width = 440;
  const barW = width - 120;
  const x = (v: number) => v * barW;

  return (
    <svg viewBox="0 0 440 118" className="dti-decomposition" role="img" aria-label="DTI breakdown by housing and debt">
      <text fontSize="9" fill="var(--muted)" y={14}>
        How housing and debt share your monthly income
      </text>

      <text fontSize="9" fill="var(--muted)" x={0} y={38}>Housing</text>
      <rect x={110} y={26} width={barW} height={16} rx={4} fill="var(--line)" opacity={0.35} />
      <rect x={110} y={26} width={Math.max(x(frontEnd), 2)} height={16} rx={4} fill="var(--blue)" opacity={0.85} />
      <text fontSize="9" fontWeight="700" fill="var(--ink)" x={110 + barW + 8} y={38}>
        {(frontEnd * 100).toFixed(1)}% · {money.format(score.monthlyHousing)}
      </text>

      <text fontSize="9" fill="var(--muted)" x={0} y={68}>Other debt</text>
      <rect x={110} y={56} width={barW} height={16} rx={4} fill="var(--line)" opacity={0.35} />
      <rect x={110} y={56} width={Math.max(x(debtOnly), 2)} height={16} rx={4} fill="var(--rose)" opacity={0.85} />
      <text fontSize="9" fontWeight="700" fill="var(--ink)" x={110 + barW + 8} y={68}>
        {(debtOnly * 100).toFixed(1)}% · {money.format(scenario.debt)}
      </text>

      <text fontSize="9" fill="var(--muted)" x={0} y={98}>Total DTI</text>
      <rect x={110} y={86} width={barW} height={16} rx={4} fill="var(--line)" opacity={0.35} />
      <rect x={110} y={86} width={Math.max(x(score.dti), 2)} height={16} rx={4} fill="var(--teal)" opacity={0.85} />
      <line x1={110 + x(0.36)} y1={84} x2={110 + x(0.36)} y2={104} stroke="var(--you)" strokeWidth={1.5} strokeDasharray="3,2" />
      <text fontSize="8" fill="var(--you)" x={110 + x(0.36) + 2} y={112}>36% guideline</text>
      <text fontSize="9" fontWeight="700" fill="var(--ink)" x={110 + barW + 8} y={98}>
        {(score.dti * 100).toFixed(1)}%
      </text>
    </svg>
  );
}
