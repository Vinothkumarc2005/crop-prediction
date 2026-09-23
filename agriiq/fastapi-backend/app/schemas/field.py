"""
Field Pydantic schemas — port of Java FieldDtos.java.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class CreateFieldRequest(BaseModel):
    name: str = Field(min_length=1)
    coordinates: list[list[float]]   # [[lng, lat], ...] polygon ring
    district: str | None = None
    state: str | None = None
    previousCrop: str | None = None
    prevPrevCrop: str | None = None

    model_config = {"populate_by_name": True}


class FieldResponse(BaseModel):
    id: uuid.UUID
    name: str
    coordinates: list[list[float]] | None = None
    areaHectares: Decimal | None = None
    district: str | None = None
    state: str | None = None
    previousCrop: str | None = None
    prevPrevCrop: str | None = None
    createdAt: str | None = None


class NdviPoint(BaseModel):
    date: date | str
    ndviMean: Decimal | None = None
    ndviMax: Decimal | None = None
    ndviMin: Decimal | None = None
    cloudCover: Decimal | None = None


class NdviStats(BaseModel):
    mean: Decimal | None = None
    peak: Decimal | None = None
    trend: Decimal | None = None
    percentVsDistrictAvg: Decimal | None = None
    healthStatus: str | None = None   # STRESSED | MODERATE | HEALTHY | VERY_HEALTHY


class NdviResponse(BaseModel):
    fieldId: uuid.UUID
    series: list[NdviPoint]
    stats: NdviStats


class SoilResponse(BaseModel):
    fieldId: uuid.UUID
    ph: Decimal | None = None
    nitrogen: Decimal | None = None
    phosphorus: Decimal | None = None
    potassium: Decimal | None = None
    organicCarbon: Decimal | None = None
    texture: str | None = None
    sandPct: Decimal | None = None
    siltPct: Decimal | None = None
    clayPct: Decimal | None = None
    source: str | None = None
    fetchedAt: str | None = None
