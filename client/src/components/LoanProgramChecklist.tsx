import { LOAN_PROGRAMS, programChecks } from "./mortgage-utils";
import type { ScoreResult } from "../types";

const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

function Check({ ok }: { ok: boolean }) {
  return (
    <span className={`loan-check ${ok ? "ok" : "no"}`} aria-label={ok ? "Meets guideline" : "Does not meet guideline"}>
      {ok ? "✓" : "✗"}
    </span>
  );
}

export function LoanProgramChecklist({ score }: { score: ScoreResult }) {
  const checks = programChecks(score, score.downPaymentRate);

  return (
    <div className="loan-program-checklist" role="table" aria-label="Loan program guideline checklist">
      <div className="loan-program-head" role="row">
        <span role="columnheader">Program</span>
        <span role="columnheader">Down</span>
        <span role="columnheader">DTI</span>
        <span role="columnheader">Status</span>
      </div>
      {LOAN_PROGRAMS.map((program) => {
        const c = checks[program.id];
        const pass = c.downOk && c.dtiOk;
        return (
          <div className="loan-program-row" role="row" key={program.id}>
            <span role="cell">
              <strong>{program.name}</strong>
              <small>{program.note}</small>
            </span>
            <span role="cell"><Check ok={c.downOk} /> {pct.format(program.minDown)}+</span>
            <span role="cell"><Check ok={c.dtiOk} /> ≤{pct.format(program.maxDti)}</span>
            <span role="cell" className={pass ? "pass" : "fail"}>{pass ? "Likely eligible" : "Gap to close"}</span>
          </div>
        );
      })}
      <p className="loan-program-note">
        Educational checklist only — actual eligibility depends on credit, reserves, and lender overlays.
      </p>
    </div>
  );
}
