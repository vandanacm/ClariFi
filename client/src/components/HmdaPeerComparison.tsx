import { money } from "./chart-utils";
import type { HmdaModel, ScenarioInput, ScoreResult } from "../types";

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

type Row = {
  label: string;
  user: number;
  peer: number;
  format: (v: number) => string;
  userLabel: string;
  peerLabel: string;
  betterWhenLower: boolean;
};

export function HmdaPeerComparison({
  hmda,
  scenario,
  score,
}: {
  hmda: HmdaModel;
  scenario: ScenarioInput;
  score: ScoreResult;
}) {
  const market = hmda.markets[scenario.market];
  const loanAmount = Math.max(scenario.price - scenario.savings, 0);
  const approvedInMarket = hmda.scatter.filter(
    (p) => p.marketTags.includes(scenario.market) && p.approved
  );
  const medianApprovedIncome =
    approvedInMarket.length > 0
      ? [...approvedInMarket.map((p) => p.incomeMonthly)].sort((a, b) => a - b)[
          Math.floor(approvedInMarket.length / 2)
        ]
      : market?.incomeMedian ?? scenario.income;
  const medianApprovedLoan =
    approvedInMarket.length > 0
      ? [...approvedInMarket.map((p) => p.loanAmount)].sort((a, b) => a - b)[
          Math.floor(approvedInMarket.length / 2)
        ]
      : market?.priceMedian ?? loanAmount;

  const rows: Row[] = [
    {
      label: "Monthly income",
      user: scenario.income,
      peer: medianApprovedIncome,
      format: (v) => money.format(v),
      userLabel: "You",
      peerLabel: "Median approved",
      betterWhenLower: false,
    },
    {
      label: "Loan amount",
      user: loanAmount,
      peer: medianApprovedLoan,
      format: (v) => money.format(v),
      userLabel: "Your loan",
      peerLabel: "Median approved",
      betterWhenLower: false,
    },
    {
      label: "Debt-to-income",
      user: score.dti,
      peer: 0.36,
      format: (v) => percent.format(v),
      userLabel: "You",
      peerLabel: "Typical target",
      betterWhenLower: true,
    },
    {
      label: "Down payment",
      user: score.downPaymentRate,
      peer: 0.2,
      format: (v) => percent.format(v),
      userLabel: "You",
      peerLabel: "20% benchmark",
      betterWhenLower: false,
    },
  ];

  return (
    <div className="hmda-peer-comparison" role="img" aria-label={`Your profile vs approved borrowers in ${scenario.market}`}>
      <p className="hmda-peer-market">
        {scenario.market} County · {approvedInMarket.length.toLocaleString()} approved apps in sample
      </p>
      {rows.map((row) => {
        const max = Math.max(row.user, row.peer, 0.01);
        const userPct = (row.user / max) * 100;
        const peerPct = (row.peer / max) * 100;
        const delta = row.betterWhenLower ? row.peer - row.user : row.user - row.peer;
        const tone = delta >= 0 ? "positive" : "warning";
        return (
          <div className="hmda-peer-row" key={row.label}>
            <header>
              <span>{row.label}</span>
              <strong className={tone}>
                {row.betterWhenLower
                  ? row.user <= row.peer
                    ? "On target"
                    : `${percent.format(row.user - row.peer)} above target`
                  : row.user >= row.peer
                    ? "Above peer median"
                    : `${money.format(row.peer - row.user)} below peer`}
              </strong>
            </header>
            <div className="hmda-peer-bars">
              <div className="hmda-peer-bar-wrap">
                <span className="peer-bar" style={{ width: `${peerPct}%` }} title={row.peerLabel} />
                <span className={`user-bar ${tone}`} style={{ width: `${userPct}%` }} title={row.userLabel} />
              </div>
            </div>
            <footer>
              <span>{row.userLabel} {row.format(row.user)}</span>
              <span>{row.peerLabel} {row.format(row.peer)}</span>
            </footer>
          </div>
        );
      })}
    </div>
  );
}
