"""
Transaction context manager for psycopg v3.

Usage::

    with get_conn() as conn:
        with transaction(conn):
            user_repo.create_user(conn, ...)
            field_repo.create_field(conn, ...)
        # COMMIT happens here; ROLLBACK on exception

Nesting: psycopg3 supports savepoints for nested transactions via the
`conn.transaction()` context manager.  This module wraps that for
convenience and consistent error logging.
"""
import logging
from contextlib import contextmanager
from typing import Generator

import psycopg

logger = logging.getLogger(__name__)


@contextmanager
def transaction(conn: psycopg.Connection) -> Generator[None, None, None]:
    """
    Execute the body inside a database transaction.

    - On normal exit  → COMMIT
    - On any exception → ROLLBACK, re-raise
    """
    try:
        with conn.transaction():
            yield
    except Exception:
        logger.exception("Transaction rolled back due to exception")
        raise
