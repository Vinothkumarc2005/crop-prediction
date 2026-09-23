"""
Feedback Pydantic schemas.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel, Field


class LogFeedbackRequest(BaseModel):
    fieldId: uuid.UUID
    recommendationId: uuid.UUID | None = None
    crop: str
    season: str | None = None
    year: int | None = None
    actualYieldKgHa: Decimal | None = None
    actualRevenue: Decimal | None = None
    notes: str | None = None


class FeedbackRecord(BaseModel):
    id: uuid.UUID
    fieldId: uuid.UUID
    crop: str
    season: str | None = None
    year: int | None = None
    actualYieldKgHa: Decimal | None = None
    actualRevenue: Decimal | None = None
    notes: str | None = None
    createdAt: str | None = None


class FeedbackSummary(BaseModel):
    fieldId: uuid.UUID
    totalFeedbacks: int
    crops: list[dict]
    averageYieldAccuracy: float | None = None
