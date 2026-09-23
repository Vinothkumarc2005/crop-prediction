"""
Tests for field routes and spatial logic.
"""
import uuid
from unittest.mock import patch, MagicMock
from decimal import Decimal


def test_list_fields(client, auth_headers):
    mock_fields = [
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000010"),
            "user_id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
            "name": "North Field",
            "area_hectares": Decimal("2.4500"),
            "district": "Nashik",
            "state": "Maharashtra",
            "previous_crop": "Rice",
            "prev_prev_crop": "Wheat",
            "created_at": "2026-08-20T10:00:00Z",
            "boundary_geojson": {
                "type": "Polygon",
                "coordinates": [[[73.78, 19.99], [73.79, 19.99], [73.79, 20.00], [73.78, 20.00], [73.78, 19.99]]]
            }
        }
    ]
    mock_user = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "email": "farmer@agriiq.in",
        "full_name": "Ramesh Patil",
    }
    with patch("app.repositories.user_repository.find_by_email", return_value=mock_user), \
         patch("app.repositories.field_repository.find_by_user_id", return_value=mock_fields):
        resp = client.get("/api/fields", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "North Field"
    assert data[0]["district"] == "Nashik"


def test_create_field(client, auth_headers):
    mock_created = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000011"),
        "user_id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "name": "South Field",
        "area_hectares": Decimal("1.8000"),
        "district": "Nashik",
        "state": "Maharashtra",
        "previous_crop": "Soybean",
        "prev_prev_crop": None,
        "created_at": "2026-08-22T10:00:00Z",
        "boundary_geojson": {
            "type": "Polygon",
            "coordinates": [[[73.80, 19.95], [73.81, 19.95], [73.81, 19.96], [73.80, 19.96], [73.80, 19.95]]]
        }
    }
    mock_user = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "email": "farmer@agriiq.in",
        "full_name": "Ramesh Patil",
    }
    with patch("app.repositories.user_repository.find_by_email", return_value=mock_user), \
         patch("app.repositories.field_repository.create_field", return_value=mock_created), \
         patch("app.services.ndvi_service.fetch_and_store_ndvi"), \
         patch("app.services.soil_service.fetch_and_store_soil"):
        resp = client.post("/api/fields", json={
            "name": "South Field",
            "coordinates": [[73.80, 19.95], [73.81, 19.95], [73.81, 19.96], [73.80, 19.96], [73.80, 19.95]],
            "district": "Nashik",
            "state": "Maharashtra",
            "previousCrop": "Soybean"
        }, headers=auth_headers)

    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "South Field"
    assert data["previousCrop"] == "Soybean"


def test_get_field_ndvi(client, auth_headers):
    field_id = "00000000-0000-0000-0000-000000000010"
    mock_user = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "email": "farmer@agriiq.in",
    }
    mock_field = {"id": uuid.UUID(field_id), "user_id": mock_user["id"]}
    mock_readings = [
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000020"),
            "field_id": uuid.UUID(field_id),
            "observed_date": "2026-08-15",
            "ndvi_mean": Decimal("0.5500"),
            "ndvi_max": Decimal("0.6200"),
            "ndvi_min": Decimal("0.4800"),
            "ndvi_std": Decimal("0.0400"),
            "ndvi_trend": Decimal("0.00100"),
            "cloud_cover": Decimal("5.00"),
            "source": "mock",
            "created_at": "2026-08-15T00:00:00Z"
        }
    ]
    with patch("app.repositories.user_repository.find_by_email", return_value=mock_user), \
         patch("app.repositories.field_repository.find_by_id_and_user_id", return_value=mock_field), \
         patch("app.repositories.ndvi_repository.find_by_field_id_ordered", return_value=mock_readings):
        resp = client.get(f"/api/fields/{field_id}/ndvi", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "series" in data
    assert "stats" in data
    assert data["stats"]["healthStatus"] == "HEALTHY"
