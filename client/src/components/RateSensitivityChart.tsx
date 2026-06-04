import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { api } from "../api";
import { computeRateSensitivityLocal } from "./mortgage-utils";
import type { RateSensitivityPoint, ScenarioInput, ScoreResult } from "../types";

export function RateSensitivityChart({
  scenario,
  score,
}: {
  scenario: ScenarioInput;
  score: ScoreResult;
}) {
  const localPoints = useMemo(
    () => computeRateSensitivityLocal(scenario, score),
    [scenario, score]
  );
  const [remotePoints, setRemotePoints] = useState<RateSensitivityPoint[] | null>(null);
  const scenarioKey = useMemo(() => JSON.stringify(scenario), [scenario]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.rateSensitivity(scenario).then((data) => {
        if (!cancelled && data.length > 0) setRemotePoints(data);
      }).catch(() => {
        if (!cancelled) setRemotePoints(null);
      });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [scenarioKey, scenario]);

  const points = remotePoints ?? localPoints;
  const width = 440;
  const height = 150;
  const mg = { top: 8, right: 52, bottom: 26, left: 36 };
  const plotW = width - mg.left - mg.right;
  const plotH = height - mg.top - mg.bottom;

  const { x, yPay, yAppr, baseIdx } = useMemo(() => {
    const rates = points.map((p) => p.rate);
    const payments = points.map((p) => p.payment);
    const approvals = points.map((p) => p.approval);
    const payPad = Math.max((d3.max(payments)! - d3.min(payments)!) * 0.12, 40);
    const apprLo = d3.min(approvals)!;
    const apprHi = d3.max(approvals)!;
    const apprPad = Math.max((apprHi - apprLo) * 0.15, 0.02);
    return {
      x: d3.scaleLinear().domain([d3.min(rates)!, d3.max(rates)!]).range([0, plotW]),
      yPay: d3
        .scaleLinear()
        .domain([d3.min(payments)! - payPad, d3.max(payments)! + payPad])
        .range([plotH, 0]),
      yAppr: d3
        .scaleLinear()
        .domain([Math.max(0, apprLo - apprPad), Math.min(1, apprHi + apprPad)])
        .range([plotH, 0]),
      baseIdx: points.findIndex((p) => Math.abs(p.rate - 0.0725) < 0.001),
    };
  }, [points, plotW, plotH]);

  const payLine = d3.line<RateSensitivityPoint>().x((d) => x(d.rate)).y((d) => yPay(d.payment));
  const apprLine = d3.line<RateSensitivityPoint>().x((d) => x(d.rate)).y((d) => yAppr(d.approval));
  const payTicks = yPay.ticks(4);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="rate-sensitivity-chart" role="img" aria-label="Rate sensitivity for payment and approval">
      <g transform={`translate(${mg.left},${mg.top})`}>
        {payTicks.map((tick) => (
          <g key={tick}>
            <line x1={0} y1={yPay(tick)} x2={plotW} y2={yPay(tick)} stroke="var(--line)" strokeWidth={0.6} opacity={0.35} />
            <text fontSize="7" fill="var(--muted)" x={-4} y={yPay(tick) + 3} textAnchor="end">
              ${Math.round(tick / 100) * 100}
            </text>
          </g>
        ))}
        <path d={payLine(points) ?? ""} fill="none" stroke="var(--blue)" strokeWidth={2.2} />
        <path d={apprLine(points) ?? ""} fill="none" stroke="var(--teal)" strokeWidth={2} strokeDasharray="5,3" />
        {baseIdx >= 0 && (
          <line
            x1={x(points[baseIdx].rate)}
            y1={0}
            x2={x(points[baseIdx].rate)}
            y2={plotH}
            stroke="var(--you)"
            strokeWidth={1}
            opacity={0.55}
          />
        )}
        {points.map((p) => (
          <g key={p.rate}>
            <circle cx={x(p.rate)} cy={yPay(p.payment)} r={3} fill="var(--blue)" />
            <circle cx={x(p.rate)} cy={yAppr(p.approval)} r={2.5} fill="var(--teal)" />
          </g>
        ))}
        {points.filter((_, i) => i % 2 === 0).map((p) => (
          <text key={`${p.rate}-x`} fontSize="7" fill="var(--muted)" x={x(p.rate)} y={plotH + 14} textAnchor="middle">
            {(p.rate * 100).toFixed(1)}%
          </text>
        ))}
      </g>

      <g transform={`translate(${width - 48}, ${mg.top})`}>
        <line x1={0} y1={0} x2={12} y2={0} stroke="var(--blue)" strokeWidth={2} />
        <text fontSize="8" fill="var(--muted)" x={16} y={4}>Payment</text>
        <line x1={0} y1={14} x2={12} y2={14} stroke="var(--teal)" strokeWidth={2} strokeDasharray="4,2" />
        <text fontSize="8" fill="var(--muted)" x={16} y={18}>Approval</text>
      </g>

      <text fontSize="8" fill="var(--muted)" x={mg.left} y={height - 2}>
        {remotePoints ? "XGBoost approval curve" : "Local estimate · start backend for model curve"}
      </text>
    </svg>
  );
}
