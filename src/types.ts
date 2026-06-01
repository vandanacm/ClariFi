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
  modelReady?: boolean;
  message?: string | null;
  score: number | null;
  approvalLikelihood: number | null;
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
  counterfactual?: Counterfactual | null;
  explanationMode?: "model-perturbation" | null;
  featureMode?: string;
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

export type HmdaCountySummary = {
  name: string;
  readiness: number;
  approvalRate?: number;
  applications?: number;
  medianApprovedIncome?: number;
  medianApprovedLoan?: number;
  dataSource?: "county" | "sparse" | "state-average";
};

export type HmdaMarket = {
  incomeMedian: number;
  priceMedian: number;
  approvalBase: number;
  counties: HmdaCountySummary[];
};

export type HmdaModel = {
  source: {
    name: string;
    note?: string;
    rawRows?: number;
    scatterRows?: number;
    countyCount?: number;
  };
  counties?: Record<string, HmdaCountySummary>;
  countyPrimaryMarket?: Record<string, string>;
  markets: Record<string, HmdaMarket>;
  scatter: Array<{
    id?: string;
    marketTags: string[];
    county: string;
    incomeMonthly: number;
    loanAmount: number;
    approved: boolean;
    dti?: number;
    interestRate?: number;
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
  featurePolicy?: {
    excludedLeakageFields?: string[];
    fairnessAuditOnlyFields?: string[];
    usedNumericFeatures?: string[];
    usedCategoricalFeatures?: string[];
  };
  countyCalibration?: Array<{
    county: string;
    rows: number;
    actualApprovalRate: number;
    predictedApprovalRate: number;
    errorRate: number;
  }>;
};

export type FinanceSummary = {
  transactionCount: number;
  monthsObserved?: number;
  monthlyIncomeObserved: number;
  monthlyOutflowObserved: number;
  netCashflowObserved: number;
  categoryTotals: Record<string, number>;
};
