import { useRef, useState } from "react";
import { Upload, SkipForward } from "lucide-react";
import { api } from "./api";
import type { FinanceSummary, ScenarioInput } from "./types";

interface Props {
  userName: string;
  onComplete: (summary: FinanceSummary | null, scenarioHints: Partial<ScenarioInput>) => void;
}

export function Onboarding({ userName, onComplete }: Props) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus("uploading");
    setMessage("");
    try {
      const result = await api.uploadTransactions(file);
      const totals = result.summary.categoryTotals;

      const hints: Partial<ScenarioInput> = {};
      const income = result.summary.monthlyIncomeObserved;
      if (income > 0) hints.income = Math.round(income);

      const debt = Math.abs(totals["debt"] ?? 0);
      if (debt > 0) hints.debt = Math.round(debt);

      const food = Math.abs(totals["food"] ?? 0);
      const transport = Math.abs(totals["transport"] ?? totals["transportation"] ?? 0);
      const lifestyle = Math.abs(totals["lifestyle"] ?? totals["entertainment"] ?? totals["shopping"] ?? 0);
      const investing = Math.abs(totals["savings"] ?? totals["investing"] ?? totals["investment"] ?? 0);

      if (food > 0 || transport > 0 || lifestyle > 0 || investing > 0) {
        hints.expenses = {
          food: food || 900,
          transport: transport || 525,
          lifestyle: lifestyle || 850,
          investing: investing || 1100
        };
      }

      setStatus("done");
      setMessage(`${result.imported} transactions imported. Scenario pre-filled from your data.`);
      setTimeout(() => onComplete(result.summary, hints), 1200);
    } catch {
      setStatus("error");
      setMessage("Upload failed — check the file is a CSV with date, merchant, category, and amount columns.");
    }
  }

  function skip() {
    onComplete(null, {});
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        <div className="onboarding-brand">
          <span className="auth-brand-symbol">C</span>
          <div>
            <p className="onboarding-title">Welcome, {userName}</p>
            <p className="onboarding-sub">Let's personalize your readiness score</p>
          </div>
        </div>

        <p className="onboarding-body">
          Upload a bank or credit card CSV export to pre-fill your income, debt, and expense sliders
          with your real spending data. The file stays on your device — only the parsed totals are used.
        </p>

        <div className="onboarding-csv-hint">
          <strong>Expected columns:</strong> <code>date, merchant, category, amount</code>
          <br />
          Negative amounts = spending, positive = income.
        </div>

        <label
          className={`onboarding-upload ${status === "uploading" ? "busy" : ""} ${status === "done" ? "done" : ""} ${status === "error" ? "error" : ""}`}
          aria-disabled={status === "uploading"}
        >
          <Upload size={22} />
          <span>
            {status === "idle" && "Choose CSV file"}
            {status === "uploading" && "Importing…"}
            {status === "done" && "Done!"}
            {status === "error" && "Try again"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            disabled={status === "uploading"}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>

        {message && (
          <p className={`onboarding-message ${status === "error" ? "error" : ""}`}>{message}</p>
        )}

        <button className="onboarding-skip" type="button" onClick={skip}>
          <SkipForward size={14} />
          Skip for now — use demo values
        </button>
      </div>
    </div>
  );
}
