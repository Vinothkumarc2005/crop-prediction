"""
SoilService — Python port of Java MockSoilProvider.java.

Generates synthetic soil profiles based on district and returns them.
Preserves the original DISTRICT_PROFILES dict and classify_texture logic.
"""
from __future__ import annotations

import logging
import random
import uuid

import psycopg

from app.core.config import settings
from app.repositories import soil_repository

logger = logging.getLogger(__name__)

# District-level soil baseline profiles — matches MockSoilProvider.java
_DISTRICT_PROFILES: dict[str, dict] = {
    "nashik": {
        "ph": 6.8, "nitrogen": 185, "phosphorus": 22, "potassium": 210,
        "organic_carbon": 0.65, "sand": 35, "silt": 38, "clay": 27,
    },
    "amritsar": {
        "ph": 7.2, "nitrogen": 260, "phosphorus": 35, "potassium": 310,
        "organic_carbon": 0.95, "sand": 30, "silt": 42, "clay": 28,
    },
    "guntur": {
        "ph": 7.0, "nitrogen": 175, "phosphorus": 18, "potassium": 190,
        "organic_carbon": 0.55, "sand": 40, "silt": 35, "clay": 25,
    },
    "pune": {
        "ph": 6.5, "nitrogen": 160, "phosphorus": 20, "potassium": 180,
        "organic_carbon": 0.60, "sand": 38, "silt": 36, "clay": 26,
    },
}

_DEFAULT_PROFILE: dict = {
    "ph": 6.8, "nitrogen": 180, "phosphorus": 20, "potassium": 200,
    "organic_carbon": 0.60, "sand": 37, "silt": 38, "clay": 25,
}


def fetch_and_store_soil(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    district: str | None,
    state: str | None,
) -> None:
    """
    Generate a mock soil profile and persist it.

    Matches Spring's FieldService.fetchSoilForField().
    """
    if settings.soil_provider != "mock":
        logger.info("Soil provider=%s — skipping mock soil generation.", settings.soil_provider)
        return

    key = (district or "").lower()
    base = _DISTRICT_PROFILES.get(key, _DEFAULT_PROFILE)

    def jitter(val: float, pct: float = 0.12) -> float:
        return val * (1 + random.gauss(0, pct))

    ph         = round(max(4.5, min(9.0, jitter(base["ph"], 0.06))), 2)
    nitrogen   = round(max(50, min(600, jitter(base["nitrogen"]))), 2)
    phosphorus = round(max(5,  min(80,  jitter(base["phosphorus"]))), 2)
    potassium  = round(max(50, min(500, jitter(base["potassium"]))), 2)
    org_carbon = round(max(0.1, min(3.0, jitter(base["organic_carbon"]))), 3)

    sand = max(10, min(80, jitter(base["sand"], 0.08)))
    silt = max(10, min(60, jitter(base["silt"], 0.08)))
    clay = max(5,  min(50, jitter(base["clay"], 0.08)))
    total = sand + silt + clay
    sand_pct = round(sand / total * 100, 2)
    silt_pct = round(silt / total * 100, 2)
    clay_pct = round(clay / total * 100, 2)

    texture = _classify_texture(sand_pct, silt_pct, clay_pct)
    bulk_density   = round(random.uniform(1.1, 1.6), 3)
    water_capacity = round(random.uniform(80, 200), 2)

    soil_repository.insert_profile(
        conn,
        field_id=field_id,
        ph=ph,
        nitrogen=nitrogen,
        phosphorus=phosphorus,
        potassium=potassium,
        organic_carbon=org_carbon,
        texture=texture,
        sand_pct=sand_pct,
        silt_pct=silt_pct,
        clay_pct=clay_pct,
        bulk_density=bulk_density,
        water_capacity=water_capacity,
        source="mock",
    )
    logger.debug("Stored mock soil profile for field %s", field_id)


def _classify_texture(sand: float, silt: float, clay: float) -> str:
    """
    Classify soil texture from fractions.
    Matches MockSoilProvider.classifyTexture() exactly.
    """
    if clay > 40:
        return "Clay"
    if sand > 70:
        return "Sandy"
    if silt > 50:
        return "Silty"
    if clay > 25 and sand < 45:
        return "Clay Loam"
    if sand > 55 and clay < 20:
        return "Sandy Loam"
    return "Loamy"
