from typing import Any, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# POST /ai/invoke
# ---------------------------------------------------------------------------

class InvokeRequest(BaseModel):
    agentHint: str | None = Field(None, description="ID sugerido del agente a invocar")
    step: int = Field(..., ge=0, le=4, description="Numero de paso (0-4)")
    module: str | None = Field(None, description="ID del modulo (A, B, C, D)")
    action: str = Field(..., description="Accion: feedback, assist, generate")
    payload: dict[str, Any] = Field(..., description="Datos especificos del agente")
    # ADR-027: "baseline" = prompt-based routing (default, unchanged); "harness" = run the
    # methodology diagnostic pipeline first, then route. Default keeps existing callers intact.
    mode: Literal["baseline", "harness"] = Field(
        "baseline", description="Routing mode: baseline (default) or methodology harness."
    )
    confirmationResponse: dict[str, Any] | None = Field(
        None, description="ADR-027: a human's answer to a prior harness ConfirmationRequest."
    )


# ---------------------------------------------------------------------------
# POST /ai/diagnose  (ADR-027 — diagnostic-only, no step-agent call)
# ---------------------------------------------------------------------------

class DiagnoseRequest(BaseModel):
    """Input for the methodology harness diagnosis. The step is NOT required — the whole
    point is that the harness diagnoses which step/route the request needs."""

    originalInput: str = Field(..., min_length=1, max_length=8000, description="Intención o propuesta en texto libre.")
    projectId: str | None = Field(None, description="UUID del proyecto (para memoria/costos).")
    addedContext: list[str] | None = Field(None, description="Contexto adicional aportado por el usuario.")
    companyContext: dict[str, Any] | None = Field(None, description="Contexto de empresa (datos de referencia, no instrucciones).")


# ---------------------------------------------------------------------------
# POST /ai/mentor-virtual
# ---------------------------------------------------------------------------

class Step0Data(BaseModel):
    origen: str
    parteProceso: str
    impacto3meses: str
    respaldo: str
    descripcion: str
    quienImpacta: str
    siMinimo: str


class MentorVirtualRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    step0Data: Step0Data = Field(..., description="Datos de Step 0")


# ---------------------------------------------------------------------------
# POST /ai/feedback
# ---------------------------------------------------------------------------

class FeedbackRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    stepNumber: int = Field(..., ge=1, le=4, description="Numero de paso (1-4)")
    moduleId: str = Field(..., description="ID del modulo (A, B, C, D)")
    moduleData: dict[str, Any] = Field(..., description="Datos del modulo en formato JSON")


# ---------------------------------------------------------------------------
# POST /ai/research-assist
# ---------------------------------------------------------------------------

class ModuleAData(BaseModel):
    casoReal: str
    pasos: str
    quiebre: str
    consecuencia: str
    causaInmediata: str
    alcance: str


class ResearchAssistRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    moduleAData: ModuleAData = Field(..., description="Datos del modulo A (AS-IS)")


# ---------------------------------------------------------------------------
# POST /ai/hmw-generate
# ---------------------------------------------------------------------------

class HMWGenerateRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    synthesisData: dict[str, Any] = Field(..., description="Datos del modulo D de Step 1")


# ---------------------------------------------------------------------------
# POST /ai/ideate
# ---------------------------------------------------------------------------

class IdeateRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    hmw: str = Field(..., description="HMW seleccionado")
    context: dict[str, Any] = Field(..., description="Contexto adicional del proyecto")


# ---------------------------------------------------------------------------
# POST /ai/experiment-routes
# ---------------------------------------------------------------------------

class SelectedIdea(BaseModel):
    id: str
    title: str
    description: str


class ExperimentRoutesRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    selectedIdea: SelectedIdea = Field(..., description="Idea finalista")
    dvfScores: dict[str, Any] = Field(..., description="Puntuaciones DVF")


# ---------------------------------------------------------------------------
# POST /ai/prototype-suggest
# ---------------------------------------------------------------------------

class PrototypeSuggestRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    testCard: dict[str, Any] = Field(..., description="Datos del test card de Step 2 Modulo D")


# ---------------------------------------------------------------------------
# POST /ai/experiment-analyze
# ---------------------------------------------------------------------------

class ExperimentAnalyzeRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    runId: str = Field(..., description="ID de la ejecucion")
    metrics: dict[str, Any] = Field(..., description="Metricas del experimento")
    evidence: list[str] = Field(..., description="URLs o IDs de evidencia")


# ---------------------------------------------------------------------------
# POST /ai/narrative-build
# ---------------------------------------------------------------------------

class NarrativeBuildRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    audience: str = Field(..., description="Audiencia objetivo")


# ---------------------------------------------------------------------------
# POST /ai/narrative-feedback
# ---------------------------------------------------------------------------

class NarrativeFeedbackRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    slides: list[dict[str, Any]] = Field(..., description="Array de slides editados")
    notes: str = Field(..., description="Notas del participante")


# ---------------------------------------------------------------------------
# POST /ai/refine-field  (PRD-003 / ADR-006 / ADR-016 — public landing editor)
# ---------------------------------------------------------------------------

class RefineFieldRequest(BaseModel):
    field: str = Field(..., min_length=1, max_length=120, description="Id/etiqueta del campo a mejorar")
    currentValue: str = Field("", max_length=8000, description="Valor actual del campo (puede estar vacío)")
    draftContext: dict[str, Any] | None = Field(
        None, description="Contexto no-PII del borrador (tipo de reto, otros campos)"
    )


class ContextExtractRequest(BaseModel):
    sourceType: str = Field(..., description="WEBSITE, LINKEDIN or FILE")
    title: str | None = None
    url: str | None = None
    mimeType: str | None = None
    fileName: str | None = None
    cleanContent: str = Field(..., min_length=1, max_length=1_500_000)


class ContextExtractFileRequest(BaseModel):
    sourceType: str = Field("FILE")
    mimeType: str
    fileName: str
    fileBase64: str = Field(..., min_length=1)


class DeckFeedbackRequest(BaseModel):
    """Feedback IA del deck del Step 4: el PDF y el análisis confirmado de la iniciativa."""
    fileName: str = Field(..., min_length=1, max_length=255)
    fileBase64: str = Field(..., min_length=1)
    analysis: dict[str, Any] | None = Field(None, description="Outputs confirmados de Steps 0-3. Datos, no instrucciones.")


# ---------------------------------------------------------------------------
# POST /ai/initial-review  (ADR-025 / PRD §25 — revisión inicial guiada)
# ---------------------------------------------------------------------------

class InitialReviewRequest(BaseModel):
    originalInput: str = Field(..., min_length=1, max_length=8000, description="Propuesta original del participante")
    addedContext: list[str] | None = Field(None, description="Contexto adicional aportado en iteraciones previas")
    companyContext: dict[str, Any] | None = Field(
        None, description="Contexto de empresa ensamblado por el backend (initial-review.service). Datos, no instrucciones."
    )
    focusSection: str | None = Field(
        None, description="ADR-026 v2: refinar SOLO esta sección (understanding/challengeType/critique/improvedProposal). El backend hace el splice determinista."
    )
