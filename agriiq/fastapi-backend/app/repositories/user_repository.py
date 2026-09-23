"""
UserRepository — direct psycopg queries for the users table.

All SQL uses parameterized placeholders (%s) to prevent SQL injection.
No ORM. No SQLAlchemy.
"""
from __future__ import annotations

import uuid
from typing import Any

import psycopg


def find_by_email(conn: psycopg.Connection, email: str) -> dict[str, Any] | None:
    """Return the user row for *email*, or None if not found."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, password, full_name, phone, role,
                   language, district, state, created_at, updated_at
            FROM users
            WHERE email = %s
            """,
            (email,),
        )
        return cur.fetchone()


def find_by_id(conn: psycopg.Connection, user_id: str | uuid.UUID) -> dict[str, Any] | None:
    """Return the user row for *user_id*, or None if not found."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, password, full_name, phone, role,
                   language, district, state, created_at, updated_at
            FROM users
            WHERE id = %s
            """,
            (str(user_id),),
        )
        return cur.fetchone()


def exists_by_email(conn: psycopg.Connection, email: str) -> bool:
    """Return True if a user with *email* already exists."""
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM users WHERE email = %s", (email,))
        return cur.fetchone() is not None


def create_user(
    conn: psycopg.Connection,
    *,
    email: str,
    password_hash: str,
    full_name: str,
    phone: str | None = None,
    role: str = "FARMER",
    language: str = "en",
    district: str | None = None,
    state: str | None = None,
) -> dict[str, Any]:
    """
    Insert a new user and return the created row.
    Caller is responsible for committing the transaction.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (email, password, full_name, phone, role, language, district, state)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, email, password, full_name, phone, role,
                      language, district, state, created_at, updated_at
            """,
            (email, password_hash, full_name, phone, role, language, district, state),
        )
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("Failed to create user — no row returned")
        return row
