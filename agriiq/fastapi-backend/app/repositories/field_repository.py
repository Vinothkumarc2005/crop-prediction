"""
FieldRepository — direct psycopg queries for the fields table.

Uses PostGIS functions:
  - ST_GeomFromText / ST_SetSRID  for polygon insert
  - ST_AsGeoJSON                  for reading boundary as GeoJSON
  - ST_Area(ST_Transform(...))    for accurate area in hectares
"""
from __future__ import annotations

import json
import uuid
from typing import Any

import psycopg


def find_by_user_id(conn: psycopg.Connection, user_id: str | uuid.UUID) -> list[dict[str, Any]]:
    """Return all fields belonging to *user_id*, newest first."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                user_id,
                name,
                area_hectares,
                district,
                state,
                previous_crop,
                prev_prev_crop,
                created_at,
                ST_AsGeoJSON(boundary)::jsonb AS boundary_geojson
            FROM fields
            WHERE user_id = %s
            ORDER BY created_at DESC
            """,
            (str(user_id),),
        )
        return cur.fetchall()


def find_by_id_and_user_id(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
) -> dict[str, Any] | None:
    """Return the field if it exists and belongs to *user_id*, otherwise None."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                user_id,
                name,
                area_hectares,
                district,
                state,
                previous_crop,
                prev_prev_crop,
                created_at,
                ST_AsGeoJSON(boundary)::jsonb AS boundary_geojson
            FROM fields
            WHERE id = %s AND user_id = %s
            """,
            (str(field_id), str(user_id)),
        )
        return cur.fetchone()


def find_by_id(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
) -> dict[str, Any] | None:
    """Return the field row regardless of owner (internal use only)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                user_id,
                name,
                area_hectares,
                district,
                state,
                previous_crop,
                prev_prev_crop,
                created_at,
                ST_AsGeoJSON(boundary)::jsonb AS boundary_geojson
            FROM fields
            WHERE id = %s
            """,
            (str(field_id),),
        )
        return cur.fetchone()


def create_field(
    conn: psycopg.Connection,
    *,
    user_id: str | uuid.UUID,
    name: str,
    coordinates: list[list[float]],  # [[lng, lat], ...]
    district: str | None = None,
    state: str | None = None,
    previous_crop: str | None = None,
    prev_prev_crop: str | None = None,
) -> dict[str, Any]:
    """
    Insert a new field with a PostGIS polygon boundary.

    Area is computed accurately via ST_Area(ST_Transform(boundary, 3857))/10000
    which converts from metres² to hectares. This replaces the Spring Boot
    Java approximation (areaSqDegrees × 1239100).
    """
    # Build WKT polygon from coordinate list
    # Ensure ring is closed (first == last)
    coords = list(coordinates)
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    coord_str = ", ".join(f"{lng} {lat}" for lng, lat in coords)
    wkt = f"POLYGON(({coord_str}))"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO fields (
                user_id, name, boundary, area_hectares,
                district, state, previous_crop, prev_prev_crop
            )
            VALUES (
                %s, %s,
                ST_SetSRID(ST_GeomFromText(%s), 4326),
                ROUND(
                    (ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromText(%s), 4326), 3857)) / 10000.0)::NUMERIC,
                    4
                ),
                %s, %s, %s, %s
            )
            RETURNING
                id,
                user_id,
                name,
                area_hectares,
                district,
                state,
                previous_crop,
                prev_prev_crop,
                created_at,
                ST_AsGeoJSON(boundary)::jsonb AS boundary_geojson
            """,
            (str(user_id), name, wkt, wkt, district, state, previous_crop, prev_prev_crop),
        )
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Failed to create field — no row returned")
        return row


def delete_field(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
) -> None:
    """Delete the field (cascades to NDVI, soil, recommendations, feedback)."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM fields WHERE id = %s", (str(field_id),))
