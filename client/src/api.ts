import type {
  BenchmarkModel,
  FinanceSummary,
  HmdaModel,
  ModelReport,
  RiskGridCell,
  RateSensitivityPoint,
  ScenarioInput,
  ScoreResult,
  AgentAnnotation,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

const TOKEN_KEY = "clarifi_token";

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
  } as Record<string, string>;
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let detail = `${path} returned ${response.status}`;
    try {
      const body = (await response.json()) as {
        detail?: string | Array<{ msg?: string }>;
      };
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail))
        detail = body.detail
          .map((item) => item.msg ?? "")
          .filter(Boolean)
          .join("; ");
    } catch {}
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  setToken,
  getToken,
  clearToken,
  health: () =>
    request<{
      ok: boolean;
      stack: string[];
      modelArtifactPresent: boolean;
      modelLoaded?: boolean;
      modelLoadError?: string | null;
      inferenceConfigPresent?: boolean;
      scoringPipeline?: string;
      openRouterConfigured?: boolean;
      openRouterModel?: string | null;
      anthropicConfigured?: boolean;
      hmdaChart?: {
        scatterRows: number;
        rawRows?: number;
        countyCount?: number;
        sourceName?: string | null;
      };
      modelTraining?: {
        artifactPresent: boolean;
        rowsTotal?: number;
        testAuc?: number;
        bestThreshold?: number;
      };
      database?: string;
      databaseStatus?: {
        mode: string;
        connected: boolean;
        database?: string;
        error?: string;
      };
    }>("/api/health"),
  model: () => request<ModelReport>("/api/model"),
  hmda: () => request<HmdaModel>("/api/hmda"),
  benchmarks: () => request<BenchmarkModel>("/api/benchmarks"),
  financeSummary: () => request<FinanceSummary>("/api/finance/summary"),
  scoreMortgage: (scenario: ScenarioInput) =>
    request<ScoreResult>("/api/mortgage/score", {
      method: "POST",
      body: JSON.stringify(scenario),
    }),
  riskGrid: (scenario: ScenarioInput) =>
    request<RiskGridCell[]>("/api/risk-grid", {
      method: "POST",
      body: JSON.stringify(scenario),
    }),
  rateSensitivity: (scenario: ScenarioInput) =>
    request<RateSensitivityPoint[]>("/api/rate-sensitivity", {
      method: "POST",
      body: JSON.stringify(scenario),
    }),
  me: () =>
    request<{ user: { id: string; email: string; name: string } }>("/api/me"),
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name?: string) =>
    request<{ token: string; user: any }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  explain: (question: string, scenario: ScenarioInput) =>
    request<{
      answer: string;
      highlight: string;
      agentMode: string;
      score: ScoreResult;
      annotation?: AgentAnnotation;
    }>("/api/agent/explain", {
      method: "POST",
      body: JSON.stringify({ question, scenario }),
    }),
  saveScenario: (scenario: ScenarioInput) =>
    request<ScoreResult>("/api/scenarios", {
      method: "POST",
      body: JSON.stringify(scenario),
    }),
  listScenarios: () =>
    request<{
      scenarios: Array<{
        id: string;
        createdAt: string;
        input: ScenarioInput;
        result: ScoreResult;
      }>;
    }>("/api/scenarios"),
  uploadTransactions: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}/api/transactions/upload`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!response.ok) {
      throw new Error(`upload returned ${response.status}`);
    }
    return response.json() as Promise<{
      imported: number;
      summary: FinanceSummary;
    }>;
  },
};
