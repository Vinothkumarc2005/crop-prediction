"""
Auth routes — port of Java AuthController.java.

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
"""
from fastapi import APIRouter, Depends
from typing import Annotated

import psycopg

from app.core.dependencies import CurrentUser, DbConn
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(req: RegisterRequest, conn: DbConn) -> AuthResponse:
    """Register a new user account."""
    return auth_service.register(conn, req)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, conn: DbConn) -> AuthResponse:
    """Authenticate and receive a JWT."""
    return auth_service.login(conn, req)


@router.get("/me", response_model=AuthResponse)
def me(user: CurrentUser, conn: DbConn) -> AuthResponse:
    """Return current authenticated user's profile."""
    return auth_service.get_me(conn, user["email"])
