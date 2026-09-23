"""
NdviForecastService — project future NDVI values for a field.

Method:
  1. Fetch last 18 readings (up to 90 days) from ndvi_readings table
  2. Fit a linear trend over those readings (numpy polyfit)
  3. For each future week (up to 6 months), compute:
       forecast_ndvi = seasonal_base(date) + linear_trend_adjustment + district_offset
  4. Return list of weekly forecast points with ±1-std confidence band

The seasonal_base uses the exact same sin-curve as ndvi_service._compute_ndvi().
"""
from __future__ import annotations

import logging
import math
import uuid
from datetime import date, timedelta
from typing import Any

import psycopg

from app.repositories import ndvi_repository
from app.services.ndvi_service import _compute_ndvi  # reuse seasonal curve

logger = logging.getLogger(__name__)

_WEEKS_PER_MONTH = 4.33
_CONFIDENCE_DECAY = 0.04  # std grows 4% per week


def forecast_ndvi(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    district: str | None,
    months: int = 6,
) -> dict:
    """
    Forecast future NDVI for a field.

    Returns:
      {
        "historical": [{"date": ..., "ndvi": ..., "isForecast": false}, ...],
        "forecast":   [{"date": ..., "ndvi": ..., "low": ..., "high": ..., "isForecast": true}, ...],
        "trend": float,       # slope of historical trend (per day)
        "rmse": float,        # approx residual std used for confidence band
      }
    """
    # ── 1. Load historical readings ───────────────────────────────────────────
    readings = ndvi_repository.find_by_field_id_ordered(
        conn, str(field_id), limit=18
    )
    # Oldest first for trend fitting
    readings_sorted = sorted(readings, key=lambda r: r["observed_date"])

    historical = [
        {
            "date":       str(r["observed_date"]),
            "ndvi":       float(r["ndvi_mean"]) if r.get("ndvi_mean") is not None else None,
            "isForecast": False,
        }
        for r in readings_sorted
    ]

    # ── 2. Fit linear trend ───────────────────────────────────────────────────
    trend_slope = 0.0
    residual_std = 0.04  # default confidence width

    if len(readings_sorted) >= 3:
        means = [float(r["ndvi_mean"]) for r in readings_sorted if r.get("ndvi_mean") is not None]
        if len(means) >= 3:
            # Days relative to first reading
            xs = list(range(0, len(means) * 5, 5))[:len(means)]
            x_mean = sum(xs) / len(xs)
            y_mean = sum(means) / len(means)
            num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, means))
            den = sum((x - x_mean) ** 2 for x in xs) or 1e-9
            trend_slope = num / den  # NDVI / day

            # Residuals
            fitted = [y_mean + trend_slope * (x - x_mean) for x in xs]
            residuals = [m - f for m, f in zip(means, fitted)]
            residual_std = max(0.03, (sum(r ** 2 for r in residuals) / len(residuals)) ** 0.5)

    # ── 3. Generate forecast points (weekly for 6 months) ────────────────────
    today = date.today()
    last_hist_date = date.fromisoformat(historical[-1]["date"]) if historical else today
    last_hist_ndvi = historical[-1]["ndvi"] if historical else 0.4

    total_weeks = int(months * _WEEKS_PER_MONTH)
    forecast = []

    for week in range(1, total_weeks + 1):
        fdate = last_hist_date + timedelta(weeks=week)
        days_ahead = (fdate - last_hist_date).days

        # Seasonal base from existing curve
        seasonal = _compute_ndvi(fdate, district)

        # Trend adjustment (clamp to avoid runaway)
        trend_adj = max(-0.15, min(0.15, trend_slope * days_ahead))

        # Blend: 60% seasonal curve (more reliable long-term) + 40% trend-adjusted
        fc_ndvi = 0.6 * seasonal + 0.4 * (last_hist_ndvi + trend_adj)
        fc_ndvi = round(max(0.0, min(1.0, fc_ndvi)), 4)

        # Confidence band: widens with horizon
        week_std = residual_std + _CONFIDENCE_DECAY * week
        low  = round(max(0.0, fc_ndvi - week_std), 4)
        high = round(min(1.0, fc_ndvi + week_std), 4)

        forecast.append({
            "date":       str(fdate),
            "ndvi":       fc_ndvi,
            "low":        low,
            "high":       high,
            "isForecast": True,
        })

    # ── 4. Health status at 3-month horizon ──────────────────────────────────
    idx_3m = min(len(forecast) - 1, int(3 * _WEEKS_PER_MONTH) - 1)
    ndvi_3m = forecast[idx_3m]["ndvi"] if forecast else last_hist_ndvi

    return {
        "historical":     historical,
        "forecast":       forecast,
        "trend":          round(trend_slope, 6),
        "residualStd":    round(residual_std, 4),
        "ndviForecast3m": round(ndvi_3m, 4),
        "healthAt3m":     _health_label(ndvi_3m),
    }


def _health_label(ndvi: float) -> str:
    if ndvi < 0.2:
        return "STRESSED"
    if ndvi < 0.4:
        return "MODERATE"
    if ndvi < 0.6:
        return "HEALTHY"
    return "VERY_HEALTHY"
