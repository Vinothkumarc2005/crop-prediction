"""
Schemas for weather history, forecast, and NDVI forecast responses.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


# ── Weather ────────────────────────────────────────────────────────────────────

class WeatherPoint(BaseModel):
    year:         int
    month:        int
    yearMonth:    str                    # "2024-06"
    rainfallMm:   float
    rainfallLow:  Optional[float] = None  # forecast confidence band
    rainfallHigh: Optional[float] = None
    tempMaxC:     float
    tempMinC:     float
    tempAvgC:     float
    tempAvgLow:   Optional[float] = None
    tempAvgHigh:  Optional[float] = None
    humidityPct:  float
    solarRadMj:   float
    isForecast:   bool = False


class WeatherSummary(BaseModel):
    avgRainfallMm:       float
    avgTempC:            float
    droughtRiskScore:    float         # 0–1
    droughtRiskLabel:    str           # LOW | MODERATE | HIGH | SEVERE
    rainfallAnomaly:     float         # 10-year trend change (mm)
    warmingTrendC:       float
    historicalYears:     int
    seasonRainfallTotal: float


class WeatherResponse(BaseModel):
    district:  str
    state:     str
    season:    str
    history:   list[WeatherPoint]
    forecast:  list[WeatherPoint]
    summary:   WeatherSummary


# ── NDVI Forecast ──────────────────────────────────────────────────────────────

class NdviPoint(BaseModel):
    date:       str           # ISO date string
    ndvi:       Optional[float]
    low:        Optional[float] = None   # confidence band lower bound
    high:       Optional[float] = None   # confidence band upper bound
    isForecast: bool = False


class NdviForecastResponse(BaseModel):
    fieldId:         str
    district:        Optional[str]
    historical:      list[NdviPoint]
    forecast:        list[NdviPoint]
    trend:           float             # slope (NDVI/day)
    residualStd:     float
    ndviForecast3m:  float             # projected NDVI at 3-month horizon
    healthAt3m:      str               # STRESSED | MODERATE | HEALTHY | VERY_HEALTHY
