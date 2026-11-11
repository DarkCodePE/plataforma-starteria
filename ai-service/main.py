"""FastAPI entry point for the Starteria AI microservice."""

import logging
import os
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers.ai import router as ai_router

# Wire LangSmith tracing for langchain/langgraph runtime (must run before agent imports)
if settings.langsmith_tracing and settings.langsmith_api_key:
    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key
    os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("ai-service starting (env=%s)", settings.environment)
    # Eagerly initialize the orchestrator singleton so the first request is not slow
    from agents.orchestrator import get_orchestrator
    get_orchestrator()
    logger.info("ai-service orchestrator initialized")
    yield
    logger.info("ai-service shutting down")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Starteria AI Service",
    version="0.1.0",
    description="Multi-agent AI microservice for the Starteria innovation platform.",
    lifespan=lifespan,
)

# CORS — only internal traffic is expected; configure as needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Logging middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:  # type: ignore[type-arg]
    start = time.monotonic()
    response: Response = await call_next(request)
    latency_ms = int((time.monotonic() - start) * 1000)
    logger.info(
        "%s %s status=%d latency_ms=%d",
        request.method,
        request.url.path,
        response.status_code,
        latency_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(ai_router, prefix="/api/v1")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"])
async def health() -> dict[str, object]:
    source_sha = os.getenv("STARTERIA_RELEASE_SHA", "unknown").strip() or "unknown"
    if source_sha != "unknown" and not (
        len(source_sha) == 40 and all(char in "0123456789abcdef" for char in source_sha)
    ):
        source_sha = "invalid"
    return {
        "status": "ok",
        "service": "starteria-ai-service",
        "release": {
            "sourceSha": source_sha,
            "version": os.getenv("STARTERIA_RELEASE_VERSION", "0.1.0"),
        },
    }
