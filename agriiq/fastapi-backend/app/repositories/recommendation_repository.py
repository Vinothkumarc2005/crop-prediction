"""
RecommendationRepository — psycopg queries for the recommendations table.

The results column is JSONB, stored as a JSON string of crop recommendation objects.
"""
from __future__ import annotations

import json
import uuid
from typing import Any

import psycopg


def find_by_field_id_ordered(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Return recommendations for *field_id*, newest first."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, field_id, user_id, generated_at, season,
                   results, model_version
            FROM recommendations
            WHERE field_id = %s
            ORDER BY generated_at DESC
            LIMIT %s
            """,
            (str(field_id), limit),
        )
        return cur.fetchall()


def find_by_id(
    conn: psycopg.Connection,
    rec_id: str | uuid.UUID,
) -> dict[str, Any] | None:
    """Return a recommendation by primary key."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, field_id, user_id, generated_at, season,
                   results, model_version
            FROM recommendations
            WHERE id = %s
            """,
            (str(rec_id),),
        )
        return cur.fetchone()


def create_recommendation(
    conn: psycopg.Connection,
    *,
    field_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
    season: str,
    results: list[Any],  # list of crop recommendation dicts
    model_version: str = "lgbm-q-v1",
) -> dict[str, Any]:
    """
    Persist a recommendation and return the created row.

    *results* is serialised to JSON and stored in the JSONB column.
    """
    results_json = json.dumps(results)
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO recommendations (field_id, user_id, season, results, model_version)
            VALUES (%s, %s, %s, %s::jsonb, %s)
            RETURNING id, field_id, user_id, generated_at, season, results, model_version
            """,
            (str(field_id), str(user_id), season, results_json, model_version),
        )
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Failed to persist recommendation")
        return row
