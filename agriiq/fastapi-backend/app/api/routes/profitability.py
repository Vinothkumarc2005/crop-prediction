"""
Profitability calculator route.

POST /api/profitability/calculate
"""
import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.dependencies import DbConn
from app.services.profitability_service import compute_profit_range, DEFAULT_COSTS, DEFAULT_PRICES

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profitability", tags=["Profitability"])

# Crop yield ranges (kg/ha): [p10_low, p50_median, p90_high]
CROP_YIELD_RANGES: dict[str, tuple[float, float, float]] = {
    "Rice":        (2800, 3800, 5000),
    "Wheat":       (2500, 3500, 4800),
    "Maize":       (3000, 4500, 6500),
    "Soybean":     (1000, 1500, 2200),
    "Cotton":      (1000, 1500, 2200),
    "Groundnut":   (1500, 2200, 3000),
    "Sugarcane":   (50000, 70000, 90000),
    "Tur (Arhar)": (800,  1200,  1800),
    "Gram":        (700,  1100,  1600),
    "Tomato":      (15000, 25000, 40000),
    "Potato":      (15000, 22000, 30000),
    "Millets":     (1200,  1800,  2800),
    "Onion":       (12000, 18000, 25000),
}

SEED_COST: dict[str, float] = {
    "Rice": 2500, "Wheat": 3500, "Maize": 3000, "Soybean": 4000,
    "Cotton": 4500, "Groundnut": 6000, "Sugarcane": 12000,
    "Tur (Arhar)": 2000, "Gram": 2500, "Tomato": 5000,
    "Potato": 15000, "Millets": 1500, "Onion": 4000,
}


class ProfitabilityRequest(BaseModel):
    crop: str = Field(..., description="Crop name")
    area_acres: float = Field(..., gt=0, description="Farm area in acres")
    state: str | None = Field(None)
    district: str | None = Field(None)
    season: str | None = Field(None, description="Kharif | Rabi | Zaid")
    custom_price: float | None = Field(None, gt=0, description="Override market price (INR/quintal)")
    custom_yield: float | None = Field(None, gt=0, description="Override expected yield (kg/acre)")


class CostBreakdown(BaseModel):
    seed: float
    fertilizer: float
    pesticide: float
    labor: float
    irrigation: float
    other: float
    total: float


class ProfitScenario(BaseModel):
    label: str
    yield_kg_acre: float
    revenue: float
    profit: float


class ProfitabilityResponse(BaseModel):
    crop: str
    area_acres: float
    area_ha: float
    yield_range: dict[str, float]         # low / central / high (kg/acre)
    price_inr_per_quintal: float
    price_source: str
    cost_breakdown: CostBreakdown
    scenarios: list[ProfitScenario]
    revenue_range: dict[str, float]
    profit_range: dict[str, float]
    breakeven_yield_kg_acre: float
    return_on_investment_pct: float
    disclaimer: str


@router.post("/calculate", response_model=ProfitabilityResponse)
def calculate_profitability(req: ProfitabilityRequest, conn: DbConn) -> ProfitabilityResponse:
    """
    Calculate profitability for a given crop and farm area.
    Returns scenarios at low / central / high yield estimates.
    """
    HA_TO_ACRE = 0.4047
    area_ha = req.area_acres * HA_TO_ACRE

    # ── Yield ranges ──────────────────────────────────────────────────────────
    default_yields = CROP_YIELD_RANGES.get(req.crop, (1500, 2500, 3500))
    p10_ha, p50_ha, p90_ha = default_yields

    # Convert to per-acre
    p10_acre = p10_ha * HA_TO_ACRE
    p50_acre = p50_ha * HA_TO_ACRE
    p90_acre = p90_ha * HA_TO_ACRE

    if req.custom_yield:
        p10_acre = req.custom_yield * 0.75
        p50_acre = req.custom_yield
        p90_acre = req.custom_yield * 1.25
        p10_ha = p10_acre / HA_TO_ACRE
        p50_ha = p50_acre / HA_TO_ACRE
        p90_ha = p90_acre / HA_TO_ACRE

    # ── Market price ──────────────────────────────────────────────────────────
    if req.custom_price:
        modal_price = req.custom_price
        price_source = "User-specified"
    else:
        profit_data = compute_profit_range(
            conn, req.crop, req.state, req.season, req.district,
            p10_ha, p50_ha, p90_ha,
        )
        # Back-calculate modal price from service
        modal_price = DEFAULT_PRICES.get(req.crop, 2000)
        price_source = "Mandi average (recent)"

    # ── Cost breakdown (INR per acre) ─────────────────────────────────────────
    base_cost_ha = DEFAULT_COSTS.get(req.crop, 28000)
    base_cost_acre = base_cost_ha * HA_TO_ACRE

    # Approximate cost breakdown ratios
    seed_cost_acre    = SEED_COST.get(req.crop, 3000) * HA_TO_ACRE
    fertilizer_acre   = base_cost_acre * 0.25
    pesticide_acre    = base_cost_acre * 0.12
    labor_acre        = base_cost_acre * 0.35
    irrigation_acre   = base_cost_acre * 0.15
    other_acre        = base_cost_acre * 0.13

    total_cost_acre = seed_cost_acre + fertilizer_acre + pesticide_acre + labor_acre + irrigation_acre + other_acre
    total_cost_farm = total_cost_acre * req.area_acres

    cost_bd = CostBreakdown(
        seed=round(seed_cost_acre * req.area_acres, 0),
        fertilizer=round(fertilizer_acre * req.area_acres, 0),
        pesticide=round(pesticide_acre * req.area_acres, 0),
        labor=round(labor_acre * req.area_acres, 0),
        irrigation=round(irrigation_acre * req.area_acres, 0),
        other=round(other_acre * req.area_acres, 0),
        total=round(total_cost_farm, 0),
    )

    # ── Revenue and profit (total farm) ──────────────────────────────────────
    def revenue(yield_per_acre: float) -> float:
        return (yield_per_acre / 100.0) * modal_price * req.area_acres

    rev_low  = revenue(p10_acre)
    rev_mid  = revenue(p50_acre)
    rev_high = revenue(p90_acre)

    profit_low  = rev_low  - total_cost_farm
    profit_mid  = rev_mid  - total_cost_farm
    profit_high = rev_high - total_cost_farm

    # ── Break-even yield ─────────────────────────────────────────────────────
    # revenue_per_acre = (yield / 100) * price
    # break_even: total_cost_farm = break_even_yield/acre * (price/100) * area
    if modal_price > 0:
        breakeven_yield_per_acre = (total_cost_farm / (modal_price / 100.0)) / req.area_acres
    else:
        breakeven_yield_per_acre = 0.0

    roi = ((profit_mid / total_cost_farm) * 100) if total_cost_farm > 0 else 0.0

    scenarios = [
        ProfitScenario(label="Low yield scenario", yield_kg_acre=round(p10_acre, 1), revenue=round(rev_low, 0), profit=round(profit_low, 0)),
        ProfitScenario(label="Expected (median)",  yield_kg_acre=round(p50_acre, 1), revenue=round(rev_mid, 0),  profit=round(profit_mid, 0)),
        ProfitScenario(label="Good yield scenario",yield_kg_acre=round(p90_acre, 1), revenue=round(rev_high, 0), profit=round(profit_high, 0)),
    ]

    return ProfitabilityResponse(
        crop=req.crop,
        area_acres=req.area_acres,
        area_ha=round(area_ha, 2),
        yield_range={"low": round(p10_acre, 1), "central": round(p50_acre, 1), "high": round(p90_acre, 1)},
        price_inr_per_quintal=round(modal_price, 2),
        price_source=price_source,
        cost_breakdown=cost_bd,
        scenarios=scenarios,
        revenue_range={"low": round(rev_low, 0), "central": round(rev_mid, 0), "high": round(rev_high, 0)},
        profit_range={"low": round(profit_low, 0), "central": round(profit_mid, 0), "high": round(profit_high, 0)},
        breakeven_yield_kg_acre=round(breakeven_yield_per_acre, 1),
        return_on_investment_pct=round(roi, 1),
        disclaimer=(
            "Estimates are based on district averages and historical mandi prices. "
            "Actual results depend on weather, market conditions, and farm practices. "
            "Use ranges as planning guidance, not guaranteed figures."
        ),
    )
