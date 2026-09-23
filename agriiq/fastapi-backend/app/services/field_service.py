"""
FieldService — port of Java FieldService.java.

Handles field CRUD, auto-populates NDVI and soil data on field creation,
and provides NDVI/soil response formatting.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime

import psycopg

from app.repositories import field_repository, ndvi_repository, soil_repository
from app.schemas.field import (
    CreateFieldRequest, FieldResponse, NdviPoint, NdviResponse, NdviStats, SoilResponse,
)
from app.services import ndvi_service, soil_service

logger = logging.getLogger(__name__)


def create_field(
    conn: psycopg.Connection,
    req: CreateFieldRequest,
    user: dict,
) -> FieldResponse:
    """
    Create a new field and trigger NDVI + soil data population.
    Mirrors FieldService.createField().
    """
    field = field_repository.create_field(
        conn,
        user_id=str(user["id"]),
        name=req.name,
        coordinates=req.coordinates,
        district=req.district,
        state=req.state,
        previous_crop=req.previousCrop,
        prev_prev_crop=req.prevPrevCrop,
    )
    conn.commit()

    # Populate NDVI and soil data (same order as Java FieldService)
    ndvi_service.fetch_and_store_ndvi(conn, field["id"], field.get("district"), field.get("state"))
    soil_service.fetch_and_store_soil(conn, field["id"], field.get("district"), field.get("state"))
    conn.commit()

    logger.info("Field created: %s (user=%s)", field["id"], user["email"])
    return _map_field_response(field)


def list_fields(conn: psycopg.Connection, user: dict) -> list[FieldResponse]:
    """Return all fields for the current user."""
    rows = field_repository.find_by_user_id(conn, str(user["id"]))
    return [_map_field_response(r) for r in rows]


def get_field(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    user: dict,
) -> FieldResponse:
    """Return a single field, enforcing ownership."""
    row = field_repository.find_by_id_and_user_id(conn, str(field_id), str(user["id"]))
    if row is None:
        raise KeyError(f"Field '{field_id}'")
    return _map_field_response(row)


def get_ndvi(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    user: dict,
) -> NdviResponse:
    """Return NDVI time-series for a field owned by user."""
    _assert_ownership(conn, field_id, user)
    readings = ndvi_repository.find_by_field_id_ordered(conn, str(field_id))

    series = [
        NdviPoint(
            date=r["observed_date"].isoformat() if hasattr(r["observed_date"], "isoformat") else str(r["observed_date"]),
            ndviMean=r.get("ndvi_mean"),
            ndviMax=r.get("ndvi_max"),
            ndviMin=r.get("ndvi_min"),
            cloudCover=r.get("cloud_cover"),
        )
        for r in readings
    ]

    raw_stats = ndvi_service.compute_ndvi_stats(readings)
    stats = NdviStats(
        mean=raw_stats.get("mean"),
        peak=raw_stats.get("peak"),
        trend=raw_stats.get("trend"),
        healthStatus=raw_stats.get("healthStatus"),
    )

    return NdviResponse(fieldId=field_id, series=series, stats=stats)


def get_soil(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    user: dict,
) -> SoilResponse:
    """Return the most recent soil profile for a field owned by user."""
    _assert_ownership(conn, field_id, user)
    row = soil_repository.find_latest_by_field_id(conn, str(field_id))
    if row is None:
        raise KeyError(f"Soil data for field '{field_id}'")

    return SoilResponse(
        fieldId=field_id,
        ph=row.get("ph"),
        nitrogen=row.get("nitrogen"),
        phosphorus=row.get("phosphorus"),
        potassium=row.get("potassium"),
        organicCarbon=row.get("organic_carbon"),
        texture=row.get("texture"),
        sandPct=row.get("sand_pct"),
        siltPct=row.get("silt_pct"),
        clayPct=row.get("clay_pct"),
        source=row.get("source"),
        fetchedAt=str(row["fetched_at"]) if row.get("fetched_at") else None,
    )


def get_history(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    user: dict,
) -> list[dict]:
    """
    Return historical yield data for the field's district.
    Mirrors FieldService.getFieldHistory().
    """
    row = field_repository.find_by_id_and_user_id(conn, str(field_id), str(user["id"]))
    if row is None:
        raise KeyError(f"Field '{field_id}'")

    district = row.get("district")
    state = row.get("state")
    if not district:
        return []

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT district, state, crop, season, year, yield_kg_ha, area_ha, production
            FROM yield_history
            WHERE LOWER(district) = LOWER(%s)
              AND (state IS NULL OR LOWER(state) = LOWER(%s))
            ORDER BY year DESC, crop
            """,
            (district, state or ""),
        )
        rows = cur.fetchall()

    return [
        {
            "crop":        r["crop"],
            "season":      r["season"],
            "year":        r["year"],
            "yieldKgHa":   float(r["yield_kg_ha"]) if r.get("yield_kg_ha") else None,
            "areaHa":      float(r["area_ha"]) if r.get("area_ha") else None,
        }
        for r in rows
    ]


def delete_field(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    user: dict,
) -> None:
    """Delete a field, enforcing ownership."""
    row = field_repository.find_by_id_and_user_id(conn, str(field_id), str(user["id"]))
    if row is None:
        raise KeyError(f"Field '{field_id}'")
    field_repository.delete_field(conn, str(field_id))
    conn.commit()
    logger.info("Field deleted: %s", field_id)


# ── Private helpers ────────────────────────────────────────────────────────────

def _assert_ownership(conn: psycopg.Connection, field_id, user: dict) -> None:
    row = field_repository.find_by_id_and_user_id(conn, str(field_id), str(user["id"]))
    if row is None:
        raise KeyError(f"Field '{field_id}'")


def _map_field_response(row: dict) -> FieldResponse:
    geojson = row.get("boundary_geojson")
    coords: list | None = None
    if geojson and isinstance(geojson, dict):
        coords = geojson.get("coordinates", [[]])[0]  # outer ring of polygon

    return FieldResponse(
        id=row["id"],
        name=row["name"],
        coordinates=coords,
        areaHectares=row.get("area_hectares"),
        district=row.get("district"),
        state=row.get("state"),
        previousCrop=row.get("previous_crop"),
        prevPrevCrop=row.get("prev_prev_crop"),
        createdAt=str(row["created_at"]) if row.get("created_at") else None,
    )
