"""
Prediction routes — port of Java PredictionController.java.

POST /api/predict/yield
POST /api/recommend/crops
"""
from fastapi import APIRouter, Request

from app.core.dependencies import CurrentUser, DbConn
from app.schemas.prediction import (
    RecommendRequest,
    RecommendResponse,
    YieldPredictRequest,
    YieldPredictResponse,
)
from app.services import prediction_service

router = APIRouter(tags=["Predictions"])


@router.post("/predict/yield", response_model=YieldPredictResponse)
def predict_yield(req: YieldPredictRequest, user: CurrentUser, conn: DbConn, request: Request) -> YieldPredictResponse:
    """Predict yield (P10/P50/P90) for a specific crop on a specific field."""
    model = request.app.state.model
    return prediction_service.predict_yield(conn, model, req, user)


@router.post("/recommend/crops", response_model=RecommendResponse)
def recommend_crops(req: RecommendRequest, user: CurrentUser, conn: DbConn, request: Request) -> RecommendResponse:
    """Generate ranked crop recommendations for a field."""
    model = request.app.state.model
    return prediction_service.recommend_crops(conn, model, req.fieldId, req.season, user)
