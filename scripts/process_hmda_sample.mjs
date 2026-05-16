import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const inputPath = process.argv[2] ?? "data/sample_hmda_lar.csv";
const outputPath = process.argv[3] ?? "public/data/hmda_processed.json";

const marketCountyMap = {
  Sacramento: ["Sacramento", "Yolo", "Placer", "Contra Costa"],
  Alameda: ["Alameda", "Contra Costa", "Santa Clara", "San Mateo"],
  "San Diego": ["San Diego", "Orange", "Riverside", "Los Angeles"],
  "Los Angeles": ["Los Angeles", "Orange", "Riverside", "Ventura"]
};

const dtiMidpoints = {
  "<20%": 0.18,
  "20%-<30%": 0.25,
  "30%-<36%": 0.33,
  "36%-<50%": 0.43,
  "50%-60%": 0.55,
  ">60%": 0.64
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

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function approvalRate(rows) {
  if (!rows.length) return 0;
  const approved = rows.filter(row => row.approved).length;
  return approved / rows.length;
}

function readinessFromCounty(rows) {
  const approvedRows = rows.filter(row => row.approved);
  const rate = approvalRate(rows);
  const medianApprovedIncome = median(approvedRows.map(row => row.income));
  const medianApprovedLoan = median(approvedRows.map(row => row.loanAmount));
  const affordability = medianApprovedIncome / Math.max(medianApprovedLoan, 1);

  return Math.round(
    Math.min(
      Math.max(rate * 55 + affordability * 290 + approvedRows.length * 1.6, 28),
      94
    )
  );
}

const rawRows = parseCsv(await readFile(inputPath, "utf8"));
const loans = rawRows.map((row, index) => ({
  id: `hmda-${index + 1}`,
  county: row.county,
  income: Number(row.applicant_income) * 1000,
  loanAmount: Number(row.loan_amount) * 1000,
  approved: ["1", "2"].includes(row.action_taken),
  actionTaken: Number(row.action_taken),
  loanProduct: row.derived_loan_product_type,
  loanPurpose: row.loan_purpose,
  dti: dtiMidpoints[row.debt_to_income_ratio] ?? 0.4,
  propertyValue: Number(row.property_value) * 1000,
  interestRate: Number(row.interest_rate)
}));

const markets = Object.fromEntries(
  Object.entries(marketCountyMap).map(([marketName, counties]) => {
    const marketRows = loans.filter(row => counties.includes(row.county));
    const approvedRows = marketRows.filter(row => row.approved);
    const countySummaries = counties.map(county => {
      const countyRows = loans.filter(row => row.county === county);
      return {
        name: county,
        readiness: readinessFromCounty(countyRows),
        approvalRate: Number(approvalRate(countyRows).toFixed(3)),
        applications: countyRows.length,
        medianApprovedIncome: Math.round(median(countyRows.filter(row => row.approved).map(row => row.income))),
        medianApprovedLoan: Math.round(median(countyRows.filter(row => row.approved).map(row => row.loanAmount)))
      };
    });

    return [
      marketName,
      {
        incomeMedian: Math.round(median(approvedRows.map(row => row.income)) / 12),
        priceMedian: Math.round(median(approvedRows.map(row => row.propertyValue))),
        approvalBase: Number(approvalRate(marketRows).toFixed(3)),
        counties: countySummaries
      }
    ];
  })
);

const scatter = loans.map(row => ({
  id: row.id,
  marketTags: Object.entries(marketCountyMap)
    .filter(([, counties]) => counties.includes(row.county))
    .map(([market]) => market),
  county: row.county,
  incomeMonthly: Math.round(row.income / 12),
  loanAmount: row.loanAmount,
  approved: row.approved,
  dti: row.dti,
  interestRate: row.interestRate
}));

const payload = {
  generatedAt: new Date().toISOString(),
  source: {
    name: "HMDA-shaped sample",
    note: "Small local sample using public HMDA LAR-style fields. Replace input CSV with FFIEC/CFPB modified LAR extracts for production analysis."
  },
  markets,
  scatter
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(`Processed ${loans.length} HMDA-style rows into ${outputPath}`);
