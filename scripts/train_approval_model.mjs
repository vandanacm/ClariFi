import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const inputPath = process.argv[2] ?? "data/sample_hmda_lar.csv";
const outputPath = process.argv[3] ?? "public/data/model_report.json";

const dtiMidpoints = {
  "<20%": 0.18,
  "20%-<30%": 0.25,
  "30%-<36%": 0.33,
  "36%-<50%": 0.43,
  "50%-60%": 0.55,
  ">60%": 0.64
};

const featureLabels = {
  incomeK: "Applicant income",
  loanAmountK: "Requested loan amount",
  dti: "Debt-to-income pressure",
  loanToValue: "Loan-to-value proxy",
  interestRate: "Interest rate",
  propertyValueK: "Property value"
};

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");

  return lines.map(line => {
    const values = line.split(",");
    return headers.reduce((row, header, index) => {
      row[header] = values[index];
      return row;
    }, {});
  });
}

function sigmoid(value) {
  if (value < -40) return 0;
  if (value > 40) return 1;
  return 1 / (1 + Math.exp(-value));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values) {
  const avg = mean(values);
  const variance = mean(values.map(value => (value - avg) ** 2));
  return Math.sqrt(variance) || 1;
}

function auc(rows) {
  const positives = rows.filter(row => row.label === 1);
  const negatives = rows.filter(row => row.label === 0);
  if (!positives.length || !negatives.length) return null;

  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.score > negative.score) wins += 1;
      if (positive.score === negative.score) wins += 0.5;
    }
  }
  return wins / (positives.length * negatives.length);
}

function buildRows(rawRows) {
  return rawRows.map(row => {
    const incomeK = Number(row.applicant_income);
    const loanAmountK = Number(row.loan_amount);
    const propertyValueK = Number(row.property_value);
    const dti = dtiMidpoints[row.debt_to_income_ratio] ?? 0.4;
    return {
      county: row.county,
      label: ["1", "2"].includes(row.action_taken) ? 1 : 0,
      features: {
        incomeK,
        loanAmountK,
        dti,
        loanToValue: loanAmountK / Math.max(propertyValueK, 1),
        interestRate: Number(row.interest_rate),
        propertyValueK
      }
    };
  });
}

function standardize(rows, featureNames) {
  const stats = Object.fromEntries(
    featureNames.map(name => {
      const values = rows.map(row => row.features[name]);
      return [name, { mean: mean(values), std: std(values) }];
    })
  );

  const transformed = rows.map(row => ({
    ...row,
    x: featureNames.map(name => (row.features[name] - stats[name].mean) / stats[name].std)
  }));

  return { rows: transformed, stats };
}

function trainLogistic(rows, featureCount) {
  const weights = Array(featureCount).fill(0);
  let bias = 0;
  const learningRate = 0.08;
  const l2 = 0.005;
  const epochs = 2600;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = Array(featureCount).fill(0);
    let biasGradient = 0;

    for (const row of rows) {
      const linear = bias + row.x.reduce((sum, value, index) => sum + value * weights[index], 0);
      const error = sigmoid(linear) - row.label;
      biasGradient += error;
      for (let i = 0; i < featureCount; i += 1) {
        gradient[i] += error * row.x[i] + l2 * weights[i];
      }
    }

    bias -= learningRate * (biasGradient / rows.length);
    for (let i = 0; i < featureCount; i += 1) {
      weights[i] -= learningRate * (gradient[i] / rows.length);
    }
  }

  return { weights, bias };
}

function scoreRows(rows, model) {
  return rows.map(row => {
    const linear = model.bias + row.x.reduce((sum, value, index) => sum + value * model.weights[index], 0);
    return {
      ...row,
      score: sigmoid(linear),
      predicted: sigmoid(linear) >= 0.5 ? 1 : 0
    };
  });
}

function accuracy(rows) {
  return rows.filter(row => row.predicted === row.label).length / rows.length;
}

function groupedApproval(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.county)) groups.set(row.county, []);
    groups.get(row.county).push(row);
  }

  return Array.from(groups.entries()).map(([county, countyRows]) => ({
    county,
    rows: countyRows.length,
    actualApprovalRate: countyRows.filter(row => row.label === 1).length / countyRows.length,
    predictedApprovalRate: mean(countyRows.map(row => row.score))
  }));
}

const rawRows = parseCsv(await readFile(inputPath, "utf8"));
const featureNames = ["incomeK", "loanAmountK", "dti", "loanToValue", "interestRate", "propertyValueK"];
const allRows = buildRows(rawRows);
const { rows, stats } = standardize(allRows, featureNames);
const trainRows = rows.filter((_, index) => index % 5 !== 0);
const testRows = rows.filter((_, index) => index % 5 === 0);
const model = trainLogistic(trainRows, featureNames.length);
const scoredTrain = scoreRows(trainRows, model);
const scoredTest = scoreRows(testRows, model);

const featureWeights = featureNames
  .map((name, index) => ({
    feature: name,
    label: featureLabels[name],
    coefficient: Number(model.weights[index].toFixed(4)),
    direction: model.weights[index] >= 0 ? "positive" : "negative",
    magnitude: Math.abs(model.weights[index])
  }))
  .sort((a, b) => b.magnitude - a.magnitude);

const payload = {
  generatedAt: new Date().toISOString(),
  modelName: "Logistic approval baseline",
  note: "Dependency-free baseline model for the current HMDA-shaped sample. Replace input data with real HMDA extracts before drawing course conclusions.",
  rows: {
    total: rows.length,
    train: trainRows.length,
    test: testRows.length
  },
  metrics: {
    trainAccuracy: Number(accuracy(scoredTrain).toFixed(3)),
    testAccuracy: Number(accuracy(scoredTest).toFixed(3)),
    testAuc: auc(scoredTest) === null ? null : Number(auc(scoredTest).toFixed(3))
  },
  features: featureWeights,
  featureStats: stats,
  countyCalibration: groupedApproval(scoreRows(rows, model)).map(row => ({
    county: row.county,
    rows: row.rows,
    actualApprovalRate: Number(row.actualApprovalRate.toFixed(3)),
    predictedApprovalRate: Number(row.predictedApprovalRate.toFixed(3))
  }))
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Trained ${payload.modelName} on ${rows.length} rows -> ${outputPath}`);
