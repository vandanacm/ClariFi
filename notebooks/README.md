# ClariFi notebooks

## `hmda_2025_xgboost_shap.ipynb`

This notebook trains the computational / ML component for ClariFi:

- 2025 HMDA Modified LAR input
- California home-purchase, owner-occupied, first-lien filtering
- EDA for data quality, outcome balance, counties, income, loan amount, and approval patterns
- Logistic Regression baseline versus tuned XGBoost
- threshold tuning, ROC/PR curves, calibration, and segment diagnostics
- SHAP global and local explanations
- JSON/CSV model report exports for the dashboard

Before running, download the 2025 HMDA Modified LAR CSV from:

https://ffiec.cfpb.gov/data-publication/modified-lar

For class/demo speed, use the sampled model-ready file:

```text
server/data/hmda_2025_ca_model_ready_60000.csv
```

For the full run, place the national HMDA file at:

```text
server/data/hmda_2025_modified_lar.csv
```

or update `DATA_PATH` in the notebook / use the Colab upload cell.

The national HMDA file is large, so the notebook reads it in chunks and filters
to the California model scope before modeling.
