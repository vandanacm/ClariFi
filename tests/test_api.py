from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import MODEL_PATH, app, model_score, scenario_from_question
from data_scheme import ScenarioInput
from import_data import summarize_transactions

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
    assert "modelLoaded" in payload
    assert "modelLoadError" in payload
    if payload["modelArtifactPresent"]:
        assert payload["scoringPipeline"] in {"calibrated-xgboost", "unavailable"}


@pytest.mark.skipif(not MODEL_PATH.exists(), reason="joblib artifact not present")
def test_model_score_when_artifact_present() -> None:
    import main as main_module

    assert main_module.load_model_cache() is True
    score = model_score(ScenarioInput())
    assert score["mode"] == "calibrated-xgboost"
    assert score["modelReady"] is True
    assert score["score"] is not None
    assert 0 <= score["score"] <= 100
    assert score["approvalLikelihood"] is not None
    assert 0 <= score["approvalLikelihood"] <= 1


@pytest.mark.skipif(not MODEL_PATH.exists(), reason="joblib artifact not present")
def test_score_endpoint_returns_probability() -> None:
    import main as main_module

    main_module.load_model_cache()
    response = client.post("/api/mortgage/score", json=ScenarioInput().model_dump())
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "calibrated-xgboost"
    assert payload["modelReady"] is True
    assert payload["score"] is not None
    assert payload["approvalLikelihood"] is not None


def test_upload_rejects_invalid_amounts() -> None:
    csv_body = "date,merchant,category,amount\n2026-01-01,Test,food,not-a-number\n"
    response = client.post(
        "/api/transactions/upload",
        files={"file": ("bad.csv", csv_body, "text/csv")},
    )
    assert response.status_code == 400


def test_auth_register_and_login() -> None:
    email = f"test-{uuid.uuid4().hex[:8]}@clarifi.test"
    password = "testpass123"

    reg = client.post("/api/auth/register", json={"email": email, "password": password, "name": "Test User"})
    assert reg.status_code == 200
    reg_body = reg.json()
    assert "token" in reg_body
    assert len(reg_body["token"]) > 0

    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    login_body = login.json()
    assert "token" in login_body
    assert len(login_body["token"]) > 0


def test_save_and_list_scenarios() -> None:
    email = f"test-{uuid.uuid4().hex[:8]}@clarifi.test"
    reg = client.post("/api/auth/register", json={"email": email, "password": "testpass123"})
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = ScenarioInput(market="Sacramento", income=9000, debt=1200, savings=75000, price=520000).model_dump()
    save_resp = client.post("/api/scenarios", json=payload, headers=headers)
    assert save_resp.status_code == 200

    list_resp = client.get("/api/scenarios", headers=headers)
    assert list_resp.status_code == 200
    data = list_resp.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) >= 1
    first = data["scenarios"][0]
    assert "id" in first
    assert "createdAt" in first
    assert "input" in first
    assert "result" in first


def test_score_includes_drivers() -> None:
    payload = ScenarioInput(market="Alameda", income=10000, debt=1500, savings=100000, price=650000).model_dump()
    resp = client.post("/api/mortgage/score", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "drivers" in body
    assert len(body["drivers"]) >= 1
    for driver in body["drivers"]:
        assert "label" in driver
        assert "value" in driver
        assert "direction" in driver
        assert driver["direction"] in {"positive", "negative"}
    assert 0.0 <= body["dti"] <= 1.0
    assert 0.0 <= body["downPaymentRate"] <= 1.0


def test_counterfactual_structure() -> None:
    payload = ScenarioInput(market="Los Angeles", income=6000, debt=3000, savings=40000, price=750000).model_dump()
    resp = client.post("/api/mortgage/score", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    if body.get("counterfactual"):
        cf = body["counterfactual"]
        assert "feature" in cf
        assert "suggestion" in cf
        assert "change" in cf
        assert "newApproval" in cf
        assert "newScore" in cf
        assert "delta" in cf


def test_risk_grid_endpoint() -> None:
    payload = ScenarioInput().model_dump()
    resp = client.post("/api/risk-grid", json=payload)
    assert resp.status_code == 200
    grid = resp.json()
    assert isinstance(grid, list)


def test_agent_explain_returns_annotation() -> None:
    payload = {"question": "Why was I denied?", "scenario": ScenarioInput().model_dump()}
    resp = client.post("/api/agent/explain", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "answer" in body
    assert "highlight" in body
    assert "annotation" in body
    assert "section" in body["annotation"]
