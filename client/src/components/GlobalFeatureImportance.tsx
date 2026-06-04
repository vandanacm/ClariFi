import * as d3 from "d3";
import type { ModelReport } from "../types";

/** Features users can actually act on — hide loan-type codes and obscure fields. */
const USER_FEATURES: Record<string, string> = {
  num__dti_numeric: "Debt-to-income (DTI)",
  num__down_payment_rate_proxy: "Down payment %",
  num__combined_loan_to_value_ratio: "Loan-to-value (LTV)",
  num__loan_to_income: "Loan vs. income",
  num__income_vs_county_median: "Income vs. county median",
  num__loan_vs_county_median: "Loan size vs. county",
  num__property_value: "Home price",
  num__loan_term: "Loan term",
};

export function GlobalFeatureImportance({ report }: { report: ModelReport }) {
  const features = [...(report.features ?? [])]
    .filter((f) => USER_FEATURES[f.feature])
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 6);

  const width = 480;
  const margin = { top: 8, right: 44, bottom: 28, left: 132 };
  const barH = 24;
  const gap = 8;
  const plotW = width - margin.left - margin.right;
  const height = margin.top + features.length * (barH + gap) + margin.bottom;
  const maxMag = d3.max(features, (d) => d.magnitude) ?? 0.1;
  const x = d3.scaleLinear().domain([0, maxMag * 1.08]).range([0, plotW]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="global-feature-chart"
      role="img"
      aria-label="Most important factors in the mortgage approval model"
    >
      {features.map((f, i) => {
        const y = margin.top + i * (barH + gap);
        const barW = Math.max(x(f.magnitude), 4);
        const fill = f.direction === "positive" ? "var(--teal)" : "var(--rose)";
        const label = USER_FEATURES[f.feature] ?? f.label;
        return (
          <g key={f.feature}>
            <text
              fontSize="10"
              fill="var(--muted)"
              x={margin.left - 6}
              y={y + barH / 2 + 4}
              textAnchor="end"
            >
              {label}
            </text>
            <rect
              x={margin.left}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill={fill}
              opacity={0.85}
            />
            <text
              fontSize="10"
              fill="var(--ink)"
              fontWeight="700"
              x={margin.left + barW + 6}
              y={y + barH / 2 + 4}
            >
              {(f.magnitude * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
