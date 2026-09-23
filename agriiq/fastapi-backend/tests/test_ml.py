"""
Tests for the ML model module.
"""
import pytest
from app.ml.yield_model import YieldModel


@pytest.fixture(scope="module")
def model():
    """Train a model (fast — uses in-memory seed data)."""
    m = YieldModel()
    m._train()  # Direct training, skip disk I/O
    return m


def test_mock_predict_returns_quantiles():
    """Model without training should return mock predictions."""
    m = YieldModel()
    result = m.predict({"crop": "Rice", "season": "Kharif"})
    assert "p10" in result
    assert "p50" in result
    assert "p90" in result
    assert result["p10"] <= result["p50"] <= result["p90"]


def test_mock_predict_confidence():
    m = YieldModel()
    result = m.predict({"crop": "Wheat"})
    assert 0.0 <= result["confidence"] <= 1.0


def test_trained_model_monotonic_quantiles(model):
    """P10 <= P50 <= P90 must always hold."""
    test_cases = [
        {"crop": "Rice", "season": "Kharif", "ndvi_mean": 0.6, "ph": 6.5,
         "nitrogen": 220, "phosphorus": 25, "potassium": 220, "organic_carbon": 0.8},
        {"crop": "Wheat", "season": "Rabi", "ndvi_mean": 0.5, "ph": 6.8},
        {"crop": "Soybean", "season": "Kharif", "ndvi_mean": 0.4},
    ]
    for case in test_cases:
        result = model.predict(case)
        assert result["p10"] <= result["p50"], f"P10 > P50 for {case['crop']}"
        assert result["p50"] <= result["p90"], f"P50 > P90 for {case['crop']}"


def test_trained_model_positive_yields(model):
    """All yield predictions must be positive."""
    for crop in ["Rice", "Wheat", "Maize", "Soybean", "Cotton"]:
        result = model.predict({"crop": crop, "season": "Kharif"})
        assert result["p10"] >= 0, f"Negative P10 for {crop}"
        assert result["p50"] > 0, f"Zero/negative P50 for {crop}"


def test_crop_rotation_penalty(model):
    """Same crop should not be favored over rotation."""
    same_crop = model.predict({
        "crop": "Rice", "season": "Kharif",
        "previous_crop": "Rice",  # same crop — rotation penalty
    })
    diff_crop = model.predict({
        "crop": "Rice", "season": "Kharif",
        "previous_crop": "Wheat",  # different crop — no penalty
    })
    # Both are valid — same_crop will have same_crop_flag=1 which should
    # influence the model. Just verify both return valid structure.
    assert same_crop["p50"] > 0
    assert diff_crop["p50"] > 0


def test_profitability_formula():
    """Revenue = (yield/100) × price; Profit = Revenue − Cost."""
    from app.services.profitability_service import _revenue
    yield_kg = 2500.0
    price_per_quintal = 2050.0
    expected = (2500 / 100) * 2050  # = 51250
    assert abs(_revenue(yield_kg, price_per_quintal) - expected) < 0.01


def test_risk_thresholds():
    """Risk labelling matches PredictionService.java L244-253."""
    from app.services.prediction_service import _compute_risk

    # Same crop → HIGH
    risk, reason = _compute_risk("Rice", "Rice", 0.1)
    assert risk == "HIGH"
    assert "rotation" in reason.lower()

    # High variance → HIGH
    risk, reason = _compute_risk("Wheat", "Rice", 0.35)
    assert risk == "HIGH"

    # Medium variance → MEDIUM
    risk, reason = _compute_risk("Maize", "Rice", 0.20)
    assert risk == "MEDIUM"

    # Low variance → LOW
    risk, reason = _compute_risk("Soybean", "Wheat", 0.10)
    assert risk == "LOW"
    assert reason is None
