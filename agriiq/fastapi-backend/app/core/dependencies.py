"""
FastAPI dependencies shared across routes.

get_db      — psycopg connection from pool (one per request)
get_current_user — validates Bearer token, returns user row dict
"""
import logging
from typing import Annotated, Generator

import psycopg
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_token
from app.db.connection import get_db
from app.repositories import user_repository

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)

# Type aliases for injection
DbConn = Annotated[psycopg.Connection, Depends(get_db)]


def get_current_user(
    conn: DbConn,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> dict:
    """
    Validate the Bearer JWT and return the authenticated user row.

    Raises 401 if the token is missing, invalid, or the user no longer exists.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        email = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = user_repository.find_by_email(conn, email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# Typed dependency aliases
CurrentUser = Annotated[dict, Depends(get_current_user)]
