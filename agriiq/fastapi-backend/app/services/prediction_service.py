"""
PredictionService — port of Java PredictionService.java.

Orchestrates yield prediction and crop recommendation:
  1. Load field + soil + NDVI data from DB
  2. Assemble feature vector
  3. Call model.predict() directly (NO HTTP — model is in-process)
  4. Apply profitability calculation
  5. Apply risk labelling + crop rotation penalty
  6. Persist recommendation to DB

Business constants and rules preserved verbatim from PredictionService.java.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg

from app.ml.yield_model import YieldModel
from app.repositories import (
    field_repository,
    ndvi_repository,
    recommendation_repository,
    soil_repository,
)
from app.schemas.prediction import (
    CropRecommendation,
    ExplanationFactor,
    ProfitRange,
    RecommendResponse,
    YieldPredictResponse,
    YieldPredictRequest,
    YieldRange,
)
from app.services import profitability_service, weather_service, ndvi_forecast_service

logger = logging.getLogger(__name__)

# Mirrors PredictionService.java constants
KHARIF_CROPS = ["Rice", "Maize", "Soybean", "Cotton", "Groundnut", "Tur (Arhar)"]
RABI_CROPS   = ["Wheat", "Gram"]

# Risk thresholds — matches PredictionService.java L244-253
_RISK_HIGH_THRESHOLD   = 0.30
_RISK_MEDIUM_THRESHOLD = 0.15


def recommend_crops(
    conn: psycopg.Connection,
    model: YieldModel,
    req_field_id: str | uuid.UUID,
    season: str,
    user: dict,
) -> RecommendResponse:
    """
    Generate ranked crop recommendations for a field.
    Mirrors PredictionService.recommendCrops().
    """
    field = field_repository.find_by_id_and_user_id(conn, str(req_field_id), str(user["id"]))
    if field is None:
        raise KeyError(f"Field '{req_field_id}'")

    features = _assemble_features(conn, field, season)
    crops = RABI_CROPS if "rabi" in season.lower() else KHARIF_CROPS

    raw_results = []
    for crop in crops:
        crop_features = {**features, "crop": crop, "season": season}
        ml_result = model.predict(crop_features)

        p10, p50, p90 = ml_result["p10"], ml_result["p50"], ml_result["p90"]
        safe_p50 = p50 if p50 > 0 else 1

        profit = profitability_service.compute_profit_range(
            conn,
            crop=crop,
            state=field.get("state"),
            season=season,
            district=field.get("district"),
            p10=p10, p50=p50, p90=p90,
        )

        yield_variance = (p90 - p10) / safe_p50
        risk_level, risk_reason = _compute_risk(
            crop=crop,
            previous_crop=field.get("previous_crop"),
            yield_variance=yield_variance,
        )

        raw_results.append({
            "crop":             crop,
            "p10":              p10,
            "p50":              p50,
            "p90":              p90,
            "confidence":       ml_result["confidence"],
            "explanations":     ml_result.get("explanations", []),
            "profit":           profit,
            "riskLevel":        risk_level,
            "riskReason":       risk_reason,
            "yieldVariance":    yield_variance,
        })

    # Sort by median profit descending (matches Spring's re-sort by medProfit)
    raw_results.sort(key=lambda x: x["profit"]["medProfit"], reverse=True)

    crops_out: list[CropRecommendation] = []
    for rank, r in enumerate(raw_results, start=1):
        crops_out.append(CropRecommendation(
            crop=r["crop"],
            rank=rank,
            yieldRange=YieldRange(
                p10=r["p10"], p50=r["p50"], p90=r["p90"],
                confidenceScore=r["confidence"],
            ),
            profitRange=ProfitRange(**r["profit"]),
            confidenceScore=r["confidence"],
            riskLevel=r["riskLevel"],
            riskReason=r["riskReason"],
            explanations=[ExplanationFactor(**e) for e in r["explanations"]],
        ))

    # Persist recommendation
    db_rec = recommendation_repository.create_recommendation(
        conn,
        field_id=str(req_field_id),
        user_id=str(user["id"]),
        season=season,
        results=[r.model_dump() for r in crops_out],
    )
    conn.commit()

    return RecommendResponse(
        recommendationId=db_rec["id"],
        fieldId=req_field_id,
        generatedAt=datetime.now(timezone.utc).isoformat(),
        season=season,
        crops=crops_out,
    )


def predict_yield(
    conn: psycopg.Connection,
    model: YieldModel,
    req: YieldPredictRequest,
    user: dict,
) -> YieldPredictResponse:
    """
    Predict yield for a specific crop on a specific field.
    Mirrors PredictionService.predictYield().
    """
    field = field_repository.find_by_id_and_user_id(conn, str(req.fieldId), str(user["id"]))
    if field is None:
        raise KeyError(f"Field '{req.fieldId}'")

    features = _assemble_features(conn, field, req.season)
    crop_features = {**features, "crop": req.crop, "season": req.season}
    ml_result = model.predict(crop_features)

    p10, p50, p90 = ml_result["p10"], ml_result["p50"], ml_result["p90"]
    profit = profitability_service.compute_profit_range(
        conn,
        crop=req.crop,
        state=field.get("state"),
        season=req.season,
        district=field.get("district"),
        p10=p10, p50=p50, p90=p90,
    )

    return YieldPredictResponse(
        fieldId=req.fieldId,
        crop=req.crop,
        season=req.season,
        yieldRange=YieldRange(
            p10=p10, p50=p50, p90=p90,
            confidenceScore=ml_result["confidence"],
        ),
        profitRange=ProfitRange(**profit),
        explanations=[ExplanationFactor(**e) for e in ml_result.get("explanations", [])],
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )


# ── Private helpers ────────────────────────────────────────────────────────────

def _assemble_features(conn: psycopg.Connection, field: dict, season: str) -> dict:
    """
    Pull NDVI + soil + weather + NDVI-forecast data for the field
    and assemble a feature dict.
    Matches PredictionService.assembleFeatures() — extended with weather signals.
    """
    # NDVI — use latest 6 readings for stats
    ndvi_readings = ndvi_repository.find_by_field_id_ordered(conn, str(field["id"]), limit=6)
    means = [float(r["ndvi_mean"]) for r in ndvi_readings if r.get("ndvi_mean")]
    peaks = [float(r["ndvi_max"]) for r in ndvi_readings if r.get("ndvi_max")]
    trends = [float(r["ndvi_trend"]) for r in ndvi_readings if r.get("ndvi_trend")]

    ndvi_mean  = sum(means)  / len(means)  if means  else 0.4
    ndvi_peak  = max(peaks)                if peaks  else 0.6
    ndvi_trend = sum(trends) / len(trends) if trends else 0.0

    # Soil
    soil = soil_repository.find_latest_by_field_id(conn, str(field["id"]))

    # Weather summary (10-year historical + drought risk)
    district = field.get("district")
    state    = field.get("state")
    try:
        weather_summary = weather_service.get_weather_summary(conn, district, state, season)
    except Exception as exc:
        logger.warning("Weather summary failed: %s", exc)
        weather_summary = {
            "avgRainfallMm": 400.0,
            "avgTempC": 28.0,
            "droughtRiskScore": 0.2,
            "seasonRainfallTotal": 2000.0,
        }

    # NDVI 3-month forecast
    try:
        ndvi_fc = ndvi_forecast_service.forecast_ndvi(
            conn, field["id"], district, months=3
        )
        ndvi_forecast_3m = ndvi_fc.get("ndviForecast3m", ndvi_mean)
    except Exception as exc:
        logger.warning("NDVI forecast failed: %s", exc)
        ndvi_forecast_3m = ndvi_mean

    return {
        "ndvi_mean":            ndvi_mean,
        "ndvi_peak":            ndvi_peak,
        "ndvi_trend":           ndvi_trend,
        "ph":                   float(soil["ph"])             if soil and soil.get("ph")             else 6.5,
        "nitrogen":             float(soil["nitrogen"])       if soil and soil.get("nitrogen")       else 180.0,
        "phosphorus":           float(soil["phosphorus"])     if soil and soil.get("phosphorus")     else 20.0,
        "potassium":            float(soil["potassium"])      if soil and soil.get("potassium")      else 200.0,
        "organic_carbon":       float(soil["organic_carbon"]) if soil and soil.get("organic_carbon") else 0.6,
        "texture":              soil["texture"]               if soil and soil.get("texture")         else "Loamy",
        "previous_crop":        field.get("previous_crop") or "",
        "prev_prev_crop":       field.get("prev_prev_crop") or "",
        "district":             district or "",
        "state":                state or "",
        "season":               season,
        # Weather signals (new)
        "rainfall_seasonal_mm": float(weather_summary.get("seasonRainfallTotal", 2000.0)),
        "temp_avg_c":           float(weather_summary.get("avgTempC", 28.0)),
        "drought_risk_score":   float(weather_summary.get("droughtRiskScore", 0.2)),
        "ndvi_forecast_3m":     float(ndvi_forecast_3m),
    }


def _compute_risk(
    crop: str,
    previous_crop: str | None,
    yield_variance: float,
) -> tuple[str, str | None]:
    """
    Compute risk level and reason.
    Mirrors PredictionService.java L244-253.
    """
    # Crop rotation penalty — same crop grown last season → HIGH risk
    if previous_crop and previous_crop.lower() == crop.lower():
        return "HIGH", f"Same crop ({crop}) grown last season — rotation penalty applies"

    if yield_variance > _RISK_HIGH_THRESHOLD:
        return "HIGH", "High yield uncertainty — consider weather insurance"
    if yield_variance > _RISK_MEDIUM_THRESHOLD:
        return "MEDIUM", "Moderate yield variability — standard agronomic precautions advised"
    return "LOW", None
