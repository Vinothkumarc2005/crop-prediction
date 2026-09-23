"""
FeedbackService — port of Java FeedbackService.java.

Handles logging of actual harvest feedback and computing accuracy summaries.
"""
from __future__ import annotations

import logging
import uuid
from decimal import Decimal
from typing import Any

import psycopg

from app.repositories import feedback_repository
from app.schemas.feedback import FeedbackRecord, FeedbackSummary, LogFeedbackRequest

logger = logging.getLogger(__name__)


def log_feedback(
    conn: psycopg.Connection,
    req: LogFeedbackRequest,
    user: dict,
) -> FeedbackRecord:
    """Persist a feedback entry for actual harvest data."""
    row = feedback_repository.create_feedback(
        conn,
        field_id=str(req.fieldId),
        user_id=str(user["id"]),
        recommendation_id=str(req.recommendationId) if req.recommendationId else None,
        crop=req.crop,
        season=req.season,
        year=req.year,
        actual_yield_kg_ha=req.actualYieldKgHa,
        actual_revenue=req.actualRevenue,
        notes=req.notes,
    )
    conn.commit()
    logger.info("Feedback logged for field %s, crop=%s", req.fieldId, req.crop)
    return _map_feedback(row)


def get_by_field(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    user: dict,
) -> list[FeedbackRecord]:
    """Return all feedback entries for a field owned by user."""
    rows = feedback_repository.find_by_field_id_ordered(conn, str(field_id))
    return [_map_feedback(r) for r in rows]


def get_summary(
    conn: psycopg.Connection,
    field_id: str | uuid.UUID,
    user: dict,
) -> FeedbackSummary:
    """
    Compute a feedback summary for the field.
    Mirrors FeedbackService.getSummary().
    """
    rows = feedback_repository.find_by_field_id_ordered(conn, str(field_id))
    if not rows:
        return FeedbackSummary(fieldId=field_id, totalFeedbacks=0, crops=[])

    # Group by crop
    by_crop: dict[str, list] = {}
    for r in rows:
        by_crop.setdefault(r["crop"], []).append(r)

    crops_summary = []
    total_accuracy: list[float] = []

    for crop, entries in by_crop.items():
        actual_yields = [
            float(e["actual_yield_kg_ha"])
            for e in entries
            if e.get("actual_yield_kg_ha") is not None
        ]
        avg_yield = sum(actual_yields) / len(actual_yields) if actual_yields else None

        # Compute accuracy vs the most-recent recommendation p50
        rec_row = feedback_repository.find_latest_recommendation_for_field(conn, str(field_id))
        accuracy = None
        if rec_row and avg_yield is not None:
            results = rec_row.get("results") or []
            for cr in results:
                if cr.get("crop") == crop:
                    p50 = cr.get("yieldRange", {}).get("p50")
                    if p50 and p50 > 0:
                        accuracy = round(abs(avg_yield - p50) / p50 * 100, 2)
                        total_accuracy.append(100 - accuracy)
                    break

        crops_summary.append({
            "crop":          crop,
            "entries":       len(entries),
            "avgYieldKgHa":  round(avg_yield, 2) if avg_yield else None,
            "accuracy":      accuracy,  # % deviation from predicted p50
        })

    avg_overall_accuracy = (
        round(sum(total_accuracy) / len(total_accuracy), 2)
        if total_accuracy else None
    )

    return FeedbackSummary(
        fieldId=field_id,
        totalFeedbacks=len(rows),
        crops=crops_summary,
        averageYieldAccuracy=avg_overall_accuracy,
    )


def _map_feedback(row: dict) -> FeedbackRecord:
    return FeedbackRecord(
        id=row["id"],
        fieldId=row["field_id"],
        crop=row["crop"],
        season=row.get("season"),
        year=row.get("year"),
        actualYieldKgHa=row.get("actual_yield_kg_ha"),
        actualRevenue=row.get("actual_revenue"),
        notes=row.get("notes"),
        createdAt=str(row["created_at"]) if row.get("created_at") else None,
    )
