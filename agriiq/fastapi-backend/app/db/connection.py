"""
PostgreSQL connection pool using psycopg (v3) + psycopg_pool.

The pool is initialised once at application startup (lifespan) and
closed cleanly on shutdown. All database interactions must go through
`get_conn()` which checks out a connection and returns it to the pool.
"""
import logging
from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg_pool import ConnectionPool

from app.core.config import settings

logger = logging.getLogger(__name__)

# Module-level pool reference — populated by init_pool() at startup.
_pool: ConnectionPool | None = None


def init_pool() -> None:
    """Create the connection pool. Call once at application startup."""
    global _pool
    logger.info("Initialising PostgreSQL connection pool…")
    _pool = ConnectionPool(
        conninfo=settings.database_url,
        min_size=2,
        max_size=10,
        open=True,
        kwargs={
            "autocommit": False,
            "row_factory": psycopg.rows.dict_row,
        },
    )
    # Verify connectivity
    with _pool.connection() as conn:
        conn.execute("SELECT 1")
    logger.info("PostgreSQL connection pool ready.")


def close_pool() -> None:
    """Close the connection pool. Call at application shutdown."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed.")


@contextmanager
def get_conn() -> Generator[psycopg.Connection, None, None]:
    """
    Context manager that checks out a connection from the pool.

    Usage::

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")

    The connection is automatically returned to the pool when the
    context exits (whether normally or via exception).
    Transactions are NOT automatically committed — callers must commit
    explicitly or use the `transaction()` helper.
    """
    if _pool is None:
        raise RuntimeError("Database pool not initialised. Call init_pool() first.")
    with _pool.connection() as conn:
        yield conn


def get_db() -> Generator[psycopg.Connection, None, None]:
    """
    FastAPI dependency that yields a single connection per request.

    Designed for use with `Depends(get_db)` in route functions.
    """
    with get_conn() as conn:
        yield conn
