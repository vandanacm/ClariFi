import type { ScenarioInput, ScoreResult } from "../types";

export const BASE_MORTGAGE_RATE = 0.0725;

export function monthlyPI(
  loan: number,
  annualRate = BASE_MORTGAGE_RATE,
  termMonths = 360
): number {
  if (loan <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return loan / termMonths;
  const factor = Math.pow(1 + r, termMonths);
  return (loan * r * factor) / (factor - 1);
}

export function paymentBreakdown(price: number, savings: number, annualRate = BASE_MORTGAGE_RATE) {
  const loan = Math.max(price - savings, 0);
  const ltv = price > 0 ? loan / price : 0;
  const pi = Math.round(monthlyPI(loan, annualRate));
  const tax = Math.round((price * 0.012) / 12);
  const insurance = Math.round((price * 0.0035) / 12);
  const pmi = ltv > 0.8 ? Math.round((loan * 0.005) / 12) : 0;
  return { loan, ltv, pi, tax, insurance, pmi, total: pi + tax + insurance + pmi };
}

export function maxAffordablePrice(
  income: number,
  debt: number,
  savings: number,
  maxDti = 0.36
): number {
  const maxHousing = Math.max(0, maxDti * income - debt);
  const maxLoan = maxHousing / 0.0062;
  return Math.round(maxLoan + savings);
}

export function conservativeAffordablePrice(
  income: number,
  debt: number,
  savings: number,
  maxDti = 0.32
): number {
  return maxAffordablePrice(income, debt, savings, maxDti);
}

export function monthsToDownPaymentTarget(
  currentSavings: number,
  targetAmount: number,
  monthlyContribution: number
): number | null {
  const gap = targetAmount - currentSavings;
  if (gap <= 0) return 0;
  if (monthlyContribution <= 0) return null;
  return Math.ceil(gap / monthlyContribution);
}

export function monthlySaveCapacity(scenario: ScenarioInput, score: ScoreResult): number {
  return Math.max(score.monthlySurplus, 0) + scenario.expenses.investing;
}

export type LoanProgramRule = {
  id: string;
  name: string;
  minDown: number;
  maxDti: number;
  note: string;
};

export const LOAN_PROGRAMS: LoanProgramRule[] = [
  { id: "conv", name: "Conventional", minDown: 0.03, maxDti: 0.36, note: "3% down min · PMI if LTV > 80%" },
  { id: "fha", name: "FHA", minDown: 0.035, maxDti: 0.43, note: "3.5% down · higher DTI allowed" },
  { id: "va", name: "VA", minDown: 0, maxDti: 0.41, note: "0% down for eligible veterans" },
];

export function programChecks(
  score: ScoreResult,
  downPaymentRate: number
): Record<string, { downOk: boolean; dtiOk: boolean }> {
  const checks: Record<string, { downOk: boolean; dtiOk: boolean }> = {};
  for (const p of LOAN_PROGRAMS) {
    checks[p.id] = {
      downOk: downPaymentRate >= p.minDown - 0.005,
      dtiOk: score.dti <= p.maxDti + 0.005,
    };
  }
  return checks;
}

const RATE_DELTAS = [-0.02, -0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015, 0.02];

export function computeRateSensitivityLocal(
  scenario: ScenarioInput,
  score: ScoreResult
): Array<{ rate: number; payment: number; approval: number }> {
  const baseHousing = score.monthlyHousing;
  const baseApproval = score.approvalLikelihood ?? Math.max(0.15, 0.92 - score.dti * 1.2);
  const basePi = monthlyPI(Math.max(scenario.price - scenario.savings, 0), BASE_MORTGAGE_RATE);

  return RATE_DELTAS.map((delta) => {
    const rate = BASE_MORTGAGE_RATE + delta;
    const breakdown = paymentBreakdown(scenario.price, scenario.savings, rate);
    const pi = monthlyPI(Math.max(scenario.price - scenario.savings, 0), rate);
    const extra = pi - basePi;
    const newDti = (scenario.debt + baseHousing + extra) / Math.max(scenario.income, 1);
    const dtiShift = newDti - score.dti;
    const approval = Math.max(0.05, Math.min(0.99, baseApproval - dtiShift * 2.4));
    return {
      rate: Math.round(rate * 10000) / 10000,
      payment: breakdown.total,
      approval: Math.round(approval * 1000) / 1000,
    };
  });
}
