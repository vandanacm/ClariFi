from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import MODEL_PATH, ScenarioInput, app, model_score, scenario_from_question, summarize_transactions

client = TestClient(app)


def test_summarize_transactions_averages_months() -> None:
    rows = [
        {"date": "2026-01-15", "category": "income", "amount": 5000},
        {"date": "2026-01-28", "category": "income", "amount": 5000},
        {"date": "2026-02-15", "category": "income", "amount": 5000},
        {"date": "2026-02-28", "category": "income", "amount": 5000},
        {"date": "2026-01-05", "category": "food", "amount": -400},
        {"date": "2026-02-05", "category": "food", "amount": -600},
    ]
    summary = summarize_transactions(rows)
    assert summary["monthsObserved"] == 2
    assert summary["monthlyIncomeObserved"] == 10000
    assert summary["categoryTotals"]["food"] == -500


def test_summarize_transactions_empty() -> None:
    summary = summarize_transactions([])
    assert summary["transactionCount"] == 0
    assert summary["monthsObserved"] == 0
    assert summary["monthlyIncomeObserved"] == 0.0


def test_scenario_from_question_infers_market() -> None:
    scenario = ScenarioInput(market="Sacramento")
    updated = scenario_from_question("What if I buy in San Diego?", scenario)
    assert updated.market == "San Diego"


def test_health_reports_hmda_meta() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["hmdaChart"]["scatterRows"] > 48
    assert payload["hmdaChart"]["rawRows"] is not None


@pytest.mark.skipif(not MODEL_PATH.exists(), reason="joblib artifact not present")
def test_model_score_when_artifact_present() -> None:
    import api.main as main_module
    import joblib

    main_module.MODEL_CACHE = joblib.load(MODEL_PATH)
    score = model_score(ScenarioInput())
    assert score["mode"] == "calibrated-xgboost"
    assert score["modelReady"] is True
    assert score["score"] is not None
    assert 0 <= score["score"] <= 100
    assert score["approvalLikelihood"] is not None
    assert 0 <= score["approvalLikelihood"] <= 1


def test_score_endpoint_returns_probability() -> None:
    response = client.post("/api/mortgage/score", json=ScenarioInput().model_dump())
    assert response.status_code == 200
    payload = response.json()
    assert "score" in payload
    assert "approvalLikelihood" in payload


def test_upload_rejects_invalid_amounts() -> None:
    csv_body = "date,merchant,category,amount\n2026-01-01,Test,food,not-a-number\n"
    response = client.post(
        "/api/transactions/upload",
        files={"file": ("bad.csv", csv_body, "text/csv")},
    )
    assert response.status_code == 400
