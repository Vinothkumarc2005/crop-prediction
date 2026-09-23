"""
Security utilities: password hashing and JWT token management.

Replaces Spring's BCryptPasswordEncoder (strength 12) and jjwt library.

Password hashing  → passlib with bcrypt (rounds=12 matches Spring default)
JWT creation      → python-jose with HS256 (matches Spring jjwt config)
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
import bcrypt

from app.core.config import settings

logger = logging.getLogger(__name__)


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain* using 12 rounds (matches Spring BCryptPasswordEncoder(12))."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as exc:
        logger.warning("Password verification failed: %s", exc)
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    """
    Create a signed JWT token.

    :param subject: The token subject (user email, matching Spring's username).
    :param extra_claims: Optional additional claims to embed.
    :returns: Compact JWT string.
    """
    now = datetime.now(tz=timezone.utc)
    expire = now + timedelta(seconds=settings.jwt_expiration_seconds)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str:
    """
    Decode and validate a JWT token.

    :param token: The compact JWT string (without 'Bearer ' prefix).
    :returns: Subject (email) from the token.
    :raises ValueError: If the token is invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        subject: str | None = payload.get("sub")
        if subject is None:
            raise ValueError("Token has no subject claim")
        return subject
    except JWTError as exc:
        raise ValueError(f"Invalid or expired token: {exc}") from exc
