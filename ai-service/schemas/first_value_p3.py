"""Private wire contract for the First Value P3 processor."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class P3Initiative(StrictModel):
    itemId: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=4000)
    declaredOwnerMention: str | None = Field(default=None, max_length=300)
    declaredDependencies: list[str] = Field(default_factory=list, max_length=30)


class P3ClarificationAnswer(StrictModel):
    id: str = Field(min_length=1, max_length=120)
    affectedItemIds: list[str] = Field(min_length=1, max_length=100)
    answer: str = Field(min_length=1, max_length=2000)


class FirstValueP3Input(StrictModel):
    sessionId: str = Field(min_length=1, max_length=120)
    requestId: str = Field(min_length=1, max_length=120)
    p2Confirmed: bool
    goal: str = Field(min_length=1, max_length=4000)
    context: str | None = Field(default=None, max_length=4000)
    initiatives: list[P3Initiative] = Field(min_length=1, max_length=100)
    clarifications: list[P3ClarificationAnswer] = Field(default_factory=list, max_length=100)


class P3Relationship(StrictModel):
    itemId: str = Field(min_length=1, max_length=120)
    disposition: Literal["DIRECT_CONTRIBUTION", "NEEDS_CONTEXT", "POSSIBLE_OTHER_PRIORITY"]
    rationale: str = Field(min_length=1, max_length=1000)
    evidenceRefs: list[str] = Field(min_length=1, max_length=100)


class P3Clarification(StrictModel):
    id: str = Field(min_length=1, max_length=120)
    affectedItemIds: list[str] = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=1000)
    reason: str = Field(min_length=1, max_length=500)


class FirstValueP3ModelOutput(StrictModel):
    relationships: list[P3Relationship] = Field(max_length=100)
    clarifications: list[P3Clarification] = Field(max_length=100)
    summary: str = Field(min_length=1, max_length=2000)
