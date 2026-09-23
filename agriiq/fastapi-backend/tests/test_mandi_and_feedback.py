"""
Tests for Mandi Price and Feedback routes.
"""
import uuid
from decimal import Decimal
from unittest.mock import patch


def test_mandi_commodities(client):
    with patch("app.repositories.mandi_repository.find_distinct_commodities", return_value=["Cotton", "Rice", "Wheat"]):
        resp = client.get("/api/mandi-prices/commodities")
    assert resp.status_code == 200
    data = resp.json()
    assert data == ["Cotton", "Rice", "Wheat"]


def test_mandi_search(client):
    mock_prices = [
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000030"),
            "commodity": "Rice",
            "variety": "Common",
            "market": "Nashik APMC",
            "district": "Nashik",
            "state": "Maharashtra",
            "price_date": "2026-08-20",
            "min_price": Decimal("1800.00"),
            "max_price": Decimal("2200.00"),
            "modal_price": Decimal("2050.00"),
            "source": "mock",
            "created_at": "2026-08-20T00:00:00Z"
        }
    ]
    with patch("app.repositories.mandi_repository.search", return_value=mock_prices):
        resp = client.get("/api/mandi-prices?commodity=Rice&district=Nashik")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["prices"][0]["commodity"] == "Rice"
    assert data["prices"][0]["modalPrice"] == "2050.00"


def test_mandi_trend(client):
    mock_series = [
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000031"),
            "commodity": "Wheat",
            "variety": None,
            "market": "Nashik APMC",
            "district": "Nashik",
            "state": "Maharashtra",
            "price_date": "2026-08-20",
            "min_price": Decimal("2100.00"),
            "max_price": Decimal("2600.00"),
            "modal_price": Decimal("2350.00"),
            "source": "mock",
            "created_at": "2026-08-20T00:00:00Z"
        }
    ]
    with patch("app.repositories.mandi_repository.find_by_commodity_and_district", return_value=mock_series):
        resp = client.get("/api/mandi-prices/trend?commodity=Wheat&district=Nashik")
    assert resp.status_code == 200
    data = resp.json()
    assert data["commodity"] == "Wheat"
    assert len(data["series"]) == 1
    assert data["series"][0]["modalPrice"] == 2350.0


def test_log_feedback(client, auth_headers):
    field_id = "00000000-0000-0000-0000-000000000010"
    mock_user = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
        "email": "farmer@agriiq.in",
    }
    mock_created = {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000040"),
        "field_id": uuid.UUID(field_id),
        "crop": "Rice",
        "season": "Kharif",
        "year": 2026,
        "actual_yield_kg_ha": Decimal("2650.00"),
        "actual_revenue": Decimal("54325.00"),
        "notes": "Good monsoon harvest",
        "created_at": "2026-08-22T00:00:00Z"
    }
    with patch("app.repositories.user_repository.find_by_email", return_value=mock_user), \
         patch("app.repositories.feedback_repository.create_feedback", return_value=mock_created):
        resp = client.post("/api/feedback", json={
            "fieldId": field_id,
            "crop": "Rice",
            "season": "Kharif",
            "year": 2026,
            "actualYieldKgHa": 2650.0,
            "actualRevenue": 54325.0,
            "notes": "Good monsoon harvest"
        }, headers=auth_headers)

    assert resp.status_code == 201
    data = resp.json()
    assert data["crop"] == "Rice"
    assert data["actualYieldKgHa"] == "2650.00"
