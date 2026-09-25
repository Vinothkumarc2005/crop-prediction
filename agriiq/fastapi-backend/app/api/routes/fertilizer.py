"""
Fertilizer Recommendation routes.

POST /api/fertilizer/recommend
GET  /api/fertilizer/crops    — returns list of supported crops
"""
import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fertilizer", tags=["Fertilizer"])

# ── NPK requirement database (kg/ha per tonne of expected yield) ─────────────
# Sources: ICAR crop nutrient guidelines, Indian fertilizer recommendations
CROP_NPK: dict[str, dict[str, Any]] = {
    "Rice": {
        "N": 120, "P": 60,  "K": 60,
        "micronutrients": ["Zinc (ZnSO4 25kg/ha)"],
        "notes": "Split N in 3 doses: basal, tillering, panicle initiation.",
        "growth_stages": ["Land preparation", "Transplanting", "Tillering", "Panicle initiation", "Heading"],
    },
    "Wheat": {
        "N": 120, "P": 60,  "K": 40,
        "micronutrients": ["Zinc (ZnSO4 25kg/ha)"],
        "notes": "Apply full P & K as basal; split N in 2-3 doses.",
        "growth_stages": ["Sowing", "Crown root initiation", "Tillering", "Jointing", "Heading"],
    },
    "Maize": {
        "N": 150, "P": 75,  "K": 75,
        "micronutrients": ["Zinc (ZnSO4 25kg/ha)", "Boron (1kg/ha)"],
        "notes": "High N demand. Apply 1/3 basal, 1/3 at knee height, 1/3 at tasseling.",
        "growth_stages": ["Sowing", "Knee-high stage", "Tasseling", "Silking", "Grain fill"],
    },
    "Soybean": {
        "N": 30,  "P": 80,  "K": 40,
        "micronutrients": ["Molybdenum (0.5 kg/ha)", "Rhizobium inoculation"],
        "notes": "Fixes atmospheric N via Rhizobium; minimal N needed. High P requirement.",
        "growth_stages": ["Sowing", "Vegetative", "Flowering", "Pod fill", "Maturity"],
    },
    "Cotton": {
        "N": 150, "P": 75,  "K": 75,
        "micronutrients": ["Boron (2kg/ha)", "Zinc (5kg/ha)"],
        "notes": "Apply in 4 splits. Potassium critical for fiber quality.",
        "growth_stages": ["Sowing", "Squaring", "Flowering", "Boll development", "Boll opening"],
    },
    "Groundnut": {
        "N": 25,  "P": 50,  "K": 75,
        "micronutrients": ["Gypsum (500kg/ha at pegging)", "Boron (1kg/ha)"],
        "notes": "Gypsum (calcium) critical at pegging stage for pod fill.",
        "growth_stages": ["Sowing", "Vegetative", "Flowering", "Pegging", "Pod fill"],
    },
    "Sugarcane": {
        "N": 300, "P": 100, "K": 120,
        "micronutrients": ["Zinc (25kg/ha)", "Iron chelate if chlorotic"],
        "notes": "Highest N consumer. Apply in 4-5 splits throughout the season.",
        "growth_stages": ["Planting", "Germination", "Tillering", "Grand growth", "Ripening"],
    },
    "Tur (Arhar)": {
        "N": 20,  "P": 50,  "K": 20,
        "micronutrients": ["Rhizobium inoculation", "Sulphur (20kg/ha)"],
        "notes": "Legume — Rhizobium inoculation reduces N requirement significantly.",
        "growth_stages": ["Sowing", "Vegetative", "Flowering", "Pod fill", "Maturity"],
    },
    "Gram": {
        "N": 20,  "P": 40,  "K": 20,
        "micronutrients": ["Rhizobium inoculation", "Zinc (5kg/ha)"],
        "notes": "Cool-season legume. Avoid excess N; rely on biological fixation.",
        "growth_stages": ["Sowing", "Vegetative", "Flowering", "Pod fill", "Maturity"],
    },
    "Tomato": {
        "N": 180, "P": 90,  "K": 150,
        "micronutrients": ["Calcium (foliar spray at fruit set)", "Boron (1kg/ha)", "Magnesium"],
        "notes": "High K requirement for fruit quality. Apply via fertigation if drip-irrigated.",
        "growth_stages": ["Transplanting", "Vegetative", "Flowering", "Fruit set", "Fruit development"],
    },
    "Potato": {
        "N": 150, "P": 100, "K": 200,
        "micronutrients": ["Zinc (5kg/ha)", "Boron (1kg/ha)"],
        "notes": "Highest K crop. Split applications essential for tuber quality.",
        "growth_stages": ["Planting", "Emergence", "Vegetative", "Tuber initiation", "Tuber bulking"],
    },
    "Millets": {
        "N": 80,  "P": 40,  "K": 40,
        "micronutrients": ["Zinc (25kg/ha)"],
        "notes": "Drought-tolerant; lower input requirement. Apply basal at sowing.",
        "growth_stages": ["Sowing", "Tillering", "Jointing", "Flowering", "Grain fill"],
    },
    "Onion": {
        "N": 100, "P": 50,  "K": 100,
        "micronutrients": ["Sulphur (30kg/ha)", "Zinc (5kg/ha)"],
        "notes": "Sulphur critical for pungency and shelf life. Avoid excess N late season.",
        "growth_stages": ["Transplanting", "Vegetative", "Bulb initiation", "Bulb development", "Maturity"],
    },
}

# ── Commercial fertilizer products ────────────────────────────────────────────
FERTILIZER_PRODUCTS: dict[str, dict[str, Any]] = {
    "Urea": {"N": 46, "P": 0, "K": 0, "unit": "%"},
    "DAP (Di-Ammonium Phosphate)": {"N": 18, "P": 46, "K": 0, "unit": "%"},
    "MOP (Muriate of Potash)": {"N": 0, "P": 0, "K": 60, "unit": "%"},
    "SSP (Single Super Phosphate)": {"N": 0, "P": 16, "K": 0, "unit": "%"},
    "NPK 10-26-26": {"N": 10, "P": 26, "K": 26, "unit": "%"},
    "NPK 12-32-16": {"N": 12, "P": 32, "K": 16, "unit": "%"},
    "Ammonium Sulphate": {"N": 21, "P": 0, "K": 0, "unit": "%"},
}


class FertilizerRequest(BaseModel):
    crop: str = Field(..., description="Selected crop name")
    area_acres: float = Field(..., gt=0, description="Farm area in acres")
    soil_ph: float | None = Field(None, ge=4.0, le=9.5, description="Soil pH if known")
    soil_n: float | None = Field(None, description="Soil nitrogen (kg/ha) if tested")
    soil_p: float | None = Field(None, description="Soil phosphorus (kg/ha) if tested")
    soil_k: float | None = Field(None, description="Soil potassium (kg/ha) if tested")
    growth_stage: str = Field("Pre-sowing", description="Current crop growth stage")


class FertilizerProduct(BaseModel):
    product: str
    quantity_kg_per_acre: float
    purpose: str
    timing: str


class FertilizerResponse(BaseModel):
    crop: str
    area_acres: float
    area_ha: float
    n_requirement_kg_ha: float
    p_requirement_kg_ha: float
    k_requirement_kg_ha: float
    micronutrients: list[str]
    notes: str
    growth_stages: list[str]
    recommended_products: list[FertilizerProduct]
    soil_test_recommended: bool
    disclaimer: str
    data_source: str


@router.get("/crops")
def list_supported_crops() -> list[str]:
    """List crops for which fertilizer recommendations are available."""
    return sorted(CROP_NPK.keys())


@router.post("/recommend", response_model=FertilizerResponse)
def recommend_fertilizer(req: FertilizerRequest) -> FertilizerResponse:
    """
    Generate fertilizer recommendation for a crop and farm area.

    Adjusts NPK based on soil test results if provided.
    All quantities are per acre unless noted otherwise.
    """
    crop_data = CROP_NPK.get(req.crop)
    if crop_data is None:
        # Use generic values if crop not in database
        crop_data = {
            "N": 100, "P": 50, "K": 50,
            "micronutrients": [],
            "notes": f"Generic recommendation for {req.crop}. Soil test strongly recommended.",
            "growth_stages": ["Sowing", "Vegetative", "Flowering", "Maturity"],
        }

    # Convert acres to hectares (1 acre = 0.4047 ha)
    area_ha = req.area_acres * 0.4047

    # Base requirements (kg/ha)
    n_req = float(crop_data["N"])
    p_req = float(crop_data["P"])
    k_req = float(crop_data["K"])

    # Adjust if soil test data provided
    soil_test_recommended = True
    if req.soil_n is not None and req.soil_n > 0:
        soil_test_recommended = False
        reduction = min(req.soil_n * 0.5, n_req * 0.3)
        n_req = max(n_req - reduction, n_req * 0.4)
    if req.soil_p is not None and req.soil_p > 0:
        soil_test_recommended = False
        reduction = min(req.soil_p * 0.4, p_req * 0.4)
        p_req = max(p_req - reduction, p_req * 0.3)
    if req.soil_k is not None and req.soil_k > 0:
        soil_test_recommended = False
        reduction = min(req.soil_k * 0.3, k_req * 0.3)
        k_req = max(k_req - reduction, k_req * 0.3)

    # Build commercial product recommendations (per acre)
    HA_TO_ACRE = 0.4047
    n_per_acre = n_req * HA_TO_ACRE
    p_per_acre = p_req * HA_TO_ACRE
    k_per_acre = k_req * HA_TO_ACRE

    products: list[FertilizerProduct] = []

    # DAP for phosphorus + partial N
    if p_per_acre > 0:
        dap_qty = round(p_per_acre / 0.46, 1)  # DAP has 46% P
        n_from_dap = dap_qty * 0.18
        products.append(FertilizerProduct(
            product="DAP (Di-Ammonium Phosphate)",
            quantity_kg_per_acre=dap_qty,
            purpose=f"Supplies {round(p_per_acre, 1)} kg/acre Phosphorus + {round(n_from_dap, 1)} kg/acre N",
            timing="Apply as basal at time of sowing / land preparation",
        ))
        n_per_acre = max(0, n_per_acre - n_from_dap)

    # Urea for remaining N
    if n_per_acre > 5:
        urea_qty = round(n_per_acre / 0.46, 1)  # Urea 46% N
        products.append(FertilizerProduct(
            product="Urea",
            quantity_kg_per_acre=urea_qty,
            purpose=f"Supplies {round(n_per_acre, 1)} kg/acre Nitrogen",
            timing="Split in 2-3 applications: basal + top-dressing at active growth stages",
        ))

    # MOP for potassium
    if k_per_acre > 5:
        mop_qty = round(k_per_acre / 0.60, 1)  # MOP 60% K
        products.append(FertilizerProduct(
            product="MOP (Muriate of Potash)",
            quantity_kg_per_acre=mop_qty,
            purpose=f"Supplies {round(k_per_acre, 1)} kg/acre Potassium",
            timing="Apply 50% as basal, 50% at mid-season",
        ))

    return FertilizerResponse(
        crop=req.crop,
        area_acres=req.area_acres,
        area_ha=round(area_ha, 2),
        n_requirement_kg_ha=round(n_req, 1),
        p_requirement_kg_ha=round(p_req, 1),
        k_requirement_kg_ha=round(k_req, 1),
        micronutrients=crop_data.get("micronutrients", []),
        notes=crop_data.get("notes", ""),
        growth_stages=crop_data.get("growth_stages", []),
        recommended_products=products,
        soil_test_recommended=soil_test_recommended,
        disclaimer=(
            "These are general recommendations based on ICAR guidelines. "
            "For precise dosage, conduct a soil test. Actual requirements vary "
            "with soil type, variety, irrigation, and local conditions."
        ),
        data_source="ICAR Fertilizer Use Recommendations / National fertilizer guidelines",
    )
