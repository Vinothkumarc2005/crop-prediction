"""
AuthService — port of Spring Boot AuthService.java.

Handles user registration, login, and current-user lookup.
Uses bcrypt password hashing and JWT tokens (see app.core.security).
"""
from __future__ import annotations

import logging

import psycopg

from app.core.security import create_access_token, hash_password, verify_password
from app.repositories import user_repository
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest

logger = logging.getLogger(__name__)


def register(conn: psycopg.Connection, req: RegisterRequest) -> AuthResponse:
    """
    Register a new user.

    Raises ValueError if the email already exists (HTTP 400 via global handler).
    """
    if user_repository.exists_by_email(conn, req.email):
        raise ValueError(f"An account with email '{req.email}' already exists")

    hashed = hash_password(req.password)
    user = user_repository.create_user(
        conn,
        email=req.email,
        password_hash=hashed,
        full_name=req.full_name,
        phone=req.phone,
        role=req.role,
        language=req.language,
        district=req.district,
        state=req.state,
    )
    conn.commit()
    logger.info("New user registered: %s", req.email)

    token = create_access_token(subject=user["email"])
    return _build_response(user, token)


def login(conn: psycopg.Connection, req: LoginRequest) -> AuthResponse:
    """
    Authenticate a user and return a JWT.

    Raises ValueError for invalid credentials (HTTP 400 via global handler).
    """
    user = user_repository.find_by_email(conn, req.email)
    if user is None or not verify_password(req.password, user["password"]):
        raise ValueError("Invalid email or password")

    token = create_access_token(subject=user["email"])
    logger.info("User logged in: %s", req.email)
    return _build_response(user, token)


def get_me(conn: psycopg.Connection, email: str) -> AuthResponse:
    """
    Return the current user's profile.

    Raises KeyError (→ HTTP 404) if the user doesn't exist in the DB.
    """
    user = user_repository.find_by_email(conn, email)
    if user is None:
        raise KeyError(f"User '{email}'")
    token = create_access_token(subject=email)
    return _build_response(user, token)


def _build_response(user: dict, token: str) -> AuthResponse:
    return AuthResponse(
        token=token,
        email=user["email"],
        fullName=user["full_name"],
        role=user["role"],
        language=user["language"],
        userId=str(user["id"]),
    )
