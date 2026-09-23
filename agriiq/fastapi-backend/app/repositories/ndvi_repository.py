"""
NdviRepository — direct psycopg queries for the ndvi_readings table.
"""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import psycopg


def find_by_field_id_ordered(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    limit: int = 200,
) -> list[dict[str, Any]]:
    """Return NDVI readings for *field_id*, newest first."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                id, field_id, observed_date,
                ndvi_mean, ndvi_max, ndvi_min, ndvi_std,
                ndvi_trend, cloud_cover, source, created_at
            FROM ndvi_readings
            WHERE field_id = %s
            ORDER BY observed_date DESC
            LIMIT %s
            """,
            (str(field_id), limit),
        )
        return cur.fetchall()


def exists_by_field_and_date(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    observed_date: date,
) -> bool:
    """Return True if a reading already exists for this field/date."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM ndvi_readings
            WHERE field_id = %s AND observed_date = %s
            """,
            (str(field_id), observed_date),
        )
        return cur.fetchone() is not None


def bulk_insert(
    conn: psycopg.Connection,
    readings: list[dict[str, Any]],
) -> None:
    """
    Insert multiple NDVI readings in a single executemany call.

    Each item in *readings* must have:
      field_id, observed_date, ndvi_mean, ndvi_max, ndvi_min,
      ndvi_std, ndvi_trend, cloud_cover, source
    """
    if not readings:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO ndvi_readings
                (field_id, observed_date, ndvi_mean, ndvi_max, ndvi_min,
                 ndvi_std, ndvi_trend, cloud_cover, source)
            VALUES
                (%(field_id)s, %(observed_date)s, %(ndvi_mean)s, %(ndvi_max)s,
                 %(ndvi_min)s, %(ndvi_std)s, %(ndvi_trend)s, %(cloud_cover)s,
                 %(source)s)
            ON CONFLICT (field_id, observed_date, source) DO NOTHING
            """,
            readings,
        )
