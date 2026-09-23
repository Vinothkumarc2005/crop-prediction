"""
FeedbackRepository — psycopg queries for the feedback table.
"""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import psycopg


def find_by_field_id_ordered(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
) -> list[dict[str, Any]]:
    """Return feedback entries for *field_id*, newest first."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                f.id, f.field_id, f.user_id, f.recommendation_id,
                f.crop, f.season, f.year,
                f.actual_yield_kg_ha, f.actual_revenue, f.notes, f.created_at,
                r.results AS recommendation_results
            FROM feedback f
            LEFT JOIN recommendations r ON r.id = f.recommendation_id
            WHERE f.field_id = %s
            ORDER BY f.created_at DESC
            """,
            (str(field_id),),
        )
        return cur.fetchall()


def create_feedback(
    conn: psycopg.Connection,
    *,
    field_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
    recommendation_id: str | uuid.UUID | None,
    crop: str,
    season: str | None,
    year: int | None,
    actual_yield_kg_ha: Decimal | float | None,
    actual_revenue: Decimal | float | None,
    notes: str | None,
) -> dict[str, Any]:
    """Insert a feedback record and return the created row."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO feedback
                (field_id, user_id, recommendation_id, crop, season, year,
                 actual_yield_kg_ha, actual_revenue, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING
                id, field_id, user_id, recommendation_id,
                crop, season, year, actual_yield_kg_ha, actual_revenue,
                notes, created_at
            """,
            (
                str(field_id),
                str(user_id),
                str(recommendation_id) if recommendation_id else None,
                crop,
                season,
                year,
                actual_yield_kg_ha,
                actual_revenue,
                notes,
            ),
        )
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Failed to create feedback")
        return row


def find_latest_recommendation_for_field(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
) -> dict[str, Any] | None:
    """Return the most recent recommendation for *field_id*."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, results
            FROM recommendations
            WHERE field_id = %s
            ORDER BY generated_at DESC
            LIMIT 1
            """,
            (str(field_id),),
        )
        return cur.fetchone()
