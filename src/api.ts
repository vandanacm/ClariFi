import type {
  BenchmarkModel,
  FinanceSummary,
  HmdaModel,
  ModelReport,
  ScenarioInput,
  ScoreResult
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; stack: string[]; modelArtifactPresent: boolean }>("/api/health"),
  model: () => request<ModelReport>("/api/model"),
  hmda: () => request<HmdaModel>("/api/hmda"),
  benchmarks: () => request<BenchmarkModel>("/api/benchmarks"),
  financeSummary: () => request<FinanceSummary>("/api/finance/summary"),
  scoreMortgage: (scenario: ScenarioInput) => request<ScoreResult>("/api/mortgage/score", {
    method: "POST",
    body: JSON.stringify(scenario)
  }),
  explain: (question: string, scenario: ScenarioInput) => request<{ answer: string; score: ScoreResult }>("/api/agent/explain", {
    method: "POST",
    body: JSON.stringify({ question, scenario })
  }),
  uploadTransactions: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${API_BASE}/api/transactions/upload`, {
      method: "POST",
      body: form
    });
    if (!response.ok) {
      throw new Error(`upload returned ${response.status}`);
    }
    return response.json() as Promise<{ imported: number; summary: FinanceSummary }>;
  }
};
