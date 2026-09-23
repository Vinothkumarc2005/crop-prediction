"""
MockNdviService — Python port of Java MockNdviProvider.java.

Generates synthetic NDVI time-series for a field based on its
district/season context. The seasonal curve uses the same sin-based
formula as the original Java implementation.

This service is always used when NDVI_PROVIDER=mock (the default).
"""
from __future__ import annotations

import logging
import math
import random
import uuid
from datetime import date, timedelta
from decimal import Decimal

import psycopg

from app.core.config import settings
from app.repositories import ndvi_repository

logger = logging.getLogger(__name__)

# Days-of-year for season start/end (Northern Hemisphere Indian seasons)
# Kharif: Jun 15 → Oct 31 (peak ~Aug 15)
# Rabi:   Nov 01 → Mar 31 (peak ~Feb 01)
_KHARIF_PEAK_DOY = 227   # Aug 15
_RABI_PEAK_DOY   = 32    # Feb 01
_KHARIF_WIDTH    = 70    # half-width of the gaussian-like sin curve
_RABI_WIDTH      = 50


def fetch_and_store_ndvi(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    district: str | None,
    state: str | None,
) -> None:
    """
    Generate 90 days of NDVI readings (5-day intervals) and persist them.

    Matches Spring's FieldService.fetchNdviForField() — uses mock provider
    to populate initial readings when a field is first created.
    """
    if settings.ndvi_provider != "mock":
        logger.info("NDVI provider=%s — skipping mock NDVI generation.", settings.ndvi_provider)
        return

    today = date.today()
    readings = []
    for i in range(18):  # 18 × 5 = 90 days back
        obs_date = today - timedelta(days=i * 5)
        if ndvi_repository.exists_by_field_and_date(conn, field_id, obs_date):
            continue
        ndvi_mean = _compute_ndvi(obs_date, district)
        readings.append({
            "field_id":     str(field_id),
            "observed_date": obs_date,
            "ndvi_mean":    round(ndvi_mean, 4),
            "ndvi_max":     round(min(1.0, ndvi_mean + 0.08), 4),
            "ndvi_min":     round(max(-0.1, ndvi_mean - 0.10), 4),
            "ndvi_std":     round(abs(random.gauss(0.04, 0.01)), 4),
            "ndvi_trend":   round(random.gauss(0.0003, 0.0012), 5),
            "cloud_cover":  round(random.uniform(0, 20), 2),
            "source":       "mock",
        })
    ndvi_repository.bulk_insert(conn, readings)
    logger.debug("Stored %d NDVI readings for field %s", len(readings), field_id)


def _compute_ndvi(obs_date: date, district: str | None) -> float:
    """
    Compute synthetic NDVI for a given observation date using the same
    sin-based seasonal curve as MockNdviProvider.java.
    """
    doy = obs_date.timetuple().tm_yday

    # Determine primary season for the DOY
    if 166 <= doy <= 304:   # Jun 15 → Oct 31 — Kharif
        peak_doy = _KHARIF_PEAK_DOY
        width    = _KHARIF_WIDTH
        base     = 0.25
        amplitude = 0.45
    else:                    # Rabi
        rabi_doy = doy if doy >= 305 else doy + 365
        peak_doy = _RABI_PEAK_DOY + 365 if doy < 60 else _RABI_PEAK_DOY
        width    = _RABI_WIDTH
        base     = 0.20
        amplitude = 0.35

    dist_to_peak = abs(doy - peak_doy)
    ndvi = base + amplitude * math.exp(-(dist_to_peak ** 2) / (2 * width ** 2))

    # District-level baseline adjustment (matches Java map)
    district_offsets: dict[str, float] = {
        "nashik":    0.02,
        "amritsar":  0.05,
        "guntur":    0.03,
        "pune":     -0.02,
    }
    key = (district or "").lower()
    ndvi += district_offsets.get(key, 0.0)

    # Small random jitter
    ndvi += random.gauss(0, 0.015)
    return max(0.0, min(1.0, ndvi))


def compute_ndvi_stats(readings: list[dict]) -> dict:
    """
    Compute NDVI aggregate stats from a list of reading dicts.

    Matches the stats block returned by Java FieldService.getNdviStats().
    """
    if not readings:
        return {"mean": None, "peak": None, "trend": None, "healthStatus": "UNKNOWN"}

    means = [float(r["ndvi_mean"]) for r in readings if r.get("ndvi_mean") is not None]
    if not means:
        return {"mean": None, "peak": None, "trend": None, "healthStatus": "UNKNOWN"}

    avg = sum(means) / len(means)
    peak = max(means)
    trends = [float(r["ndvi_trend"]) for r in readings if r.get("ndvi_trend") is not None]
    trend = sum(trends) / len(trends) if trends else 0.0

    # Health status — matches Java FieldService.L221-225
    if avg < 0.2:
        health = "STRESSED"
    elif avg < 0.4:
        health = "MODERATE"
    elif avg < 0.6:
        health = "HEALTHY"
    else:
        health = "VERY_HEALTHY"

    return {
        "mean":  round(avg, 4),
        "peak":  round(peak, 4),
        "trend": round(trend, 5),
        "healthStatus": health,
    }
