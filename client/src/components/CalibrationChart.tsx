import * as d3 from "d3";
import type { ModelReport } from "../types";

type Props = {
  report: ModelReport;
};

export function CalibrationChart({ report }: Props) {
  const rows = report.calibration ?? [];
  const width = 620;
  const height = 300;
  const margin = { top: 22, right: 24, bottom: 44, left: 52 };
  const x = d3.scaleLinear([0.45, 1], [margin.left, width - margin.right]);
  const y = d3.scaleLinear([0.45, 1], [height - margin.bottom, margin.top]);

  return (
    <svg
      className="calibration-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Model calibration chart"
    >
      <line
        className="grid-line"
        x1={x(0.5)}
        y1={y(0.5)}
        x2={x(1)}
        y2={y(1)}
      />
      <path
        className="goal-line"
        d={
          d3
            .line<(typeof rows)[number]>()
            .x((row) => x(row.predictedRate))
            .y((row) => y(row.actualRate))(rows) ?? undefined
        }
      />
      {rows.map((row) => (
        <circle
          key={row.bin}
          className="goal-point"
          cx={x(row.predictedRate)}
          cy={y(row.actualRate)}
          r={5}
        >
          <title>
            {row.bin}: predicted {(row.predictedRate * 100).toFixed(1)}%, actual{" "}
            {(row.actualRate * 100).toFixed(1)}%
          </title>
        </circle>
      ))}
      <text
        className="axis-label"
        x={width / 2}
        y={height - 8}
        textAnchor="middle"
      >
        Predicted approval rate
      </text>
      <text
        className="axis-label y-axis-title"
        x="16"
        y={height / 2}
        textAnchor="middle"
        transform={`rotate(-90 16 ${height / 2})`}
      >
        Actual approval rate
      </text>
    </svg>
  );
}
