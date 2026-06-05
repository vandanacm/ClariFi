import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import type { ScenarioInput, ScoreResult } from "../types";
import { api } from "../api";

type Props = {
  score: ScoreResult;
  scenario: ScenarioInput;
  onCellClick?: (dti: number, downPayment: number) => void;
  agentAnnotation?: { dti?: number; dp?: number } | null;
};

type RiskGridCell = { dti: number; dp: number; approval: number };

const _dtiSteps = d3.range(0.15, 0.56, 0.05);
const _dpSteps = d3.range(0.05, 0.31, 0.05);

/** Grid cells are API-backed approval probabilities; click pushes DTI/DP into the simulator. */
export function RiskSurface({ score, scenario, onCellClick, agentAnnotation }: Props) {
  const W = 480;
  const H = 300;
  const mg = { top: 32, right: 20, bottom: 52, left: 68 };
  const cellW = (W - mg.left - mg.right) / _dtiSteps.length;
  const cellH = (H - mg.top - mg.bottom) / _dpSteps.length;

  const [modelGrid, setModelGrid] = useState<RiskGridCell[] | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .riskGrid(scenario)
      .then((grid) => {
        if (!ignore) setModelGrid(grid);
      })
      .catch(() => {
        if (!ignore) setModelGrid(null);
      });
    return () => { ignore = true; };
  }, [scenario.market, scenario.income, scenario.price, scenario.savings]);

  const gridLookup = useMemo(() => {
    if (!modelGrid) return null;
    const map = new Map<string, number>();
    for (const cell of modelGrid) {
      map.set(`${cell.dti.toFixed(2)}-${cell.dp.toFixed(2)}`, cell.approval);
    }
    return map;
  }, [modelGrid]);

  const colorScale = useMemo(() => {
    const vals = modelGrid?.map((c) => c.approval) ?? [];
    if (!vals.length) return d3.scaleSequential([0.2, 0.95], d3.interpolateRdYlGn);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = Math.max((hi - lo) * 0.05, 0.02);
    return d3.scaleSequential([lo - pad, hi + pad], d3.interpolateRdYlGn);
  }, [modelGrid]);

  const uCol = _dtiSteps.reduce(
    (best, d, i) =>
      Math.abs(d - score.dti) < Math.abs(_dtiSteps[best] - score.dti) ? i : best,
    0
  );
  const uRow = _dpSteps
    .slice()
    .reverse()
    .reduce(
      (best, d, i) =>
        Math.abs(d - score.downPaymentRate) <
        Math.abs(_dpSteps.slice().reverse()[best] - score.downPaymentRate)
          ? i
          : best,
      0
    );

  const annotCol = agentAnnotation?.dti != null
    ? _dtiSteps.reduce((best, d, i) => Math.abs(d - agentAnnotation.dti!) < Math.abs(_dtiSteps[best] - agentAnnotation.dti!) ? i : best, 0)
    : null;
  const annotRow = agentAnnotation?.dp != null
    ? _dpSteps.slice().reverse().reduce((best, d, i) => Math.abs(d - agentAnnotation.dp!) < Math.abs(_dpSteps.slice().reverse()[best] - agentAnnotation.dp!) ? i : best, 0)
    : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="risk-surface"
      role="img"
      aria-label="DTI vs down payment approval likelihood surface"
    >
      {_dpSteps
        .slice()
        .reverse()
        .map((dp, row) =>
          _dtiSteps.map((dti, col) => {
            const key = `${dti.toFixed(2)}-${dp.toFixed(2)}`;
            const approval = gridLookup?.get(key) ?? _heuristicApproval(dti, dp);
            const isHovered = hoveredCell?.row === row && hoveredCell?.col === col;
            const isAnnotated = annotCol === col && annotRow === row;
            return (
              <rect
                key={`${row}-${col}`}
                x={mg.left + col * cellW}
                y={mg.top + row * cellH}
                width={cellW - 1}
                height={cellH - 1}
                fill={colorScale(approval)}
                rx={2}
                stroke={isAnnotated ? "var(--you)" : isHovered ? "var(--ink)" : "none"}
                strokeWidth={isAnnotated ? 3 : isHovered ? 2 : 0}
                style={{ cursor: onCellClick ? "pointer" : "default", transition: "stroke 100ms ease" }}
                onMouseEnter={() => setHoveredCell({ row, col })}
                onMouseLeave={() => setHoveredCell(null)}
                onClick={() => onCellClick?.(dti, dp)}
              >
                <title>
                  DTI {(dti * 100).toFixed(0)}% · Down {(dp * 100).toFixed(0)}% → {(approval * 100).toFixed(0)}% approval
                  {gridLookup ? " (XGBoost)" : " (estimate)"}
                </title>
              </rect>
            );
          })
        )}
      {(() => {
        const cx = mg.left + uCol * cellW + cellW / 2;
        const cy = mg.top + uRow * cellH + cellH / 2;
        return (
          <g className="risk-surface-you" aria-hidden>
            <circle
              className="pulse-ring"
              cx={cx}
              cy={cy}
              r={16}
              fill="none"
              stroke="var(--you)"
              strokeWidth={2}
              opacity={0.55}
            />
            <circle
              cx={cx}
              cy={cy}
              r={13}
              fill="var(--chart-surface)"
              stroke="var(--you)"
              strokeWidth={2.5}
              opacity={0.96}
            />
            <circle
              className="risk-surface-you-dot"
              cx={cx}
              cy={cy}
              r={7}
              strokeWidth={2}
            />
            <g transform={`translate(${cx}, ${mg.top + uRow * cellH - 10})`}>
              <rect
                className="user-profile-pill"
                x={-18}
                y={-12}
                width={36}
                height={14}
                rx={7}
                strokeWidth={1}
              />
              <text
                className="user-marker-label-on-pill"
                textAnchor="middle"
                y={-1}
              >
                You
              </text>
            </g>
          </g>
        );
      })()}
      {hoveredCell && (
        <text
          fontSize="9"
          fontWeight="700"
          fill="var(--ink)"
          x={mg.left + hoveredCell.col * cellW + cellW / 2}
          y={mg.top + hoveredCell.row * cellH - 4}
          textAnchor="middle"
        >
          Click to apply
        </text>
      )}
      {_dtiSteps.map((dti, i) => (
        <text
          key={dti}
          fontSize="9"
          fill="var(--muted)"
          textAnchor="middle"
          x={mg.left + i * cellW + cellW / 2}
          y={H - mg.bottom + 14}
        >
          {(dti * 100).toFixed(0)}%
        </text>
      ))}
      {_dpSteps
        .slice()
        .reverse()
        .map((dp, i) => (
          <text
            key={dp}
            fontSize="9"
            fill="var(--muted)"
            textAnchor="end"
            x={mg.left - 6}
            y={mg.top + i * cellH + cellH / 2 + 4}
          >
            {(dp * 100).toFixed(0)}%
          </text>
        ))}
      <text
        fontSize="10"
        fill="var(--muted)"
        textAnchor="middle"
        x={mg.left + (W - mg.left - mg.right) / 2}
        y={H - 8}
      >
        DTI ratio
      </text>
      <text
        fontSize="10"
        fill="var(--muted)"
        textAnchor="middle"
        transform={`rotate(-90 14 ${mg.top + (H - mg.top - mg.bottom) / 2})`}
        x={14}
        y={mg.top + (H - mg.top - mg.bottom) / 2}
      >
        Down payment %
      </text>
      <text
        fontSize="8"
        fill="var(--muted)"
        x={W - mg.right}
        y={mg.top - 4}
        textAnchor="end"
        opacity={0.7}
      >
        {gridLookup ? "XGBoost predictions" : "heuristic estimates"}
      </text>
    </svg>
  );
}

function _heuristicApproval(dti: number, dp: number): number {
  const s = Math.min(
    Math.max(
      34 +
        dp * 118 +
        (1 - Math.abs(dti - 0.32)) * 26 -
        Math.max(dti - 0.36, 0) * 360 +
        1000 / 1800,
      18
    ),
    96
  );
  return Math.min(Math.max(0.52 + (s - 60) / 130, 0.08), 0.97);
}
