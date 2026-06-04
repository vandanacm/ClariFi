User Upload Pack (4 personas)

How to use in ClariFi
1) Register each user from user_profiles_seed.csv (email/password).
2) Log in as that user.
3) Upload the matching CSV file using the "Upload CSV" button in the top-right header.
4) Optionally adjust the What-If Simulator sliders to the profile targets below.

Personas

| Persona       | Email                      | CSV file                               | Market      | Income   | Debt   | Savings  | Target price | Expected outcome                         |
|---------------|----------------------------|----------------------------------------|-------------|----------|--------|----------|--------------|------------------------------------------|
| Sofia Chen    | sofia.sf@clarifi.test      | sf_high_income_transactions.csv        | Alameda     | $18,500  | $900   | $240,000 | $1,450,000   | Strong Bay Area affordability            |
| Arjun Patel   | arjun.bay@clarifi.test     | bay_median_plus_transactions.csv       | San Diego   | $12,800  | $1,200 | $130,000 | $790,000     | Borderline / possible San Diego purchase |
| Maya Gomez    | maya.sac@clarifi.test      | sacramento_mid_income_transactions.csv | Sacramento  | $9,200   | $950   | $85,000  | $560,000     | Good fit in Sacramento region            |
| Diego Rivera  | diego.inland@clarifi.test  | inland_lower_income_transactions.csv   | Los Angeles | $6,200   | $1,400 | $35,000  | $520,000     | Likely constrained in coastal markets    |

Password for all test accounts: Testpass123

Re-upload testing
-----------------
reupload_test_transactions.csv is a standalone file for testing the CSV re-upload
feature. Log in as any existing user, then upload this file via the "Upload CSV"
button to replace their current transactions and see the dashboard metrics update.
No new account needed.

  ~$9,200/mo income · $870 debt · $600/mo savings · 2 months (Mar–Apr 2026)

CSV format
----------
All files use the ClariFi upload format:

  id,date,merchant,category,amount

Valid categories: income, housing, food, transport, debt, lifestyle, savings
- Positive amounts = income inflows
- Negative amounts = expenses/outflows
