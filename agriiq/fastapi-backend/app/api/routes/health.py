"""
Health check routes — port of Java HealthController.java.

GET /api/health   — detailed health with DB and ML model status
GET /ping         — lightweight liveness probe
"""
from fastapi import APIRouter, Request

from app.db.connection import get_conn

router = APIRouter(tags=["Health"])


@router.get("/health")
def health(request: Request) -> dict:
    """Return service health including database and ML model status."""
    # DB check
    db_status = "DOWN"
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        db_status = "UP"
    except Exception:
        db_status = "DOWN"

    # ML model check
    model = getattr(request.app.state, "model", None)
    model_status = "LOADED" if (model and model.is_trained) else "FALLBACK"

    return {
        "status":   "UP",
        "database": db_status,
        "model":    model_status,
        "version":  "2.0.0",
    }


@router.get("/ping")
def ping() -> dict:
    """Lightweight liveness probe — matches Spring /ping endpoint."""
    return {"status": "ok"}
