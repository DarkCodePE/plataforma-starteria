"""Single-call structured Step 0-4 reasoning agent for CHAT-01 QA.

This module has no tools, memory, commands or Core writes. Express supplies an
already-authorized, actor-scoped context and persists the turn before invoking it.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from services.model_router import ModelRouter

AGENT_ID = "step-reasoning-v1"
PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "steps" / "reasoning" / "v0.1.json"
MAX_CONTEXT_CHARS = 40_000


class StepReasoningNextInteraction(BaseModel):
    kind: Literal["ask", "reflect", "summarize"]
    question: str = Field(..., min_length=1, max_length=2000)


class StepReasoningSuggestion(BaseModel):
    field: str = Field(..., min_length=1, max_length=120)
    proposedValue: str = Field(..., min_length=1, max_length=4000)
    rationale: str = Field(..., min_length=1, max_length=2000)
    status: Literal["UNREVIEWED"]
    sourceRefs: list[str] = Field(default_factory=list, max_length=12)


class StepReasoningOutput(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    nextInteraction: StepReasoningNextInteraction
    known: list[str] = Field(default_factory=list, max_length=12)
    unknown: list[str] = Field(default_factory=list, max_length=12)
    contradictions: list[str] = Field(default_factory=list, max_length=8)
    suggestions: list[StepReasoningSuggestion] = Field(default_factory=list, max_length=8)
    warnings: list[str] = Field(default_factory=list, max_length=8)
    isReadyForHumanReview: bool = False


def _manifest() -> dict[str, str]:
    raw = PROMPT_PATH.read_bytes()
    data = json.loads(raw)
    data["hash"] = f"sha256:{hashlib.sha256(raw).hexdigest()}"
    return data


def _model_name() -> str:
    routed = ModelRouter().get_model(AGENT_ID)
    return routed.split(":", 1)[1] if routed.startswith("openrouter:") else routed


def _build_llm() -> ChatOpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not set. Configure it only in the isolated QA environment.")
    return ChatOpenAI(
        base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        model=_model_name(),
        api_key=api_key,
        temperature=0.2,
        max_tokens=2200,
        max_retries=0,
        model_kwargs={"extra_body": {"provider": {"allow_fallbacks": True, "sort": "throughput"}}},
    )


@lru_cache(maxsize=1)
def _get_chain():
    manifest = _manifest()
    prompt = ChatPromptTemplate.from_messages([("system", manifest["system"]), ("human", manifest["human"])])
    return prompt | _build_llm().with_structured_output(StepReasoningOutput, method="json_schema", include_raw=True)


def minimum_cost_usd() -> float | None:
    return ModelRouter().estimate_cost_usd(AGENT_ID, 0, 0)


def reason_step_turn(*, context: dict[str, Any], history: list[dict[str, str]], message: str, mode: str) -> tuple[StepReasoningOutput, dict[str, Any]]:
    started = time.monotonic()
    context_json = json.dumps(context, ensure_ascii=False, sort_keys=True, default=str)[:MAX_CONTEXT_CHARS]
    history_json = json.dumps(history[-12:], ensure_ascii=False, default=str)[:24_000]
    result = _get_chain().invoke({"context": context_json, "history": history_json, "message": message[:8000], "mode": mode})
    parsed = result.get("parsed") if isinstance(result, dict) else result
    if not isinstance(parsed, StepReasoningOutput):
        parsed = StepReasoningOutput(**dict(parsed))
    raw = result.get("raw") if isinstance(result, dict) else None
    usage = getattr(raw, "usage_metadata", None) or {}
    tokens = usage.get("total_tokens")
    router = ModelRouter()
    model = router.get_model(AGENT_ID)
    cost = router.estimate_cost_usd(
        AGENT_ID,
        int(usage.get("input_tokens") or 0),
        int(usage.get("output_tokens") or 0),
        model=model,
    )
    manifest = _manifest()
    return parsed, {
        "model": model,
        "promptVersion": manifest["version"],
        "promptHash": manifest["hash"],
        "providerRunId": getattr(raw, "id", None),
        "tokensUsed": int(tokens) if tokens is not None else None,
        "costUsd": cost,
        "latencyMs": int((time.monotonic() - started) * 1000),
    }
