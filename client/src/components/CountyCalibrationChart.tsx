const COUNTY_LABELS: Record<string, string> = {
  "6037.0": "Los Angeles",
  "6073.0": "San Diego",
  "6067.0": "Sacramento",
  "6001.0": "Alameda",
};

export function CountyCalibrationChart({
  rows,
}: {
  rows: Array<{
    county: string;
    actualApprovalRate: number;
    predictedApprovalRate: number;
    rows: number;
  }>;
}) {
  const width = 520;
  const height = 220;
  const margin = { top: 18, right: 20, bottom: 42, left: 108 };
  const plotW = width - margin.left - margin.right;
  const barH = 24;
  const gap = 10;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="county-calibration-chart"
      role="img"
      aria-label="County approval calibration"
    >
      {rows.map((row, index) => {
        const y = margin.top + index * (barH + gap);
        const label = COUNTY_LABELS[row.county] ?? row.county;
        const actualW = row.actualApprovalRate * plotW;
        const predictedW = row.predictedApprovalRate * plotW;
        return (
          <g key={row.county}>
            <text
              fontSize="10"
              fill="var(--muted)"
              x={margin.left - 8}
              y={y + barH / 2 + 4}
              textAnchor="end"
            >
              {label}
            </text>
            <rect
              x={margin.left}
              y={y}
              width={plotW}
              height={barH}
              rx={4}
              fill="var(--soft)"
              opacity={0.65}
            />
            <rect
              x={margin.left}
              y={y + 4}
              width={actualW}
              height={8}
              rx={3}
              fill="var(--teal)"
              opacity={0.85}
            />
            <rect
              x={margin.left}
              y={y + 13}
              width={predictedW}
              height={8}
              rx={3}
              fill="var(--blue)"
              opacity={0.85}
            />
            <text
              fontSize="9"
              fill="var(--muted)"
              x={margin.left + plotW + 6}
              y={y + barH / 2 + 3}
            >
              n={row.rows}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${margin.left}, ${height - 18})`}>
        <rect x={0} y={0} width={8} height={8} rx={2} fill="var(--teal)" />
        <text fontSize="9" fill="var(--muted)" x={12} y={8}>Actual</text>
        <rect x={70} y={0} width={8} height={8} rx={2} fill="var(--blue)" />
        <text fontSize="9" fill="var(--muted)" x={82} y={8}>Predicted</text>
      </g>
    </svg>
  );
}
