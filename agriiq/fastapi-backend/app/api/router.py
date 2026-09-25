"""
API Router aggregator — includes all sub-routers under /api prefix.
"""
from fastapi import APIRouter

from app.api.routes import auth, fields, predictions, mandi, feedback, health, weather
from app.api.routes import location, fertilizer, profitability

router = APIRouter(prefix="/api")

router.include_router(auth.router)
router.include_router(fields.router)
router.include_router(predictions.router)
router.include_router(mandi.router)
router.include_router(feedback.router)
router.include_router(weather.router)
router.include_router(location.router)
router.include_router(fertilizer.router)
router.include_router(profitability.router)
# Health is mounted at /api/health and also /ping (at root level in main.py)
router.include_router(health.router)
