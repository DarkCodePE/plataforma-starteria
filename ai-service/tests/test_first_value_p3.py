"""Contract tests for the stateless, provisional First Value P3 processor."""

from fastapi.testclient import TestClient
import pytest

from agents import first_value_p3
from main import app

pytestmark = pytest.mark.unit


def valid_input():
    return {
        "sessionId": "session-1",
        "requestId": "request-1",
        "p2Confirmed": True,
        "goal": "Increase qualified B2B sales",
        "context": "Q4",
        "initiatives": [
            {"itemId": "item-1", "name": "Customer outreach", "description": "Contact target accounts"},
            {"itemId": "item-2", "name": "Pricing pilot"},
        ],
        "clarifications": [],
    }


class FakeChain:
    def __init__(self, output):
        self.output = output
        self.calls = 0
        self.messages = None

    def invoke(self, messages):
        self.calls += 1
        self.messages = messages
        return self.output


def valid_output():
    return {
        "relationships": [
            {"itemId": "item-1", "disposition": "DIRECT_CONTRIBUTION", "rationale": "Supports outreach to target accounts.", "evidenceRefs": ["goal", "initiative:item-1"]},
            {"itemId": "item-2", "disposition": "NEEDS_CONTEXT", "rationale": "The supplied context does not explain its role.", "evidenceRefs": ["initiative:item-2"]},
        ],
        "clarifications": [
            {"id": "q-1", "affectedItemIds": ["item-1", "item-2"], "question": "Do Customer outreach and Pricing pilot support the same Q4 sales goal?", "reason": "The answer could change how both contributions are read."}
        ],
        "summary": "Customer outreach appears direct; the pricing pilot needs context.",
    }


def test_provider_invoked_once_for_confirmed_input_and_uses_specific_prompt(monkeypatch):
    chain = FakeChain(valid_output())
    monkeypatch.setattr(first_value_p3, "_get_chain", lambda: chain)

    result = first_value_p3.process(valid_input())

    assert chain.calls == 1
    system_prompt = first_value_p3.SYSTEM_PROMPT
    assert "Portfolio Entry" not in system_prompt
    assert "Do not invent owners or dependencies" in system_prompt
    assert result["relationships"][0]["itemId"] == "item-1"


def test_fastapi_boundary_processes_confirmed_input_with_fake_provider(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "test-internal")
    chain = FakeChain(valid_output())
    monkeypatch.setattr(first_value_p3, "_get_chain", lambda: chain)
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/first-value/p3/analyze", json=valid_input(), headers={"X-Internal-Token": "test-internal"})
    assert response.status_code == 200
    assert chain.calls == 1
    assert response.json()["processorId"].startswith("openrouter:")


def test_unconfirmed_input_is_rejected_before_provider(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "test-internal")
    chain = FakeChain(valid_output())
    monkeypatch.setattr(first_value_p3, "_get_chain", lambda: chain)
    body = valid_input()
    body["p2Confirmed"] = False
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/first-value/p3/analyze", json=body, headers={"X-Internal-Token": "test-internal"})
    assert response.status_code == 422
    assert chain.calls == 0


def test_processor_failure_is_unavailable_without_fallback(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "test-internal")
    def fail():
        raise RuntimeError("provider unavailable")
    monkeypatch.setattr(first_value_p3, "_get_chain", fail)
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/first-value/p3/analyze", json=valid_input(), headers={"X-Internal-Token": "test-internal"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "P3_PROCESSOR_UNAVAILABLE"


def test_incomplete_model_output_fails_without_fixture_or_repair(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "test-internal")
    chain = FakeChain({"relationships": [], "clarifications": [], "summary": "No exceptions."})
    monkeypatch.setattr(first_value_p3, "_get_chain", lambda: chain)
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/first-value/p3/analyze", json=valid_input(), headers={"X-Internal-Token": "test-internal"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "P3_INVALID_ANALYSIS"


def test_internal_endpoint_rejects_wrong_internal_token(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "expected")
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/first-value/p3/analyze", json=valid_input(), headers={"X-Internal-Token": "wrong"})
    assert response.status_code == 401


def test_internal_endpoint_fails_closed_when_secret_is_not_configured(monkeypatch):
    monkeypatch.delenv("AI_SERVICE_INTERNAL_TOKEN", raising=False)
    chain = FakeChain(valid_output())
    monkeypatch.setattr(first_value_p3, "_get_chain", lambda: chain)
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/first-value/p3/analyze", json=valid_input())
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "P3_PROCESSOR_UNAVAILABLE"
    assert chain.calls == 0


def test_output_has_exactly_one_relationship_and_provisional_state(monkeypatch):
    chain = FakeChain(valid_output())
    monkeypatch.setattr(first_value_p3, "_get_chain", lambda: chain)
    result = first_value_p3.process(valid_input())
    assert len(result["relationships"]) == len(valid_input()["initiatives"])
    assert "resultState" not in result  # backend application stamps PROVISIONAL
    assert result["processorId"].startswith("openrouter:")


def test_invalid_structured_output_has_typed_failure_without_repair(monkeypatch):
    chain = FakeChain({"relationships": [], "clarifications": [], "summary": "No exceptions."})
    monkeypatch.setattr(first_value_p3, "_get_chain", lambda: chain)
    try:
        first_value_p3.process(valid_input())
        assert False, "expected P3InvalidAnalysisError"
    except first_value_p3.P3InvalidAnalysisError:
        assert chain.calls == 1


def test_timeout_is_returned_as_typed_failure(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "test-internal")

    class TimeoutChain:
        def invoke(self, _messages):
            raise TimeoutError("model timed out")

    monkeypatch.setattr(first_value_p3, "_get_chain", lambda: TimeoutChain())
    with TestClient(app) as client:
        response = client.post("/api/v1/ai/first-value/p3/analyze", json=valid_input(), headers={"X-Internal-Token": "test-internal"})
    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "P3_PROCESSOR_TIMEOUT"
