"""
Pytest configuration and shared fixtures.
"""
import os
import pytest
from contextlib import asynccontextmanager
from unittest.mock import MagicMock, patch

# Set test environment before importing app modules
os.environ["DATABASE_URL"] = "postgresql://agriiq:agriiq_secret@localhost:5432/agriiq"
os.environ["JWT_SECRET"] = "test_secret_key_at_least_32_characters_long_for_tests"
os.environ["MODEL_DIR"] = "/tmp/agriiq_test_models"

from fastapi.testclient import TestClient
from app.main import app
from app.db.connection import get_db
from app.core.security import create_access_token


@pytest.fixture(scope="session")
def mock_db_conn():
    """Create a mock database connection and cursor."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.__enter__ = lambda s: s
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn


@pytest.fixture(scope="session")
def client(mock_db_conn):
    """Test client with mocked DB dependency and mocked lifespan."""
    def override_get_db():
        yield mock_db_conn

    app.dependency_overrides[get_db] = override_get_db

    mock_pool = MagicMock()
    mock_pool.connection.return_value.__enter__ = lambda s: mock_db_conn
    mock_pool.connection.return_value.__exit__ = MagicMock(return_value=False)

    mock_model = MagicMock()
    mock_model.is_trained = True
    mock_model.predict.return_value = {
        "p10": 1800.0, "p50": 2500.0, "p90": 3300.0,
        "confidence": 0.82, "explanations": []
    }
    app.state.model = mock_model

    with patch("app.db.connection._pool", mock_pool), \
         patch("app.api.routes.health._pool", mock_pool), \
         patch.object(app.router, "lifespan_context") as mock_lifespan:
        
        @asynccontextmanager
        async def dummy_lifespan(a):
            yield
        mock_lifespan.side_effect = dummy_lifespan

        with TestClient(app, raise_server_exceptions=False) as c:
            yield c

    app.dependency_overrides.clear()


@pytest.fixture
def auth_token():
    """Create a valid JWT for test user."""
    return create_access_token("farmer@agriiq.in")


@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}
