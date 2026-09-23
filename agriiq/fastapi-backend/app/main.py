"""
AgriIQ FastAPI Application — main entry point.

This replaces both:
  - Spring Boot backend (port 8080)
  - Separate FastAPI ML service (port 8000)

One process. One port (8000). No HTTP inter-service calls.

Startup sequence:
  1. Initialise psycopg connection pool
  2. Load (or train) the LightGBM yield model
  3. Register CORS middleware
  4. Mount all API routers

Shutdown sequence:
  1. Close connection pool cleanly
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router as api_router
from app.api.routes.health import router as health_router
from app.core.config import settings
from app.db.connection import close_pool, init_pool
from app.exceptions.handlers import register_exception_handlers
from app.ml.yield_model import YieldModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: startup → yield → shutdown."""
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("AgriIQ API starting up (v%s)…", settings.app_version)

    # Database pool
    init_pool()

    # ML model
    logger.info("Loading LightGBM yield model…")
    model = YieldModel()
    model.load_or_train()
    app.state.model = model
    logger.info("Startup complete. Model trained=%s", model.is_trained)

    yield  # ← application is running

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("Shutting down AgriIQ API…")
    close_pool()
    logger.info("Shutdown complete.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI Crop Recommendation & Yield Prediction Platform. "
            "Unified FastAPI backend consolidating Spring Boot + ML service."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Match Spring SecurityConfig CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception handlers ────────────────────────────────────────────────────
    register_exception_handlers(app)

    # ── Routers ───────────────────────────────────────────────────────────────
    # All API routes under /api prefix
    app.include_router(api_router)

    # Root-level /ping liveness probe (also accessible at /api/ping via api_router)
    app.include_router(health_router)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info",
    )
