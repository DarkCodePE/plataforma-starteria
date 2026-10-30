from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from agents.step_reasoning import StepReasoningOutput


def canned_output() -> StepReasoningOutput:
    return StepReasoningOutput(
        message="Entiendo el problema; todavía no asumiré la causa.",
        nextInteraction={"kind": "ask", "question": "¿Dónde aparece primero el retrabajo?"},
        known=["Existe retrabajo declarado por la persona."],
        unknown=["No hay frecuencia confirmada."],
        contradictions=[],
        suggestions=[{
            "field": "problemStatement",
            "proposedValue": "Retrabajo entre dos áreas.",
            "rationale": "Síntesis del mensaje.",
            "status": "UNREVIEWED",
            "sourceRefs": ["user.turn"],
        }],
        warnings=["La causa sigue siendo una hipótesis."],
        isReadyForHumanReview=False,
    )


@pytest.mark.unit
@pytest.mark.parametrize("step_number", [0, 1, 2, 3, 4])
def test_step_reasoning_returns_structured_non_authoritative_output(client: TestClient, monkeypatch, step_number: int) -> None:
    monkeypatch.setattr("routers.ai.reason_step_turn", lambda **_kwargs: (canned_output(), {
        "model": "openrouter:test/model",
        "promptVersion": "steps/reasoning/v0.1",
        "promptHash": "sha256:test",
        "tokensUsed": 42,
        "costUsd": 0.001,
        "latencyMs": 10,
    }))
    response = client.post("/api/v1/ai/steps/reason-turn", headers={"X-Cost-Cap-USD": "0.05"}, json={
        "projectId": "project-1",
        "cycleId": "cycle-1",
        "stepNumber": step_number,
        "sourceContextHash": "sha256:" + "a" * 64,
        "message": "No sé dónde medir todavía.",
        "history": [],
        "context": {"allowedOperations": ["reason", "suggest"]},
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["suggestions"][0]["status"] == "UNREVIEWED"
    assert body["isReadyForHumanReview"] is False
    assert "command" not in body
    assert body["model"] == "openrouter:test/model"


@pytest.mark.unit
@pytest.mark.parametrize("step_number", [-1, 5])
def test_step_reasoning_rejects_out_of_range_step(client: TestClient, step_number: int) -> None:
    response = client.post("/api/v1/ai/steps/reason-turn", json={
        "projectId": "project-1", "cycleId": "cycle-1", "stepNumber": step_number,
        "sourceContextHash": "sha256:" + "a" * 64,
        "message": "hola", "history": [], "context": {},
    })
    assert response.status_code == 422
