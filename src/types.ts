export type ExpenseMap = {
  food: number;
  transport: number;
  lifestyle: number;
  investing: number;
};

export type ScenarioInput = {
  market: string;
  income: number;
  debt: number;
  savings: number;
  price: number;
  expenses: ExpenseMap;
};

export type LocalInsight = {
  feature: string;
  label: string;
  value: number;
  ideal: number;
  impact: number;
  direction: "positive" | "negative";
};

export type Counterfactual = {
  feature: string;
  suggestion: string;
  change: number;
  newApproval: number;
  newScore: number;
  delta: number;
};

export type ScoreResult = {
  mode: string;
  score: number;
  approvalLikelihood: number;
  monthlyHousing: number;
  monthlySurplus: number;
  dti: number;
  downPaymentRate: number;
  bestThreshold?: number;
  drivers: Array<{
    label: string;
    value: number;
    direction: "positive" | "negative";
  }>;
  localShap?: LocalInsight[];
  counterfactual?: Counterfactual;
};

export type BenchmarkCategory = {
  key: keyof ExpenseMap | "housing" | "savings";
  label: string;
  monthlyPeer: number;
  targetShare: number;
};

export type BenchmarkModel = {
  source: {
    name: string;
    note?: string;
  };
  peerGroup: {
    label: string;
    householdType: string;
    region: string;
    annualIncome: number;
  };
  categories: BenchmarkCategory[];
};

export type HmdaMarket = {
  incomeMedian: number;
  priceMedian: number;
  approvalBase: number;
  counties: Array<{
    name: string;
    readiness: number;
    approvalRate?: number;
    applications?: number;
  }>;
};

export type HmdaModel = {
  source: {
    name: string;
    note?: string;
  };
  markets: Record<string, HmdaMarket>;
  scatter: Array<{
    marketTags: string[];
    county: string;
    incomeMonthly: number;
    loanAmount: number;
    approved: boolean;
  }>;
};

export type ModelReport = {
  generatedAt: string;
  modelName: string;
  note: string;
  rows: {
    total: number;
    train: number;
    calibration?: number;
    test: number;
  };
  metrics: {
    testAccuracy?: number | null;
    testAuc?: number | null;
    balancedAccuracy?: number;
    brierScore?: number;
    denialRecall?: number;
    averagePrecision?: number;
    bestThreshold?: number;
  };
  features: Array<{
    feature: string;
    label: string;
    coefficient: number;
    direction: "positive" | "negative";
    magnitude: number;
  }>;
  calibration?: Array<{
    bin: string;
    applications: number;
    predictedRate: number;
    actualRate: number;
    rawPredictedRate: number;
  }>;
};

export type FinanceSummary = {
  transactionCount: number;
  monthlyIncomeObserved: number;
  monthlyOutflowObserved: number;
  netCashflowObserved: number;
  categoryTotals: Record<string, number>;
};
