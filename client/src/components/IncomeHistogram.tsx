import { useMemo, useState } from "react";
import * as d3 from "d3";
import { chartExtent, domainIncluding, getRoundedTopPath } from "./chart-utils";
import type { HmdaModel, ScenarioInput } from "../types";

type Props = {
  hmda: HmdaModel;
  scenario: ScenarioInput;
  selectedCounty?: string | null;
  onBrushIncome?: (income: number | null) => void;
};

function findIncomeBin(
  bins: Array<d3.Bin<{ incomeMonthly: number; approved: boolean }, number>>,
  income: number
) {
  return (
    bins.find(
      (b) => income >= (b.x0 ?? 0) && income < (b.x1 ?? Infinity)
    ) ?? null
  );
}

function binCenter(
  bin: d3.Bin<{ incomeMonthly: number; approved: boolean }, number>
) {
  return ((bin.x0 ?? 0) + (bin.x1 ?? 0)) / 2;
}

function binStats(
  bin: d3.Bin<{ incomeMonthly: number; approved: boolean }, number>
) {
  const approved = bin.filter((d) => d.approved).length;
  return { approved, denied: bin.length - approved, total: bin.length };
}

/** Brushing a bin calls onBrushIncome so scatter/map can filter to the same income band. */
export function IncomeHistogram({
  hmda,
  scenario,
  selectedCounty = null,
  onBrushIncome,
}: Props) {
  const W = 480;
  const H = 272;
  const mg = { top: 52, right: 16, bottom: 44, left: 40 };
  const plotW = W - mg.left - mg.right;
  const plotH = H - mg.top - mg.bottom;

  const points = useMemo(() => {
    let filtered = hmda.scatter.filter((p) =>
      p.marketTags.includes(scenario.market)
    );
    if (selectedCounty) {
      filtered = filtered.filter((p) => p.county === selectedCounty);
    }
    return filtered;
  }, [hmda.scatter, scenario.market, selectedCounty]);

  const domain = useMemo<[number, number]>(() => {
    const incomes = points.map((p) => p.incomeMonthly);
    const base = chartExtent(incomes, [3500, 18000]);
    return domainIncluding(scenario.income, base);
  }, [points, scenario.income]);

  const x = d3.scaleLinear(domain, [mg.left, W - mg.right]);

  const bins = d3
    .histogram<{ incomeMonthly: number; approved: boolean }, number>()
    .value((d) => d.incomeMonthly)
    .domain(domain)
    .thresholds(x.ticks(8))(points);

  const maxCount = d3.max(bins, (b) => b.length) ?? 1;
  const y = d3.scaleLinear([0, maxCount], [H - mg.bottom, mg.top]);

  const userBin = useMemo(
    () => findIncomeBin(bins, scenario.income),
    [bins, scenario.income]
  );
  const userX = Math.min(
    Math.max(x(scenario.income), mg.left),
    W - mg.right
  );

  const [hoverBin, setHoverBin] =
    useState<d3.Bin<
      { incomeMonthly: number; approved: boolean },
      number
    > | null>(null);

  const hoverStats =
    hoverBin && hoverBin.length > 0 ? binStats(hoverBin) : null;
  const userStats =
    userBin && userBin.length > 0 ? binStats(userBin) : null;
  const hoverX = hoverBin
    ? Math.min(Math.max(x(binCenter(hoverBin)), mg.left), W - mg.right)
    : null;
  const sameAsUser =
    hoverBin != null &&
    userBin != null &&
    (hoverBin.x0 ?? 0) === (userBin.x0 ?? 0) &&
    (hoverBin.x1 ?? 0) === (userBin.x1 ?? 0);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = W / rect.width;
    const svgX = (e.clientX - rect.left) * scale;
    if (svgX < mg.left || svgX > W - mg.right) {
      setHoverBin(null);
      onBrushIncome?.(null);
      return;
    }
    const bin = findIncomeBin(bins, x.invert(svgX));
    setHoverBin(bin);
    onBrushIncome?.(bin ? binCenter(bin) : null);
  };

  const infoLine = hoverStats
    ? sameAsUser
      ? `Your income · $${(scenario.income / 1000).toFixed(1)}k/mo · ${hoverStats.approved} approved · ${hoverStats.denied} denied`
      : `$${((hoverBin?.x0 ?? 0) / 1000).toFixed(0)}k–$${((hoverBin?.x1 ?? 0) / 1000).toFixed(0)}k/mo · ${hoverStats.approved} approved · ${hoverStats.denied} denied`
    : userStats
      ? `Your income · $${(scenario.income / 1000).toFixed(1)}k/mo · ${userStats.approved} approved · ${userStats.denied} denied in your band`
      : `Your income · $${(scenario.income / 1000).toFixed(1)}k/mo`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="histogram-chart"
      role="img"
      aria-label="Histogram of HMDA applications by monthly income"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoverBin(null);
        onBrushIncome?.(null);
      }}
    >
      <defs>
        <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-approved-start)" />
          <stop offset="100%" stopColor="var(--chart-approved-end)" />
        </linearGradient>
        <linearGradient id="deniedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-denied-start)" />
          <stop offset="100%" stopColor="var(--chart-denied-end)" />
        </linearGradient>
      </defs>

      <rect
        x={mg.left}
        y={mg.top}
        width={plotW}
        height={plotH}
        rx={8}
        fill="var(--soft)"
        opacity={0.55}
      />

      <text
        x={mg.left}
        y={18}
        fontSize="10"
        fontWeight="700"
        fill="var(--ink)"
      >
        {infoLine}
      </text>

      <g
        className="histogram-legend"
        transform={`translate(${W - mg.right - 76}, 8)`}
      >
        <rect x={0} y={0} width={8} height={8} rx={2} fill="url(#approvedGrad)" />
        <text fontSize="9" fontWeight="700" fill="var(--muted)" x={12} y={8}>
          Approved
        </text>
        <rect x={0} y={14} width={8} height={8} rx={2} fill="url(#deniedGrad)" />
        <text fontSize="9" fontWeight="700" fill="var(--muted)" x={12} y={22}>
          Denied
        </text>
      </g>

      {[0.25, 0.5, 0.75, 1].map((p, idx) => {
        const ly = y(maxCount * p);
        return (
          <line
            key={idx}
            x1={mg.left}
            y1={ly}
            x2={W - mg.right}
            y2={ly}
            stroke="var(--line)"
            strokeOpacity={0.2}
          />
        );
      })}

      <line
        x1={mg.left}
        y1={H - mg.bottom}
        x2={W - mg.right}
        y2={H - mg.bottom}
        stroke="var(--line)"
        opacity={0.45}
      />

      {bins.map((bin, i) => {
        const pad = 2;
        const bx = x(bin.x0 ?? 0) + pad;
        const bw = Math.max(x(bin.x1 ?? 0) - x(bin.x0 ?? 0) - pad * 2, 2);
        const { approved, denied } = binStats(bin);
        const baseline = H - mg.bottom;
        const yApproved = y(approved);
        const approvedH = baseline - yApproved;
        const deniedH = baseline - y(denied);
        const isUser =
          userBin != null &&
          (bin.x0 ?? 0) === (userBin.x0 ?? 0) &&
          (bin.x1 ?? 0) === (userBin.x1 ?? 0);
        const isHover =
          hoverBin != null &&
          (bin.x0 ?? 0) === (hoverBin.x0 ?? 0) &&
          (bin.x1 ?? 0) === (hoverBin.x1 ?? 0);

        return (
          <g
            key={i}
            aria-label={`${approved} approved, ${denied} denied`}
          >
            {(isUser || isHover) && (
              <rect
                x={bx - 1}
                y={mg.top}
                width={bw + 2}
                height={plotH}
                fill={
                  isUser
                    ? "var(--you)"
                    : "var(--chart-brush-stroke)"
                }
                opacity={isUser ? 0.1 : 0.07}
                rx={4}
              />
            )}
            {approved > 0 &&
              (denied > 0 ? (
                <rect
                  x={bx}
                  y={yApproved}
                  width={bw}
                  height={approvedH}
                  fill="url(#approvedGrad)"
                />
              ) : (
                <path
                  d={getRoundedTopPath(bx, yApproved, bw, approvedH, 3)}
                  fill="url(#approvedGrad)"
                />
              ))}
            {denied > 0 && (
              <path
                d={getRoundedTopPath(
                  bx,
                  yApproved - deniedH,
                  bw,
                  deniedH,
                  3
                )}
                fill="url(#deniedGrad)"
              />
            )}
          </g>
        );
      })}

      <g style={{ pointerEvents: "none" }}>
        <line
          x1={userX}
          y1={mg.top}
          x2={userX}
          y2={H - mg.bottom}
          stroke="var(--you)"
          strokeWidth={2}
          opacity={0.85}
        />
        <polygon
          points={`${userX},${H - mg.bottom} ${userX - 5},${H - mg.bottom + 7} ${userX + 5},${H - mg.bottom + 7}`}
          fill="var(--you)"
        />
        {hoverX != null && !sameAsUser && (
          <line
            x1={hoverX}
            y1={mg.top}
            x2={hoverX}
            y2={H - mg.bottom}
            stroke="var(--chart-brush-stroke)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.9}
          />
        )}
      </g>

      {x.ticks(5).map((tick) => (
        <text
          key={tick}
          fontSize="9"
          fill="var(--muted)"
          fontWeight="600"
          textAnchor="middle"
          x={x(tick)}
          y={H - mg.bottom + 16}
        >
          ${(tick / 1000).toFixed(0)}k
        </text>
      ))}

      <text
        fontSize="10"
        fill="var(--muted)"
        fontWeight="600"
        textAnchor="middle"
        x={mg.left + plotW / 2}
        y={H - 4}
      >
        Monthly income
      </text>
    </svg>
  );
}
