const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0
});

const compactNumber = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3
});

const fallbackDataModel = {
  source: {
    name: "Built-in sample"
  },
  markets: {
  Sacramento: {
    incomeMedian: 9400,
    priceMedian: 560000,
    approvalBase: 0.69,
    counties: [
      { name: "Sacramento", readiness: 72 },
      { name: "Yolo", readiness: 67 },
      { name: "Placer", readiness: 64 },
      { name: "Contra Costa", readiness: 58 }
    ]
  },
  Alameda: {
    incomeMedian: 13800,
    priceMedian: 950000,
    approvalBase: 0.57,
    counties: [
      { name: "Alameda", readiness: 52 },
      { name: "Contra Costa", readiness: 58 },
      { name: "Santa Clara", readiness: 47 },
      { name: "San Mateo", readiness: 43 }
    ]
  },
  "San Diego": {
    incomeMedian: 11600,
    priceMedian: 790000,
    approvalBase: 0.62,
    counties: [
      { name: "San Diego", readiness: 61 },
      { name: "Orange", readiness: 51 },
      { name: "Riverside", readiness: 73 },
      { name: "Los Angeles", readiness: 54 }
    ]
  },
  "Los Angeles": {
    incomeMedian: 11200,
    priceMedian: 840000,
    approvalBase: 0.58,
    counties: [
      { name: "Los Angeles", readiness: 55 },
      { name: "Orange", readiness: 51 },
      { name: "Ventura", readiness: 59 },
      { name: "Riverside", readiness: 73 }
    ]
  }
  },
  scatter: [
    { marketTags: ["Sacramento"], county: "Sacramento", incomeMonthly: 5100, loanAmount: 310000, approved: false },
    { marketTags: ["Sacramento"], county: "Sacramento", incomeMonthly: 7000, loanAmount: 390000, approved: true },
    { marketTags: ["Sacramento"], county: "Yolo", incomeMonthly: 8800, loanAmount: 510000, approved: true },
    { marketTags: ["Sacramento"], county: "Placer", incomeMonthly: 9400, loanAmount: 560000, approved: true },
    { marketTags: ["Sacramento"], county: "Contra Costa", incomeMonthly: 10700, loanAmount: 690000, approved: false },
    { marketTags: ["Alameda"], county: "Alameda", incomeMonthly: 13400, loanAmount: 790000, approved: true },
    { marketTags: ["Alameda"], county: "Santa Clara", incomeMonthly: 15500, loanAmount: 910000, approved: true },
    { marketTags: ["San Diego"], county: "San Diego", incomeMonthly: 12100, loanAmount: 760000, approved: true },
    { marketTags: ["Los Angeles"], county: "Los Angeles", incomeMonthly: 8800, loanAmount: 720000, approved: false }
  ]
};

const fallbackBenchmarkModel = {
  source: {
    name: "BLS CE benchmark sample",
    note: "Course placeholder using BLS-style annual household expenditure groups."
  },
  peerGroup: {
    label: "Western U.S. households, upper-middle income",
    householdType: "2-person renter/owner transition",
    region: "West",
    annualIncome: 118000
  },
  categories: [
    { key: "housing", label: "Housing", monthlyPeer: 2850, targetShare: 0.3 },
    { key: "food", label: "Food", monthlyPeer: 875, targetShare: 0.1 },
    { key: "transport", label: "Transportation", monthlyPeer: 760, targetShare: 0.08 },
    { key: "lifestyle", label: "Lifestyle", monthlyPeer: 940, targetShare: 0.1 },
    { key: "savings", label: "Savings gap", monthlyPeer: 1450, targetShare: 0.14 }
  ]
};

let dataModel = fallbackDataModel;
let modelReport = null;
let benchmarkModel = fallbackBenchmarkModel;
let scenarioSyncId = 0;

const state = {
  market: "Sacramento",
  income: 9400,
  debt: 1250,
  savings: 82000,
  price: 560000,
  riskMode: "steady",
  expenses: {
    food: 900,
    transport: 525,
    lifestyle: 850,
    investing: 1100
  }
};

const els = {
  marketSelect: document.querySelector("#marketSelect"),
  backendStatus: document.querySelector("#backendStatus"),
  agentStatus: document.querySelector("#agentStatus"),
  agentSummary: document.querySelector("#agentSummary"),
  agentList: document.querySelector("#agentList"),
  scoreArc: document.querySelector("#scoreArc"),
  scoreValue: document.querySelector("#scoreValue"),
  readinessLabel: document.querySelector("#readinessLabel"),
  readinessNarrative: document.querySelector("#readinessNarrative"),
  incomeMetric: document.querySelector("#incomeMetric"),
  savingsRateMetric: document.querySelector("#savingsRateMetric"),
  dtiMetric: document.querySelector("#dtiMetric"),
  approvalMetric: document.querySelector("#approvalMetric"),
  scenarioPill: document.querySelector("#scenarioPill"),
  marketPill: document.querySelector("#marketPill"),
  incomeRange: document.querySelector("#incomeRange"),
  debtRange: document.querySelector("#debtRange"),
  savingsRange: document.querySelector("#savingsRange"),
  priceRange: document.querySelector("#priceRange"),
  incomeValue: document.querySelector("#incomeValue"),
  debtValue: document.querySelector("#debtValue"),
  savingsValue: document.querySelector("#savingsValue"),
  priceValue: document.querySelector("#priceValue"),
  recommendationText: document.querySelector("#recommendationText"),
  budgetPill: document.querySelector("#budgetPill"),
  cashflowChart: document.querySelector("#cashflowChart"),
  expenseDonut: document.querySelector("#expenseDonut"),
  monthlySurplus: document.querySelector("#monthlySurplus"),
  benchmarkPill: document.querySelector("#benchmarkPill"),
  benchmarkMeta: document.querySelector("#benchmarkMeta"),
  benchmarkList: document.querySelector("#benchmarkList"),
  foodRange: document.querySelector("#foodRange"),
  transportRange: document.querySelector("#transportRange"),
  lifestyleRange: document.querySelector("#lifestyleRange"),
  investingRange: document.querySelector("#investingRange"),
  foodValue: document.querySelector("#foodValue"),
  transportValue: document.querySelector("#transportValue"),
  lifestyleValue: document.querySelector("#lifestyleValue"),
  investingValue: document.querySelector("#investingValue"),
  runwayMetric: document.querySelector("#runwayMetric"),
  downPaymentMetric: document.querySelector("#downPaymentMetric"),
  nextMoveMetric: document.querySelector("#nextMoveMetric"),
  goalChart: document.querySelector("#goalChart"),
  riskButtons: document.querySelectorAll(".risk-button"),
  navItems: document.querySelectorAll(".nav-item[data-section]"),
  sections: document.querySelectorAll(".app-section[data-section]"),
  scatterPlot: document.querySelector("#scatterPlot"),
  countyMap: document.querySelector("#countyMap"),
  driverList: document.querySelector("#driverList"),
  dataSourcePill: document.querySelector("#dataSourcePill"),
  modelPill: document.querySelector("#modelPill"),
  modelMeta: document.querySelector("#modelMeta")
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sumFlexibleExpenses() {
  return Object.values(state.expenses).reduce((sum, value) => sum + value, 0);
}

async function fetchJson(paths, options) {
  const candidates = Array.isArray(paths) ? paths : [paths];
  let lastError = null;

  for (const path of candidates) {
    try {
      const response = await fetch(path, options);
      if (!response.ok) {
        throw new Error(`${path} returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No data source provided");
}

function updateBackendStatus(online) {
  els.backendStatus.textContent = online ? "API connected" : "Static fallback";
  els.backendStatus.className = `status-pill backend-status ${online ? "" : "alt"}`;
}

function getDerived() {
  const market = dataModel.markets[state.market];
  const monthlyHousing = (state.price - state.savings) * 0.0062;
  const flexibleExpenses = sumFlexibleExpenses();
  const monthlySurplus = state.income - state.debt - monthlyHousing - flexibleExpenses;
  const dti = (state.debt + monthlyHousing) / state.income;
  const downPaymentRate = state.savings / state.price;
  const savingsRate = clamp(monthlySurplus / state.income, -0.22, 0.46);
  const incomeFit = state.income / market.incomeMedian;
  const priceFit = market.priceMedian / state.price;
  const score = clamp(
    34 +
      downPaymentRate * 118 +
      (1 - Math.abs(dti - 0.32)) * 26 +
      incomeFit * 17 +
      priceFit * 11 -
      Math.max(dti - 0.36, 0) * 360 +
      clamp(monthlySurplus / 1800, -8, 9),
    18,
    96
  );
  const approval = clamp(
    market.approvalBase +
      (score - 70) / 180 +
      (downPaymentRate - 0.15) * 0.8 -
      Math.max(dti - 0.36, 0) * 1.2,
    0.18,
    0.94
  );

  return {
    market,
    monthlyHousing,
    flexibleExpenses,
    monthlySurplus,
    dti,
    downPaymentRate,
    savingsRate,
    score: Math.round(score),
    approval
  };
}

function updateScore(derived) {
  const circumference = 352;
  const offset = circumference - (derived.score / 100) * circumference;
  els.scoreArc.style.strokeDashoffset = offset;
  els.scoreArc.style.stroke = derived.score >= 74 ? "var(--teal)" : derived.score >= 58 ? "var(--gold)" : "var(--rose)";
  els.scoreValue.textContent = derived.score;

  if (derived.score >= 78) {
    els.readinessLabel.textContent = "Ready to compete";
    els.readinessNarrative.textContent = "This profile is close to approved borrower patterns in the selected market.";
  } else if (derived.score >= 62) {
    els.readinessLabel.textContent = "Nearly ready";
    els.readinessNarrative.textContent = "The profile is viable, but debt load or target price is still limiting approval confidence.";
  } else {
    els.readinessLabel.textContent = "Needs a stronger buffer";
    els.readinessNarrative.textContent = "The selected market is stretching this profile beyond common approved borrower patterns.";
  }
}

function updateMetrics(derived) {
  els.incomeMetric.textContent = currency.format(state.income);
  els.savingsRateMetric.textContent = percent.format(derived.savingsRate);
  els.dtiMetric.textContent = percent.format(derived.dti);
  els.approvalMetric.textContent = percent.format(derived.approval);

  els.incomeValue.textContent = currency.format(state.income);
  els.debtValue.textContent = currency.format(state.debt);
  els.savingsValue.textContent = currency.format(state.savings);
  els.priceValue.textContent = currency.format(state.price);

  const isBase =
    state.income === 9400 &&
    state.debt === 1250 &&
    state.savings === 82000 &&
    state.price === 560000 &&
    state.market === "Sacramento";
  els.scenarioPill.textContent = isBase ? "Base scenario" : "Scenario updated";
  els.marketPill.textContent = `${state.market} selected`;
}

function updateRecommendation(derived) {
  if (derived.dti > 0.38) {
    els.recommendationText.textContent = `Reducing monthly debt by ${currency.format(350)} would improve DTI faster than increasing savings in this scenario.`;
  } else if (derived.monthlySurplus < 0) {
    els.recommendationText.textContent = `This plan runs ${currency.format(Math.abs(derived.monthlySurplus))} short each month. Trim lifestyle costs or lower the target price first.`;
  } else if (derived.downPaymentRate < 0.16) {
    els.recommendationText.textContent = `Adding ${currency.format(Math.round(state.price * 0.18 - state.savings))} in savings would place the down payment near stronger approved-borrower profiles.`;
  } else if (state.price > derived.market.priceMedian * 1.08) {
    els.recommendationText.textContent = `A target price closer to ${currency.format(derived.market.priceMedian)} would align better with recent approvals in ${state.market}.`;
  } else {
    els.recommendationText.textContent = "This profile is balanced; income and down payment are both tracking near approved-borrower patterns.";
  }
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = (angle - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function drawExpenseDonut(derived) {
  const items = [
    { label: "Housing", value: Math.max(derived.monthlyHousing, 0), color: "var(--blue)" },
    { label: "Debt", value: state.debt, color: "var(--rose)" },
    { label: "Food", value: state.expenses.food, color: "var(--teal)" },
    { label: "Transport", value: state.expenses.transport, color: "var(--gold)" },
    { label: "Lifestyle", value: state.expenses.lifestyle, color: "#7b61c8" },
    { label: "Investing", value: state.expenses.investing, color: "#2f9e44" }
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;

  const arcs = items.map(item => {
    const portion = item.value / Math.max(total, 1);
    const start = cursor;
    const end = cursor + portion * 359.6;
    cursor = end;
    return `
      <path d="${describeArc(110, 110, 82, start, end)}" stroke="${item.color}" stroke-width="26" fill="none" stroke-linecap="butt">
        <title>${item.label}: ${currency.format(item.value)}</title>
      </path>
    `;
  }).join("");

  els.expenseDonut.innerHTML = `
    <circle cx="110" cy="110" r="82" fill="none" stroke="#e8eef1" stroke-width="26"></circle>
    ${arcs}
    <text class="donut-center-main" x="110" y="104" text-anchor="middle">${currency.format(total)}</text>
    <text class="donut-center-sub" x="110" y="126" text-anchor="middle">monthly outflow</text>
  `;
}

function drawCashflow(derived) {
  const svg = els.cashflowChart;
  const width = 720;
  const height = 260;
  const margin = { top: 24, right: 22, bottom: 54, left: 34 };
  const chartW = width - margin.left - margin.right;
  const maxValue = Math.max(state.income, derived.monthlyHousing + state.debt + derived.flexibleExpenses, 1);
  const barW = 84;
  const gap = (chartW - barW * 6) / 5;
  const yBase = 190;
  const y = value => yBase - (Math.abs(value) / maxValue) * 150;
  const bars = [
    { label: "Income", value: state.income, tone: "income" },
    { label: "Housing", value: -derived.monthlyHousing, tone: "housing" },
    { label: "Debt", value: -state.debt, tone: "debt" },
    { label: "Flexible", value: -(state.expenses.food + state.expenses.transport + state.expenses.lifestyle), tone: "flex" },
    { label: "Invest", value: -state.expenses.investing, tone: "invest" },
    { label: "Surplus", value: derived.monthlySurplus, tone: derived.monthlySurplus >= 0 ? "surplus" : "shortfall" }
  ];

  svg.innerHTML = `
    <line class="axis-line" x1="${margin.left}" y1="${yBase}" x2="${width - margin.right}" y2="${yBase}"></line>
    ${bars.map((bar, index) => {
      const x = margin.left + index * (barW + gap);
      const h = Math.max(Math.abs(yBase - y(bar.value)), 8);
      const top = bar.value >= 0 ? yBase - h : yBase;
      return `
        <rect class="cashflow-bar ${bar.tone}" x="${x}" y="${top}" width="${barW}" height="${h}" rx="7"></rect>
        <text class="cashflow-value" x="${x + barW / 2}" y="${top - 9}" text-anchor="middle">${currency.format(bar.value)}</text>
        <text class="tick-label" x="${x + barW / 2}" y="${height - 22}" text-anchor="middle">${bar.label}</text>
      `;
    }).join("")}
  `;
}

function updateFinanceTools(derived) {
  els.monthlySurplus.textContent = currency.format(derived.monthlySurplus);
  els.monthlySurplus.classList.toggle("negative", derived.monthlySurplus < 0);
  els.budgetPill.textContent = derived.monthlySurplus >= 1200 ? "Strong buffer" : derived.monthlySurplus >= 0 ? "Tight buffer" : "Over budget";
  els.budgetPill.className = `status-pill ${derived.monthlySurplus < 0 ? "danger" : derived.monthlySurplus < 1200 ? "alt" : ""}`;

  els.foodValue.textContent = currency.format(state.expenses.food);
  els.transportValue.textContent = currency.format(state.expenses.transport);
  els.lifestyleValue.textContent = currency.format(state.expenses.lifestyle);
  els.investingValue.textContent = currency.format(state.expenses.investing);

  const fixedMonthlyNeeds = Math.max(derived.monthlyHousing + state.debt + state.expenses.food + state.expenses.transport, 1);
  const runway = state.savings / fixedMonthlyNeeds;
  const downPaymentGap = Math.max(state.price * 0.2 - state.savings, 0);
  const growthMultiplier = state.riskMode === "growth" ? 1.12 : state.riskMode === "defensive" ? 0.84 : 1;
  const monthlyProgress = Math.max(derived.monthlySurplus * growthMultiplier, 1);
  const monthsToDownPayment = downPaymentGap === 0 ? 0 : Math.ceil(downPaymentGap / monthlyProgress);

  els.runwayMetric.textContent = `${runway.toFixed(1)} mo`;
  els.downPaymentMetric.textContent = monthsToDownPayment === 0 ? "Ready" : `${monthsToDownPayment}`;

  if (derived.monthlySurplus < 0) {
    els.nextMoveMetric.textContent = "Restore positive cashflow";
  } else if (runway < 6) {
    els.nextMoveMetric.textContent = "Build emergency runway";
  } else if (monthsToDownPayment > 18) {
    els.nextMoveMetric.textContent = "Lower target price or boost saving";
  } else {
    els.nextMoveMetric.textContent = "Prepare offer strategy";
  }

  drawCashflow(derived);
  drawExpenseDonut(derived);
  drawGoalChart(derived, monthlyProgress);
  updateBenchmarks(derived);
}

function updateAgentPanel(payload) {
  if (!payload) {
    els.agentStatus.textContent = "Local rules";
    els.agentStatus.className = "status-pill alt";
    els.agentSummary.innerHTML = `
      <span>Backend insight service</span>
      <strong>Using browser-side scenario rules</strong>
    `;
    els.agentList.innerHTML = `
      <article class="agent-card">
        <span>Explainer Agent</span>
        <strong>Adjust the sliders to explore readiness changes.</strong>
        <small>Connect the Node backend for API-scored insight cards.</small>
      </article>
    `;
    return;
  }

  els.agentStatus.textContent = "Scenario synced";
  els.agentStatus.className = "status-pill";
  els.agentSummary.innerHTML = `
    <span>API score</span><strong>${payload.score}/100</strong>
    <span>Approval pattern</span><strong>${percent.format(payload.approval)}</strong>
    <span>Monthly surplus</span><strong>${currency.format(payload.monthlySurplus)}</strong>
  `;
  els.agentList.innerHTML = payload.insights.map(insight => `
    <article class="agent-card" data-focus="${insight.focus}">
      <span>${insight.agent}</span>
      <strong>${insight.title}</strong>
      <small>${insight.detail}</small>
    </article>
  `).join("");
}

async function syncScenarioWithBackend() {
  const syncId = ++scenarioSyncId;
  try {
    const payload = await fetchJson("/api/scenario", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ scenario: state })
    });
    if (syncId !== scenarioSyncId) return;
    updateBackendStatus(true);
    updateAgentPanel(payload);
  } catch (error) {
    console.warn(error);
    if (syncId !== scenarioSyncId) return;
    updateBackendStatus(false);
    updateAgentPanel(null);
  }
}

function getBenchmarkUserValue(key, derived) {
  const values = {
    housing: derived.monthlyHousing,
    food: state.expenses.food,
    transport: state.expenses.transport,
    lifestyle: state.expenses.lifestyle,
    savings: Math.max(derived.monthlySurplus + state.expenses.investing, 0)
  };
  return values[key] ?? 0;
}

function updateBenchmarks(derived) {
  const peer = benchmarkModel.peerGroup;
  els.benchmarkPill.textContent = benchmarkModel.source.name;
  els.benchmarkMeta.innerHTML = `
    <span>Peer group</span><strong>${peer.label}</strong>
    <span>Region</span><strong>${peer.region}</strong>
    <span>Income band</span><strong>${currency.format(peer.annualIncome)}/yr</strong>
  `;

  els.benchmarkList.innerHTML = benchmarkModel.categories.map(category => {
    const userValue = getBenchmarkUserValue(category.key, derived);
    const delta = userValue - category.monthlyPeer;
    const ratio = clamp(userValue / Math.max(category.monthlyPeer, 1), 0, 1.75);
    const peerWidth = clamp(category.monthlyPeer / Math.max(userValue, category.monthlyPeer, 1), 0.08, 1) * 100;
    const userWidth = clamp(userValue / Math.max(userValue, category.monthlyPeer, 1), 0.08, 1) * 100;
    const tone = category.key === "savings"
      ? userValue >= category.monthlyPeer ? "positive" : "negative"
      : ratio <= 1.08 ? "positive" : ratio <= 1.24 ? "warning" : "negative";
    const deltaLabel = delta >= 0 ? `+${currency.format(delta)}` : `-${currency.format(Math.abs(delta))}`;

    return `
      <div class="benchmark-row">
        <header>
          <span>${category.label}</span>
          <strong class="${tone}">${deltaLabel} vs peer</strong>
        </header>
        <div class="benchmark-bars">
          <span class="peer-bar" style="width: ${peerWidth}%"></span>
          <span class="user-bar ${tone}" style="width: ${userWidth}%"></span>
        </div>
        <footer>
          <span>User ${currency.format(userValue)}</span>
          <span>Peer ${currency.format(category.monthlyPeer)}</span>
        </footer>
      </div>
    `;
  }).join("");
}

function drawGoalChart(derived, monthlyProgress) {
  const svg = els.goalChart;
  const width = 640;
  const height = 230;
  const margin = { top: 22, right: 26, bottom: 42, left: 76 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const target = state.price * 0.2;
  const points = Array.from({ length: 13 }, (_, month) => ({
    month,
    value: state.savings + monthlyProgress * month
  }));
  const yMax = Math.max(target * 1.12, points.at(-1).value * 1.08);
  const x = month => margin.left + (month / 12) * plotW;
  const y = value => margin.top + plotH - (value / yMax) * plotH;
  const line = points.map(point => `${x(point.month)},${y(point.value)}`).join(" ");

  svg.innerHTML = `
    <line class="grid-line" x1="${margin.left}" y1="${y(target)}" x2="${margin.left + plotW}" y2="${y(target)}"></line>
    <text class="axis-label" x="${margin.left}" y="${y(target) - 8}">20% down target</text>
    <polyline class="goal-line" points="${line}"></polyline>
    ${points.filter((_, index) => index % 3 === 0).map(point => `
      <circle class="goal-point" cx="${x(point.month)}" cy="${y(point.value)}" r="5"></circle>
      <text class="tick-label" x="${x(point.month)}" y="${height - 18}" text-anchor="middle">${point.month}m</text>
    `).join("")}
    <text class="axis-label" x="${margin.left - 10}" y="${y(state.savings) + 4}" text-anchor="end">${currency.format(state.savings)}</text>
    <text class="axis-label" x="${margin.left + plotW}" y="${y(points.at(-1).value) - 10}" text-anchor="end">${currency.format(points.at(-1).value)}</text>
  `;
}

function drawScatter(derived) {
  const svg = els.scatterPlot;
  const width = 720;
  const height = 380;
  const margin = { top: 24, right: 26, bottom: 62, left: 108 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xMin = 4;
  const xMax = 19;
  const yMin = 250;
  const yMax = 1300;
  const x = value => margin.left + ((value - xMin) / (xMax - xMin)) * plotW;
  const y = value => margin.top + plotH - ((value - yMin) / (yMax - yMin)) * plotH;

  const points = dataModel.scatter
    .filter(point => point.marketTags.includes(state.market))
    .map(point => ({
      income: point.incomeMonthly / 1000,
      loan: point.loanAmount / 1000,
      approved: point.approved,
      county: point.county
    }));

  const userIncome = state.income / 1000;
  const userLoan = (state.price - state.savings) / 1000;

  svg.innerHTML = `
    <line class="axis-line" x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}"></line>
    <line class="axis-line" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}"></line>
    ${[6, 9, 12, 15, 18].map(tick => `
      <line class="grid-line" x1="${x(tick)}" y1="${margin.top}" x2="${x(tick)}" y2="${margin.top + plotH}"></line>
      <text class="tick-label" x="${x(tick)}" y="${height - 26}" text-anchor="middle">$${tick}k</text>
    `).join("")}
    ${[400, 700, 1000, 1300].map(tick => `
      <line class="grid-line" x1="${margin.left}" y1="${y(tick)}" x2="${margin.left + plotW}" y2="${y(tick)}"></line>
      <text class="tick-label" x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">$${tick}k</text>
    `).join("")}
    <text class="axis-label" x="${margin.left + plotW / 2}" y="${height - 6}" text-anchor="middle">Monthly income</text>
    <text class="axis-label y-axis-title" x="24" y="${margin.top + plotH / 2}" text-anchor="middle" transform="rotate(-90 24 ${margin.top + plotH / 2})">Requested loan amount</text>
    ${points.map(point => `
      <circle class="point" cx="${x(point.income)}" cy="${y(point.loan)}" r="6" fill="${point.approved ? "var(--teal)" : "var(--rose)"}">
        <title>${point.county}: ${point.approved ? "approved" : "denied"}</title>
      </circle>
    `).join("")}
    <line x1="${x(userIncome)}" y1="${margin.top}" x2="${x(userIncome)}" y2="${y(userLoan)}" stroke="rgba(217,154,32,0.5)" stroke-width="2" stroke-dasharray="5 5"></line>
    <circle class="user-point" cx="${x(userIncome)}" cy="${y(userLoan)}" r="10" fill="var(--gold)" stroke="#172331" stroke-width="3"></circle>
    <text class="axis-label" x="${x(userIncome) + 14}" y="${y(userLoan) - 13}">User profile</text>
  `;
}

function drawMap(derived) {
  els.countyMap.innerHTML = derived.market.counties.map(county => {
    const adjusted = clamp(county.readiness + Math.round((derived.score - 70) * 0.34), 28, 94);
    const hue = adjusted >= 70 ? "173, 51%, 38%" : adjusted >= 58 ? "41, 70%, 55%" : "356, 48%, 58%";
    const alpha = 0.22 + adjusted / 150;
    return `
      <button class="county-cell ${county.name.includes(state.market) ? "selected" : ""}" type="button" style="background: hsla(${hue}, ${alpha});">
        <strong>${county.name}</strong>
        <span>${adjusted}/100</span>
        <small>${percent.format(county.approvalRate ?? 0)} approved · ${county.applications ?? 0} apps</small>
      </button>
    `;
  }).join("");
}

function updateDrivers(derived) {
  const scenarioDrivers = [
    {
      label: "Down payment coverage",
      value: clamp(derived.downPaymentRate / 0.22, 0.08, 1),
      tone: derived.downPaymentRate >= 0.18 ? "positive" : "warning",
      display: percent.format(derived.downPaymentRate)
    },
    {
      label: "Debt-to-income pressure",
      value: clamp(1 - derived.dti / 0.52, 0.08, 1),
      tone: derived.dti <= 0.36 ? "positive" : "negative",
      display: percent.format(derived.dti)
    },
    {
      label: "Market income fit",
      value: clamp(state.income / derived.market.incomeMedian, 0.08, 1),
      tone: state.income >= derived.market.incomeMedian ? "positive" : "warning",
      display: `${Math.round((state.income / derived.market.incomeMedian) * 100)}% of median`
    },
    {
      label: "Target price fit",
      value: clamp(derived.market.priceMedian / state.price, 0.08, 1),
      tone: state.price <= derived.market.priceMedian ? "positive" : "warning",
      display: currency.format(state.price)
    }
  ];

  const maxMagnitude = Math.max(...(modelReport?.features ?? []).map(feature => feature.magnitude), 0.01);
  const modelDrivers = (modelReport?.features ?? []).slice(0, 3).map(feature => ({
    label: feature.label,
    value: clamp(feature.magnitude / maxMagnitude, 0.08, 1),
    tone: feature.direction === "positive" ? "positive" : "negative",
    display: `${feature.coefficient > 0 ? "+" : ""}${compactNumber.format(feature.coefficient)} SHAP`
  }));

  const drivers = [...scenarioDrivers, ...modelDrivers];

  els.driverList.innerHTML = drivers.map(driver => `
    <div class="driver-row">
      <header>
        <span>${driver.label}</span>
        <strong>${driver.display}</strong>
      </header>
      <div class="bar-track">
        <div class="bar-fill ${driver.tone}" style="width: ${driver.value * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function updateModelMeta() {
  if (!modelReport) {
    els.modelPill.textContent = "Scenario rules";
    els.modelMeta.innerHTML = `
      <span>No model report loaded</span>
      <strong>Run npm run train:model</strong>
    `;
    return;
  }

  els.modelPill.textContent = modelReport.modelName;
  const metrics = modelReport.metrics ?? {};
  const aucText = metrics.testAuc === null || metrics.testAuc === undefined ? "n/a" : metrics.testAuc.toFixed(2);
  const balancedAccuracyText = metrics.balancedAccuracy === undefined ? "n/a" : percent.format(metrics.balancedAccuracy);
  const brierText = metrics.brierScore === undefined ? "n/a" : metrics.brierScore.toFixed(3);
  const denialRecallText = metrics.denialRecall === undefined ? "n/a" : percent.format(metrics.denialRecall);
  els.modelMeta.innerHTML = `
    <span>Rows</span><strong>${modelReport.rows.total.toLocaleString()}</strong>
    <span>AUC</span><strong>${aucText}</strong>
    <span>Balanced accuracy</span><strong>${balancedAccuracyText}</strong>
    <span>Brier score</span><strong>${brierText}</strong>
    <span>Denied recall</span><strong>${denialRecallText}</strong>
  `;
}

function render() {
  const derived = getDerived();
  updateScore(derived);
  updateMetrics(derived);
  updateRecommendation(derived);
  updateFinanceTools(derived);
  drawScatter(derived);
  drawMap(derived);
  updateModelMeta();
  updateDrivers(derived);
  syncScenarioWithBackend();
}

function setActiveSection(sectionName) {
  els.navItems.forEach(item => {
    const isActive = item.dataset.section === sectionName;
    item.classList.toggle("active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });
}

function scrollToSection(sectionName) {
  const section = document.querySelector(`[data-section="${sectionName}"].app-section`);
  if (!section) return;
  setActiveSection(sectionName);
  section.scrollIntoView({
    behavior: "auto",
    block: "start"
  });
}

function bind() {
  els.marketSelect.addEventListener("change", event => {
    state.market = event.target.value;
    render();
  });

  [
    [els.incomeRange, "income"],
    [els.debtRange, "debt"],
    [els.savingsRange, "savings"],
    [els.priceRange, "price"]
  ].forEach(([input, key]) => {
    input.addEventListener("input", event => {
      state[key] = Number(event.target.value);
      render();
    });
  });

  [
    [els.foodRange, "food"],
    [els.transportRange, "transport"],
    [els.lifestyleRange, "lifestyle"],
    [els.investingRange, "investing"]
  ].forEach(([input, key]) => {
    input.addEventListener("input", event => {
      state.expenses[key] = Number(event.target.value);
      render();
    });
  });

  els.riskButtons.forEach(button => {
    button.addEventListener("click", () => {
      state.riskMode = button.dataset.risk;
      els.riskButtons.forEach(item => item.classList.toggle("active", item === button));
      render();
    });
  });

  els.navItems.forEach(item => {
    item.addEventListener("click", () => {
      scrollToSection(item.dataset.section);
    });
  });
}

function populateMarketSelect() {
  const labels = {
    Sacramento: "Sacramento County",
    Alameda: "Alameda County",
    "San Diego": "San Diego County",
    "Los Angeles": "Los Angeles County"
  };

  els.marketSelect.innerHTML = Object.keys(dataModel.markets).map(market => (
    `<option value="${market}">${labels[market] ?? market}</option>`
  )).join("");
  els.marketSelect.value = state.market;
}

async function loadHmdaData() {
  try {
    dataModel = await fetchJson(["/api/hmda", "public/data/hmda_processed.json"]);
    els.dataSourcePill.textContent = dataModel.source.name;
    updateBackendStatus(true);
  } catch (error) {
    console.warn(error);
    els.dataSourcePill.textContent = "Built-in sample";
    updateBackendStatus(false);
  }
}

async function loadModelReport() {
  try {
    modelReport = await fetchJson(["/api/model", "public/data/model_report.json"]);
  } catch (error) {
    console.warn(error);
    modelReport = null;
  }
}

async function loadBenchmarkData() {
  try {
    benchmarkModel = await fetchJson(["/api/benchmarks", "public/data/bls_benchmarks.json"]);
  } catch (error) {
    console.warn(error);
    benchmarkModel = fallbackBenchmarkModel;
  }
}

async function init() {
  await Promise.all([loadHmdaData(), loadModelReport(), loadBenchmarkData()]);
  populateMarketSelect();
  bind();
  render();
}

init();
