"""
Prediction Pydantic schemas — port of Java PredictionDtos.java.

Field names preserved exactly for frontend compatibility.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import AliasChoices, BaseModel, Field


class YieldPredictRequest(BaseModel):
    fieldId: uuid.UUID
    crop: str
    season: str = "Kharif"


class ProfitRange(BaseModel):
    minProfit: float
    medProfit: float
    maxProfit: float
    unit: str = "INR/ha"
    inputCost: float
    minRevenue: float
    medRevenue: float
    maxRevenue: float


class YieldRange(BaseModel):
    p10: float
    p50: float
    p90: float
    unit: str = "kg/ha"
    confidenceScore: float


class ExplanationFactor(BaseModel):
    feature: str
    label: str
    shapValue: float = Field(validation_alias=AliasChoices("shapValue", "shap_value"))
    direction: str
    description: str

    model_config = {"populate_by_name": True}


class YieldPredictResponse(BaseModel):
    fieldId: uuid.UUID
    crop: str
    season: str
    yieldRange: YieldRange
    profitRange: ProfitRange
    explanations: list[ExplanationFactor] = []
    modelVersion: str = "lgbm-q-v1"
    generatedAt: str


class CropRecommendation(BaseModel):
    crop: str
    rank: int
    yieldRange: YieldRange
    profitRange: ProfitRange
    confidenceScore: float
    riskLevel: str           # LOW | MEDIUM | HIGH
    riskReason: str | None = None
    explanations: list[ExplanationFactor] = []


class RecommendRequest(BaseModel):
    fieldId: uuid.UUID
    season: str = "Kharif"


class RecommendResponse(BaseModel):
    recommendationId: uuid.UUID
    fieldId: uuid.UUID
    generatedAt: str
    season: str
    crops: list[CropRecommendation]
    modelVersion: str = "lgbm-q-v1"
