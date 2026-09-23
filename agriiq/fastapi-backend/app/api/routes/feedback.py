"""
Feedback routes — port of Java FeedbackController.java.

POST /api/feedback
GET  /api/feedback/field/{fieldId}
GET  /api/feedback/summary/{fieldId}
"""
import uuid

from fastapi import APIRouter

from app.core.dependencies import CurrentUser, DbConn
from app.schemas.feedback import FeedbackRecord, FeedbackSummary, LogFeedbackRequest
from app.services import feedback_service

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post("", response_model=FeedbackRecord, status_code=201)
def log_feedback(req: LogFeedbackRequest, user: CurrentUser, conn: DbConn) -> FeedbackRecord:
    """Log actual harvest feedback for model accuracy tracking."""
    return feedback_service.log_feedback(conn, req, user)


@router.get("/field/{field_id}", response_model=list[FeedbackRecord])
def get_by_field(field_id: uuid.UUID, user: CurrentUser, conn: DbConn) -> list[FeedbackRecord]:
    """Return all feedback entries for a specific field."""
    return feedback_service.get_by_field(conn, field_id, user)


@router.get("/summary/{field_id}", response_model=FeedbackSummary)
def get_summary(field_id: uuid.UUID, user: CurrentUser, conn: DbConn) -> FeedbackSummary:
    """Return accuracy summary comparing predicted vs actual yields."""
    return feedback_service.get_summary(conn, field_id, user)
