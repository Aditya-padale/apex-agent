import pytest
from fastapi.testclient import TestClient
from backend.main import app, _rate_limit_history


@pytest.fixture(autouse=True)
def clear_rate_limits():
    """Reset the in-memory rate limiter between tests."""
    _rate_limit_history.clear()
    yield
    _rate_limit_history.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_api_root(client):
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    res_api = client.get("/api")
    assert res_api.status_code == 200
    assert res_api.json()["status"] == "ok"


def test_health_check(client, monkeypatch):
    monkeypatch.setenv("ALLOW_CODE_EXECUTION", "false")
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "ApexAgent" in data["service"]
    assert data["code_execution_enabled"] is False

    monkeypatch.setenv("ALLOW_CODE_EXECUTION", "true")
    res_true = client.get("/api/health")
    assert res_true.json()["code_execution_enabled"] is True


def test_list_scenarios(client):
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    data = res.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) >= 3


def test_get_scenario_detail(client):
    res = client.get("/api/scenarios/scenario_1_binary_search")
    assert res.status_code == 200
    data = res.json()
    assert data["scenario"]["id"] == "scenario_1_binary_search"


def test_run_agent_validation_error(client):
    # Missing scenario_id and workspace_files
    res = client.post("/api/run-agent", json={})
    assert res.status_code == 422


def test_run_agent_user_code_blocked_by_default(client, monkeypatch):
    # When ALLOW_CODE_EXECUTION is false, custom workspaces return 403
    monkeypatch.setenv("ALLOW_CODE_EXECUTION", "false")
    payload = {
        "workspace_files": {"main.py": "print('hello')"},
        "custom_prompt": "Run this file",
    }
    res = client.post("/api/run-agent", json=payload)
    assert res.status_code == 403
    assert "disabled on this server" in res.json()["detail"]


def test_test_sandbox_blocked_by_default(client, monkeypatch):
    # When ALLOW_CODE_EXECUTION is false, /api/test-sandbox returns 403
    monkeypatch.setenv("ALLOW_CODE_EXECUTION", "false")
    payload = {
        "workspace_files": {"main.py": "print('hello')"},
    }
    res = client.post("/api/test-sandbox", json=payload)
    assert res.status_code == 403
    assert "disabled on this server" in res.json()["detail"]


def test_test_sandbox_allowed_when_enabled(client, monkeypatch):
    monkeypatch.setenv("ALLOW_CODE_EXECUTION", "true")
    payload = {
        "workspace_files": {"main.py": "print('hello world')"},
    }
    res = client.post("/api/test-sandbox", json=payload)
    assert res.status_code == 200
    assert "sandbox_result" in res.json()


def test_access_token_enforcement(client, monkeypatch):
    monkeypatch.setattr("backend.main.APEX_ACCESS_TOKEN", "secret-token-123")

    # Missing token -> 401
    res = client.post("/api/test-sandbox", json={"code": "1"})
    assert res.status_code == 401

    # Wrong token -> 401
    res = client.post(
        "/api/test-sandbox",
        json={"code": "1"},
        headers={"X-Access-Token": "wrong-token"},
    )
    assert res.status_code == 401
