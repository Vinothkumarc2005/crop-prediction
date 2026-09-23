"""
Tests for yield prediction and crop recommendation endpoints.
"""
import uuid
from unittest.mock import patch
from decimal import Decimal


def test_predict_yield_endpoint(client, auth_headers):
    field_id = "00000000-0000-0000-0000-000000000010"
    mock_user = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "email": "farmer@agriiq.in",
    }
    mock_field = {
        "id": uuid.UUID(field_id),
        "user_id": mock_user["id"],
        "district": "Nashik",
        "state": "Maharashtra",
        "previous_crop": "Wheat",
        "prev_prev_crop": None,
    }
    mock_soil = {
        "ph": Decimal("6.8"),
        "nitrogen": Decimal("185.0"),
        "phosphorus": Decimal("22.0"),
        "potassium": Decimal("210.0"),
        "organic_carbon": Decimal("0.65"),
        "texture": "Loamy",
    }
    with patch("app.repositories.user_repository.find_by_email", return_value=mock_user), \
         patch("app.repositories.field_repository.find_by_id_and_user_id", return_value=mock_field), \
         patch("app.repositories.soil_repository.find_latest_by_field_id", return_value=mock_soil), \
         patch("app.repositories.ndvi_repository.find_by_field_id_ordered", return_value=[]):
        resp = client.post("/api/predict/yield", json={
            "fieldId": field_id,
            "crop": "Rice",
            "season": "Kharif"
        }, headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["crop"] == "Rice"
    assert "yieldRange" in data
    assert "profitRange" in data
    assert data["yieldRange"]["p50"] > 0
    assert data["profitRange"]["medProfit"] is not None


def test_recommend_crops_endpoint(client, auth_headers):
    field_id = "00000000-0000-0000-0000-000000000010"
    mock_user = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "email": "farmer@agriiq.in",
    }
    mock_field = {
        "id": uuid.UUID(field_id),
        "user_id": mock_user["id"],
        "district": "Nashik",
        "state": "Maharashtra",
        "previous_crop": "Wheat",
        "prev_prev_crop": None,
    }
    mock_soil = {
        "ph": Decimal("6.8"),
        "nitrogen": Decimal("185.0"),
        "phosphorus": Decimal("22.0"),
        "potassium": Decimal("210.0"),
        "organic_carbon": Decimal("0.65"),
        "texture": "Loamy",
    }
    mock_db_rec = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000050"),
    }
    with patch("app.repositories.user_repository.find_by_email", return_value=mock_user), \
         patch("app.repositories.field_repository.find_by_id_and_user_id", return_value=mock_field), \
         patch("app.repositories.soil_repository.find_latest_by_field_id", return_value=mock_soil), \
         patch("app.repositories.ndvi_repository.find_by_field_id_ordered", return_value=[]), \
         patch("app.repositories.recommendation_repository.create_recommendation", return_value=mock_db_rec):
        resp = client.post("/api/recommend/crops", json={
            "fieldId": field_id,
            "season": "Kharif"
        }, headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "crops" in data
    assert len(data["crops"]) > 0
    # Ranked results
    assert data["crops"][0]["rank"] == 1
    assert data["crops"][0]["profitRange"]["medProfit"] >= data["crops"][-1]["profitRange"]["medProfit"]
