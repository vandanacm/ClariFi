import * as d3 from "d3";

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function chartExtent(
  values: number[],
  fallback: [number, number],
  pad = 0.08
): [number, number] {
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!valid.length) return fallback;
  const sorted = [...valid].sort(d3.ascending);
  const lo = d3.quantile(sorted, 0.03) ?? sorted[0];
  const hi = d3.quantile(sorted, 0.97) ?? sorted[sorted.length - 1];
  const span = Math.max(hi - lo, 1);
  return [Math.max(0, lo - span * pad), hi + span * pad];
}

export function domainIncluding(
  value: number,
  domain: [number, number],
  padRatio = 0.06
): [number, number] {
  if (!Number.isFinite(value)) return domain;
  let [lo, hi] = domain;
  if (value < lo) lo = value - (hi - lo) * padRatio;
  if (value > hi) hi = value + (hi - lo) * padRatio;
  return [lo, hi];
}

export function getRoundedTopPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const currentR = Math.min(r, h, w / 2);
  if (currentR <= 0)
    return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
  return `M ${x},${y + h} L ${x},${y + currentR} A ${currentR},${currentR} 0 0 1 ${x + currentR},${y} L ${x + w - currentR},${y} A ${currentR},${currentR} 0 0 1 ${x + w},${y + currentR} L ${x + w},${y + h} Z`;
}
