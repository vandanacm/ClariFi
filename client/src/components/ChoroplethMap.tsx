import { useMemo, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { HmdaModel, ScenarioInput } from "../types";

import usAtlasData from "us-atlas/counties-10m.json";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _caGeo = feature(usAtlasData as any, (usAtlasData as any).objects.counties) as unknown as GeoJSON.FeatureCollection;
const caFeatures = _caGeo.features.filter((f) => String(f.id).startsWith("06"));

const _choroplethProjection = d3.geoMercator().fitExtent(
  [[10, 10], [490, 570]],
  { type: "FeatureCollection" as const, features: caFeatures }
);
const _choroplethPath = d3.geoPath(_choroplethProjection);

type Props = {
  hmda: HmdaModel;
  scenario: ScenarioInput;
  selectedCounty?: string | null;
  scatterBrushedCounty?: string | null;
  onCountySelect?: (county: string | null) => void;
  onMarketSelect?: (market: string) => void;
};

export function ChoroplethMap({
  hmda,
  scenario,
  selectedCounty = null,
  scatterBrushedCounty = null,
  onCountySelect,
  onMarketSelect,
}: Props) {
  const readinessMap = useMemo(() => {
    const map: Record<
      string,
      { readiness: number; approvalRate?: number; applications?: number; dataSource?: string }
    > = {};
    if (hmda.counties) {
      Object.entries(hmda.counties).forEach(([name, county]) => {
        map[name] = {
          readiness: county.readiness,
          approvalRate: county.approvalRate,
          applications: county.applications,
          dataSource: county.dataSource,
        };
      });
    } else {
      Object.values(hmda.markets).forEach((market) => {
        market.counties.forEach((county) => {
          map[county.name] = {
            readiness: county.readiness,
            approvalRate: county.approvalRate,
            applications: county.applications,
            dataSource: county.dataSource,
          };
        });
      });
    }
    return map;
  }, [hmda]);

  const countyToMarket = useMemo(() => {
    if (hmda.countyPrimaryMarket) return hmda.countyPrimaryMarket;
    const map: Record<string, string> = {};
    Object.entries(hmda.markets).forEach(([market, data]) => {
      data.counties.forEach((county) => {
        map[county.name] = market;
      });
    });
    return map;
  }, [hmda.countyPrimaryMarket, hmda.markets]);

  const selectedCountyNames = useMemo(() => {
    if (hmda.countyPrimaryMarket) {
      return new Set(
        Object.entries(hmda.countyPrimaryMarket)
          .filter(([, market]) => market === scenario.market)
          .map(([name]) => name)
      );
    }
    return new Set(
      hmda.markets[scenario.market]?.counties.map((c) => c.name) ?? []
    );
  }, [hmda, scenario.market]);

  const [hoveredCounty, setHoveredCounty] = useState<string | null>(null);
  const hoveredInfo = hoveredCounty ? readinessMap[hoveredCounty] : null;

  // Fixed CA-wide scale — relative quantiles would reshuffle colors when the market filter changes.
  const approvalExtent = useMemo(
    () => [0.38, 0.85] as [number, number],
    []
  );

  const approvalColor = useMemo(
    () => d3.scaleSequential(approvalExtent, d3.interpolateRdYlGn),
    [approvalExtent]
  );

  return (
    <svg
      viewBox="0 0 500 580"
      className="choropleth-map"
      role="img"
      aria-label="California county HMDA approval rate map"
    >
      <defs>
        <linearGradient
          id="readinessLegendGrad"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          {d3.range(0, 1.01, 0.1).map((t, i) => (
            <stop
              key={i}
              offset={`${(t * 100).toFixed(0)}%`}
              stopColor={approvalColor(
                approvalExtent[0] +
                  t * (approvalExtent[1] - approvalExtent[0])
              )}
            />
          ))}
        </linearGradient>
      </defs>
      {caFeatures.map((feat) => {
        const name =
          (feat.properties as { name?: string })?.name ?? "";
        const info = readinessMap[name];
        const inMarket = selectedCountyNames.has(name);
        const hasRate = info?.approvalRate != null;
        const isSparse =
          info?.dataSource === "sparse" ||
          info?.dataSource === "state-average";
        const fill = hasRate
          ? approvalColor(info.approvalRate!)
          : "var(--chart-choropleth-empty)";
        const isSelected = selectedCounty === name;
        const isHovered = hoveredCounty === name;
        const isScatterBrushed = scatterBrushedCounty === name;
        const pathD = _choroplethPath(feat) ?? "";
        return (
          <path
            key={String(feat.id)}
            d={pathD}
            fill={fill}
            stroke={
              isSelected
                ? "var(--you)"
                : isScatterBrushed
                  ? "var(--you)"
                  : isHovered
                    ? "var(--teal)"
                    : "var(--line)"
            }
            strokeWidth={
              isSelected ? 2.5 : isScatterBrushed ? 2.5 : isHovered ? 1.5 : 0.45
            }
            opacity={
              hasRate
                ? isSparse
                  ? 0.72
                  : inMarket
                    ? 1
                    : 0.9
                : 0.5
            }
            style={{
              cursor: hasRate ? "pointer" : "default",
              transition:
                "stroke 100ms ease, stroke-width 100ms ease",
            }}
            onMouseEnter={() => hasRate && setHoveredCounty(name)}
            onMouseLeave={() => setHoveredCounty(null)}
            onClick={() => {
              if (!hasRate) return;
              if (selectedCounty === name) {
                onCountySelect?.(null);
                return;
              }
              onCountySelect?.(name);
              const market = countyToMarket[name];
              if (market) onMarketSelect?.(market);
            }}
          />
        );
      })}

      <g transform="translate(10,530)">
        <text
          fontSize="9"
          fontWeight="700"
          fill="var(--muted)"
          letterSpacing="0.04em"
          y={-8}
        >
          HMDA APPROVAL RATE
        </text>
        <rect
          x={0}
          y={0}
          width={150}
          height={10}
          rx={3}
          fill="url(#readinessLegendGrad)"
        />
        <text fontSize="9" fill="var(--muted)" y={22}>
          {(approvalExtent[0] * 100).toFixed(0)}% (low)
        </text>
        <text
          fontSize="9"
          fill="var(--muted)"
          x={150}
          y={22}
          textAnchor="end"
        >
          {(approvalExtent[1] * 100).toFixed(0)}% (high)
        </text>
        <text fontSize="8" fill="var(--muted)" x={0} y={36}>
          Fixed scale · not relative ranking
        </text>
      </g>

      {hoveredCounty && hoveredInfo && (
        <g transform="translate(250,490)">
          <rect
            x={-95}
            y={-14}
            width={190}
            height={36}
            rx={8}
            fill="var(--chart-surface)"
            stroke="var(--line)"
            strokeWidth={0.8}
            opacity={0.96}
          />
          <text
            fontSize="11"
            fontWeight="800"
            fill="var(--ink)"
            textAnchor="middle"
            y={2}
          >
            {hoveredCounty}
          </text>
          <text
            fontSize="9"
            fill="var(--muted)"
            textAnchor="middle"
            y={16}
          >
            {hoveredInfo.approvalRate != null
              ? `${(hoveredInfo.approvalRate * 100).toFixed(0)}% HMDA approval`
              : "No rate in sample"}
            {hoveredInfo.applications != null
              ? ` · ${hoveredInfo.applications} apps`
              : ""}
            {hoveredInfo.dataSource === "sparse"
              ? " · thin sample"
              : hoveredInfo.dataSource === "state-average"
                ? " · state avg (no local apps)"
                : ""}
          </text>
        </g>
      )}
    </svg>
  );
}
