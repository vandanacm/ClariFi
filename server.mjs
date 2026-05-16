import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 5173);
const host = process.env.HOST ?? "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

const demoProfile = {
  id: "demo-household",
  name: "Demo Household",
  region: "West",
  householdType: "2-person renter/owner transition",
  goals: ["Build emergency runway", "Reach 20% down payment", "Compare target counties"],
  scenario: {
    market: "Sacramento",
    income: 9400,
    debt: 1250,
    savings: 82000,
    price: 560000,
    expenses: {
      food: 900,
      transport: 525,
      lifestyle: 850,
      investing: 1100
    }
  }
};

const agentArchitecture = [
  {
    name: "Profile Agent",
    role: "Reads user profile, goals, household type, and region.",
    output: "Peer group and scenario defaults"
  },
  {
    name: "Data Agent",
    role: "Cleans transaction data and maps categories to BLS-style expense groups.",
    output: "Normalized spending categories"
  },
  {
    name: "Insight Agent",
    role: "Detects anomalies, spending shifts, recurring expenses, and forecast risk.",
    output: "Ranked alerts and next actions"
  },
  {
    name: "Benchmark Agent",
    role: "Compares the user to similar U.S. households using BLS CE benchmarks.",
    output: "Peer deltas by category"
  },
  {
    name: "Explainer Agent",
    role: "Answers questions and highlights the relevant dashboard views.",
    output: "Dashboard guidance"
  }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

async function readJson(relativePath) {
  const text = await readFile(path.join(__dirname, relativePath), "utf8");
  return JSON.parse(text);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function notFound(response) {
  jsonResponse(response, 404, { error: "Not found" });
}

function computeScenario({ scenario, hmda, benchmarks }) {
  const marketName = scenario.market ?? demoProfile.scenario.market;
  const market = hmda.markets[marketName] ?? hmda.markets[demoProfile.scenario.market];
  const expenses = {
    ...demoProfile.scenario.expenses,
    ...(scenario.expenses ?? {})
  };
  const income = Number(scenario.income ?? demoProfile.scenario.income);
  const debt = Number(scenario.debt ?? demoProfile.scenario.debt);
  const savings = Number(scenario.savings ?? demoProfile.scenario.savings);
  const price = Number(scenario.price ?? demoProfile.scenario.price);
  const monthlyHousing = (price - savings) * 0.0062;
  const flexibleExpenses = Object.values(expenses).reduce((sum, value) => sum + Number(value), 0);
  const monthlySurplus = income - debt - monthlyHousing - flexibleExpenses;
  const dti = (debt + monthlyHousing) / income;
  const downPaymentRate = savings / price;
  const savingsRate = clamp(monthlySurplus / income, -0.22, 0.46);
  const incomeFit = income / market.incomeMedian;
  const priceFit = market.priceMedian / price;
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

  const valuesByCategory = {
    housing: monthlyHousing,
    food: expenses.food,
    transport: expenses.transport,
    lifestyle: expenses.lifestyle,
    savings: Math.max(monthlySurplus + expenses.investing, 0)
  };
  const benchmarkDeltas = benchmarks.categories.map(category => ({
    key: category.key,
    label: category.label,
    userMonthly: Math.round(valuesByCategory[category.key] ?? 0),
    peerMonthly: category.monthlyPeer,
    delta: Math.round((valuesByCategory[category.key] ?? 0) - category.monthlyPeer)
  }));

  const insights = [];
  if (dti > 0.36) {
    insights.push({
      agent: "Insight Agent",
      type: "forecast-risk",
      title: "DTI pressure is above target",
      detail: "Debt plus estimated housing cost is above the 36% mortgage-readiness threshold.",
      focus: "readiness"
    });
  }
  const foodDelta = benchmarkDeltas.find(item => item.key === "food");
  if (foodDelta && foodDelta.delta > 100) {
    insights.push({
      agent: "Benchmark Agent",
      type: "peer-comparison",
      title: "Food spending is running high",
      detail: `Food spending is ${formatDollars(foodDelta.delta)} above the current BLS-style peer benchmark.`,
      focus: "finances"
    });
  }
  if (monthlySurplus < 0) {
    insights.push({
      agent: "Insight Agent",
      type: "cashflow-alert",
      title: "Monthly cashflow is negative",
      detail: "Scenario changes should restore surplus before increasing the target home price.",
      focus: "finances"
    });
  }
  if (downPaymentRate < 0.2) {
    insights.push({
      agent: "Explainer Agent",
      type: "scenario-change",
      title: "Down payment gap remains",
      detail: `${formatDollars(Math.max(price * 0.2 - savings, 0))} more savings reaches a 20% down payment.`,
      focus: "model"
    });
  }
  if (!insights.length) {
    insights.push({
      agent: "Explainer Agent",
      type: "guided-exploration",
      title: "Scenario is balanced",
      detail: "The current profile has positive cashflow and tracks near peer spending benchmarks.",
      focus: "readiness"
    });
  }

  return {
    market: marketName,
    score: Math.round(score),
    approval: Number(approval.toFixed(3)),
    monthlyHousing: Math.round(monthlyHousing),
    monthlySurplus: Math.round(monthlySurplus),
    dti: Number(dti.toFixed(3)),
    downPaymentRate: Number(downPaymentRate.toFixed(3)),
    savingsRate: Number(savingsRate.toFixed(3)),
    benchmarkDeltas,
    insights: insights.slice(0, 4)
  };
}

function formatDollars(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/health") {
    jsonResponse(response, 200, {
      ok: true,
      name: "ClariFi API",
      datasets: ["BLS CE benchmark sample", "HMDA-shaped sample"],
      generatedAt: new Date().toISOString()
    });
    return;
  }

  if (url.pathname === "/api/profile") {
    jsonResponse(response, 200, demoProfile);
    return;
  }

  if (url.pathname === "/api/agents") {
    jsonResponse(response, 200, { agents: agentArchitecture });
    return;
  }

  if (url.pathname === "/api/benchmarks") {
    jsonResponse(response, 200, await readJson("public/data/bls_benchmarks.json"));
    return;
  }

  if (url.pathname === "/api/hmda") {
    jsonResponse(response, 200, await readJson("public/data/hmda_processed.json"));
    return;
  }

  if (url.pathname === "/api/model") {
    jsonResponse(response, 200, await readJson("public/data/model_report.json"));
    return;
  }

  if (url.pathname === "/api/scenario" && request.method === "POST") {
    const [hmda, benchmarks, body] = await Promise.all([
      readJson("public/data/hmda_processed.json"),
      readJson("public/data/bls_benchmarks.json"),
      readBody(request)
    ]);
    jsonResponse(response, 200, computeScenario({
      scenario: body.scenario ?? {},
      hmda,
      benchmarks
    }));
    return;
  }

  notFound(response);
}

async function serveStatic(response, url) {
  const pathname = decodeURIComponent(url.pathname);
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(__dirname, normalized));

  if (!filePath.startsWith(__dirname)) {
    notFound(response);
    return;
  }

  try {
    const data = await readFile(filePath);
    const extension = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] ?? "application/octet-stream"
    });
    response.end(data);
  } catch {
    const index = await readFile(path.join(__dirname, "index.html"));
    response.writeHead(200, {
      "Content-Type": contentTypes[".html"]
    });
    response.end(index);
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    await serveStatic(response, url);
  } catch (error) {
    console.error(error);
    jsonResponse(response, 500, {
      error: "Internal server error",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(port, host, () => {
  console.log(`ClariFi running at http://${host}:${port}`);
});
