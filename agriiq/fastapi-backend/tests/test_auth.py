"""
Tests for auth endpoints.
"""
from unittest.mock import patch, MagicMock

import pytest


def test_ping(client):
    resp = client.get("/ping")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "UP"
    assert "database" in data
    assert "model" in data


def test_register_success(client):
    mock_user = {
        "id": "00000000-0000-0000-0000-000000000099",
        "email": "test@example.com",
        "full_name": "Test User",
        "role": "FARMER",
        "language": "en",
        "password": "$2a$12$hash",
    }
    with patch("app.repositories.user_repository.exists_by_email", return_value=False):
        with patch("app.repositories.user_repository.create_user", return_value=mock_user):
            resp = client.post("/api/auth/register", json={
                "email": "test@example.com",
                "password": "password123",
                "fullName": "Test User",
            })
    assert resp.status_code == 201
    data = resp.json()
    assert "token" in data
    assert data["email"] == "test@example.com"


def test_register_duplicate_email(client):
    with patch("app.repositories.user_repository.exists_by_email", return_value=True):
        resp = client.post("/api/auth/register", json={
            "email": "existing@example.com",
            "password": "password123",
            "fullName": "Test User",
        })
    assert resp.status_code == 400


def test_login_success(client):
    from app.core.security import hash_password
    hashed = hash_password("password123")
    mock_user = {
        "id": "00000000-0000-0000-0000-000000000002",
        "email": "farmer@agriiq.in",
        "password": hashed,
        "full_name": "Ramesh Patil",
        "role": "FARMER",
        "language": "hi",
    }
    with patch("app.repositories.user_repository.find_by_email", return_value=mock_user):
        resp = client.post("/api/auth/login", json={
            "email": "farmer@agriiq.in",
            "password": "password123",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["type"] == "Bearer"


def test_login_invalid_credentials(client):
    with patch("app.repositories.user_repository.find_by_email", return_value=None):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "wrong",
        })
    assert resp.status_code == 400


def test_me_requires_auth(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_success(client, auth_headers):
    mock_user = {
        "id": "00000000-0000-0000-0000-000000000002",
        "email": "farmer@agriiq.in",
        "password": "$2a$12$hash",
        "full_name": "Ramesh Patil",
        "role": "FARMER",
        "language": "hi",
    }
    with patch("app.repositories.user_repository.find_by_email", return_value=mock_user):
        resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "farmer@agriiq.in"
