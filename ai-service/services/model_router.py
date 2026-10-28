"""Model selection and per-model cost estimation.

Single source of truth for which model an agent runs on and what it costs. Prices are
keyed by MODEL, not by agent: pricing every call at one model's rate was wrong in both
directions, and `agents/initial_reviewer.py:34-37` measured how wrong — on the real
json_schema workload, qwen3.6-flash cost $0.003-0.005/call (and failed 0/3) while
deepseek-v4-flash cost $0.0004/call (3/3 ok).

Unknown price returns ``None``, never a stand-in rate. "Unpriced" and "free" are different
claims, and a budget enforced on a fabricated number is worse than one that admits a gap.

NOTE: `agents/pdf_extractor/extractor.py` keeps its own OPENROUTER_MODEL_PRICING dict
(public API, re-exported). The deepseek-chat rates below are the same figures; unifying
the two tables is a separate change with its own blast radius.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Default model for agents whose id is not registered below.
MODEL_ID = "openrouter:qwen/qwen3.6-flash"

# Back-compat: the qwen per-1k rates this module used to apply to every call.
_INPUT_COST_PER_1K = 0.00025
_OUTPUT_COST_PER_1K = 0.0015


@dataclass(frozen=True)
class ModelPrice:
    """Per-million-token USD rates for one model.

    ``input_per_1m``/``output_per_1m`` are what a call is billed at TODAY, promotions
    included. ``list_*`` records the undiscounted rate so a promo ending does not silently
    invalidate every cost figure. ``per_call_usd`` is an escape hatch for models we have
    measured end-to-end but have no published per-token rate for; it does not scale with
    token count and says so.
    """

    input_per_1m: float | None = None
    output_per_1m: float | None = None
    list_input_per_1m: float | None = None
    list_output_per_1m: float | None = None
    per_call_usd: float | None = None
    status: str = "candidate"  # "in_use" | "candidate"
    source: str = ""

    @property
    def basis(self) -> str:
        """How a cost for this model can be computed at all."""
        if self.input_per_1m is not None and self.output_per_1m is not None:
            return "per_token"
        if self.per_call_usd is not None:
            return "per_call"
        return "unknown"


MODEL_PRICING: dict[str, ModelPrice] = {
    # --- in production use ---
    "qwen/qwen3.6-flash": ModelPrice(
        input_per_1m=0.25, output_per_1m=1.50, status="in_use",
        source="OpenRouter list price (<=256K context), carried over from this module's "
               "previous constants.",
    ),
    "deepseek/deepseek-chat": ModelPrice(
        input_per_1m=0.14, output_per_1m=0.28, status="in_use",
        source="OpenRouter as of 2026-05; mirrors OPENROUTER_MODEL_PRICING in pdf_extractor.",
    ),
    "deepseek/deepseek-v4-flash": ModelPrice(
        per_call_usd=0.0004, status="in_use",
        source="No per-token rate on file. $0.0004/call measured in agents/initial_reviewer.py"
               " benchmark 2026-07-12 (n=3, real json_schema, 3/3 ok, 15-17s). Token-independent:"
               " treat as an order of magnitude, not a rate.",
    ),
    "jev-latest": ModelPrice(
        input_per_1m=0.042, output_per_1m=0.0, status="in_use",
        source="TypeSafe public launch price, 2026-09-20: "
               "https://typesafe.ai/blog/introducing-system-one-models-and-jev "
               "($0.042/M input tokens; output free). Recheck before relying on budgets.",
    ),
    "deepseek/deepseek-v4.1-flash": ModelPrice(
        input_per_1m=0.13, output_per_1m=0.52,
        source="OpenRouter 2026-09-10. Newer generation of the family already trusted for "
               "json_schema (v4-flash). Cheaper than the qwen baseline on BOTH axes "
               "(0.52x in, 0.35x out), scores 39 on Artificial Analysis vs 36 for V4 Pro, "
               "1M context, multi-provider (Exacto mode targets tool-calling accuracy). "
               "NOT yet benchmarked on our json_schema workload — different model id from "
               "deepseek-v4-flash, so reliability is NOT inherited.",
    ),
    # --- catalog candidates, not wired to any agent ---
    "prism-ml/ternary-bonsai-2-27b": ModelPrice(
        input_per_1m=0.075, output_per_1m=0.50,
        source="OpenRouter 2026-09. Single provider (Darkbloom), 7 tps, thinks by default at"
               " xhigh effort — cheap per token, likely expensive per task and far too slow"
               " for the request path.",
    ),
    "z-ai/glm-5.3-flashx": ModelPrice(
        input_per_1m=0.37, output_per_1m=1.25,
        source="OpenRouter 2026-09. NOT the same SKU as GLM-5.3-Flash, which is what the"
               " Artificial Analysis index scores (42).",
    ),
    "google/gemini-3.8-flash": ModelPrice(
        input_per_1m=0.75, output_per_1m=3.75,
        list_input_per_1m=1.50, list_output_per_1m=7.50,
        source="OpenRouter 2026-09, 50% promotional discount. At list price this is 6x the"
               " qwen baseline on input and 5x on output.",
    ),
    "z-ai/glm-5.3": ModelPrice(
        input_per_1m=0.8442, output_per_1m=2.653,
        list_input_per_1m=1.407, list_output_per_1m=4.422,
        source="OpenRouter 2026-09, 40% promotional discount. Reasoning always on, max effort"
               " by default — output tokens are not comparable to a non-reasoning model's.",
    ),
}


# agent_id -> model id. Mirrors the constants hardcoded in each agent module; the agent is
# still the source of truth, and tests/test_model_router.py asserts this table matches them
# so the two cannot drift apart silently.
AGENT_MODELS: dict[str, str] = {
    "orchestrator": "qwen/qwen3.6-flash",
    "mentor-virtual": "qwen/qwen3.6-flash",
    "solution-design": "qwen/qwen3.6-flash",
    "experiment-coach": "qwen/qwen3.6-flash",
    "feedback-ia": "qwen/qwen3.6-flash",
    "research-assistant": "qwen/qwen3.6-flash",
    "narrative-builder": "qwen/qwen3.6-flash",
    "field-refiner": "qwen/qwen3.6-flash",
    "pdf-extractor": "deepseek/deepseek-chat",
    "initial-reviewer": "deepseek/deepseek-v4-flash",
    "company-context": "deepseek/deepseek-v4-flash",
    # Harness GROUND/INTERPRET. The model itself lives in harness/config/methodology.yaml
    # (model.stage_model); this entry exists so cost lookups resolve for that agent_id.
    "methodology-harness": "deepseek/deepseek-v4-flash",
    # AI-01 QA: structured Step 0 reasoning. Per-call price is registered above,
    # which lets the endpoint reject a cost cap before invoking the provider.
    "step-reasoning-v1": "deepseek/deepseek-v4-flash",
}


def _strip_provider(model: str) -> str:
    """'openrouter:vendor/model' -> 'vendor/model'."""
    return model.split(":", 1)[1] if ":" in model else model


class ModelRouter:
    """Resolves the model for an agent and prices an invocation."""

    def get_model(self, agent_id: str) -> str:
        """Model id for this agent, or the default when the agent is not registered."""
        model = AGENT_MODELS.get(agent_id)
        if model is None:
            return MODEL_ID
        return f"openrouter:{model}"

    def price_for(self, model: str) -> ModelPrice | None:
        return MODEL_PRICING.get(_strip_provider(model))

    def pricing_basis(self, agent_id: str) -> str:
        """'per_token' | 'per_call' | 'unknown' for this agent's model."""
        price = self.price_for(self.get_model(agent_id))
        return price.basis if price else "unknown"

    def estimate_cost_usd(
        self,
        agent_id: str,
        input_tokens: int,
        output_tokens: int,
        *,
        model: str | None = None,
    ) -> float | None:
        """USD for one invocation, or ``None`` when the model has no price on file.

        Callers must handle ``None`` rather than coercing it to 0: an unpriced call is not
        a free call, and silently adding 0 to a budget under-counts it forever.
        """
        resolved = model or self.get_model(agent_id)
        price = self.price_for(resolved)
        if price is None:
            logger.warning("no price on file for model=%s (agent=%s)", resolved, agent_id)
            return None

        if price.basis == "per_token":
            cost = (input_tokens / 1_000_000 * price.input_per_1m) + (
                output_tokens / 1_000_000 * price.output_per_1m
            )
            return round(cost, 6)

        if price.basis == "per_call":
            # Token-independent by construction; see the model's `source`.
            return round(price.per_call_usd, 6)

        logger.warning("model=%s is registered but has no usable price basis", resolved)
        return None
