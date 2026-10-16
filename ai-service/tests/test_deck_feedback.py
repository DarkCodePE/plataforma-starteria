"""Feedback IA del deck (Step 4). El proveedor se reemplaza: ninguna llamada sale a OpenRouter."""

from __future__ import annotations

import base64

import pytest
from fastapi.testclient import TestClient

from agents import deck_feedback
from agents.deck_feedback import DeckFeedbackOutput, format_analysis, generate_deck_feedback
from agents.pdf_extractor.parser import PageBlock

pytestmark = pytest.mark.unit

PDF_B64 = base64.b64encode(b"%PDF-1.4 fake").decode()


class _FakeChain:
    def __init__(self) -> None:
        self.payloads: list[dict] = []

    def invoke(self, payload: dict) -> DeckFeedbackOutput:
        self.payloads.append(payload)
        return DeckFeedbackOutput(
            summary="El deck cuenta la decisión.",
            goodPoints=["Pedido claro"],
            unsupportedClaims=[{"claim": "Las ventas subieron 30%", "why": "El análisis registra 14%"}],
            nextAction="Corregir la cifra de ventas.",
        )


@pytest.fixture
def fake_chain(monkeypatch) -> _FakeChain:
    chain = _FakeChain()
    monkeypatch.setattr(deck_feedback, "_get_chain", lambda: chain)
    monkeypatch.setattr(
        deck_feedback,
        "parse_pdf_bytes",
        lambda data, name: [PageBlock(page=1, text="Ventas +30%", char_count=11), PageBlock(page=2, text="", char_count=0)],
    )
    return chain


def test_the_deck_is_read_against_the_real_analysis(fake_chain: _FakeChain) -> None:
    result = generate_deck_feedback(b"%PDF", "cierre.pdf", {"step3": {"decision": "escalar", "resultado": "ventas +14%"}})
    payload = fake_chain.payloads[0]
    assert "ventas +14%" in payload["analysis"]
    assert "[página 1]\nVentas +30%" in payload["deck"]
    assert payload["pages"] == 2
    assert result["unsupportedClaims"][0]["claim"] == "Las ventas subieron 30%"
    assert result["pages"] == 2 and result["deckTruncated"] is False


def test_without_confirmed_steps_the_prompt_says_so() -> None:
    assert format_analysis(None) == "(la iniciativa no tiene pasos confirmados)"


def test_a_deck_without_text_is_not_sent_empty(monkeypatch, fake_chain: _FakeChain) -> None:
    monkeypatch.setattr(deck_feedback, "parse_pdf_bytes", lambda data, name: [PageBlock(page=1, text="", char_count=0)])
    generate_deck_feedback(b"%PDF", "fotos.pdf", None)
    assert fake_chain.payloads[0]["deck"] == "(el PDF no tiene texto extraíble)"


def test_endpoint_returns_the_feedback(client: TestClient, fake_chain: _FakeChain) -> None:
    res = client.post("/api/v1/ai/deck-feedback", json={"fileName": "cierre.pdf", "fileBase64": PDF_B64, "analysis": {"step3": {}}})
    assert res.status_code == 200
    body = res.json()
    assert body["nextAction"] == "Corregir la cifra de ventas."
    assert body["model"]


def test_endpoint_rejects_invalid_base64(client: TestClient) -> None:
    res = client.post("/api/v1/ai/deck-feedback", json={"fileName": "x.pdf", "fileBase64": "no es base64!!"})
    assert res.status_code == 422


def test_provider_failure_is_503(client: TestClient, monkeypatch) -> None:
    def boom(*_args, **_kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr("routers.ai.generate_deck_feedback", boom)
    res = client.post("/api/v1/ai/deck-feedback", json={"fileName": "x.pdf", "fileBase64": PDF_B64})
    assert res.status_code == 503


def test_endpoint_requires_the_internal_token(client: TestClient, monkeypatch, fake_chain: _FakeChain) -> None:
    monkeypatch.setenv("AI_SERVICE_INTERNAL_TOKEN", "secreto")
    res = client.post("/api/v1/ai/deck-feedback", json={"fileName": "x.pdf", "fileBase64": PDF_B64})
    assert res.status_code == 401
