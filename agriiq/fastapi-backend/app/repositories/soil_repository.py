"""
SoilRepository — direct psycopg queries for the soil_profiles table.
"""
from __future__ import annotations

import uuid
from typing import Any

import psycopg


def find_latest_by_field_id(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
) -> dict[str, Any] | None:
    """Return the most recent soil profile for *field_id*, or None."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id, field_id, ph, nitrogen, phosphorus, potassium,
                organic_carbon, texture, sand_pct, silt_pct, clay_pct,
                bulk_density, water_capacity, source, fetched_at
            FROM soil_profiles
            WHERE field_id = %s
            ORDER BY fetched_at DESC
            LIMIT 1
            """,
            (str(field_id),),
        )
        return cur.fetchone()


def insert_profile(
    conn: psycopg.Connection,
    *,
    field_id: str | uuid.UUID,
    ph: float,
    nitrogen: float,
    phosphorus: float,
    potassium: float,
    organic_carbon: float,
    texture: str,
    sand_pct: float,
    silt_pct: float,
    clay_pct: float,
    bulk_density: float,
    water_capacity: float,
    source: str = "mock",
) -> dict[str, Any]:
    """Insert a soil profile and return the created row."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO soil_profiles
                (field_id, ph, nitrogen, phosphorus, potassium,
                 organic_carbon, texture, sand_pct, silt_pct, clay_pct,
                 bulk_density, water_capacity, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (field_id, source) DO UPDATE SET
                ph             = EXCLUDED.ph,
                nitrogen       = EXCLUDED.nitrogen,
                phosphorus     = EXCLUDED.phosphorus,
                potassium      = EXCLUDED.potassium,
                organic_carbon = EXCLUDED.organic_carbon,
                texture        = EXCLUDED.texture,
                sand_pct       = EXCLUDED.sand_pct,
                silt_pct       = EXCLUDED.silt_pct,
                clay_pct       = EXCLUDED.clay_pct,
                bulk_density   = EXCLUDED.bulk_density,
                water_capacity = EXCLUDED.water_capacity,
                fetched_at     = now()
            RETURNING
                id, field_id, ph, nitrogen, phosphorus, potassium,
                organic_carbon, texture, sand_pct, silt_pct, clay_pct,
                bulk_density, water_capacity, source, fetched_at
            """,
            (
                str(field_id), ph, nitrogen, phosphorus, potassium,
                organic_carbon, texture, sand_pct, silt_pct, clay_pct,
                bulk_density, water_capacity, source,
            ),
        )
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Failed to insert soil profile")
        return row
