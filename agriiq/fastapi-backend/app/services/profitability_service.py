"""
ProfitabilityService — port of Java ProfitabilityService.java.

Computes financial projections (revenue, profit, input costs) for a
given crop at P10/P50/P90 yield quantiles and market prices.

Business formula (preserved verbatim):
  revenue = (yield_kg_ha / 100) × price_per_quintal   [1 quintal = 100 kg]
  profit  = revenue − input_cost

Input cost lookup: DB table input_costs, with fallback to DEFAULT_COSTS.
Market price lookup: DB table mandi_prices, with fallback to DEFAULT_PRICES.
"""
from __future__ import annotations

import logging
from typing import Any

import psycopg

logger = logging.getLogger(__name__)

# Default input costs (INR/ha) — mirrors init.sql seed data
DEFAULT_COSTS: dict[str, float] = {
    "Rice":        34000,
    "Wheat":       27500,
    "Maize":       24000,
    "Soybean":     23500,
    "Cotton":      47000,
    "Groundnut":   29000,
    "Sugarcane":   58000,
    "Tur (Arhar)": 19500,
    "Gram":        22000,
}

# Default market prices (INR/quintal) — fallback when DB has no recent data
DEFAULT_PRICES: dict[str, float] = {
    "Rice":        2050,
    "Wheat":       2350,
    "Maize":       1700,
    "Soybean":     4600,
    "Cotton":      6800,
    "Groundnut":   5700,
    "Sugarcane":   360,
    "Tur (Arhar)": 6400,
    "Gram":        5000,
}


def compute_profit_range(
    conn: psycopg.Connection,
    crop: str,
    state: str | None,
    season: str | None,
    district: str | None,
    p10: float,
    p50: float,
    p90: float,
) -> dict[str, Any]:
    """
    Compute profit projections for the given yield quantiles.

    Returns a dict compatible with ProfitRange schema.
    """
    input_cost  = _get_input_cost(conn, crop, state, season)
    modal_price = _get_modal_price(conn, crop, district, state)

    min_revenue = _revenue(p10, modal_price)
    med_revenue = _revenue(p50, modal_price)
    max_revenue = _revenue(p90, modal_price)

    min_profit = round(min_revenue - input_cost, 2)
    med_profit = round(med_revenue - input_cost, 2)
    max_profit = round(max_revenue - input_cost, 2)

    return {
        "minProfit":   min_profit,
        "medProfit":   med_profit,
        "maxProfit":   max_profit,
        "unit":        "INR/ha",
        "inputCost":   round(input_cost, 2),
        "minRevenue":  round(min_revenue, 2),
        "medRevenue":  round(med_revenue, 2),
        "maxRevenue":  round(max_revenue, 2),
    }


def _revenue(yield_kg_ha: float, price_per_quintal: float) -> float:
    """Convert yield (kg/ha) to revenue (INR/ha) at given price per quintal."""
    return (yield_kg_ha / 100.0) * price_per_quintal


def _get_input_cost(
    conn: psycopg.Connection,
    crop: str,
    state: str | None,
    season: str | None,
) -> float:
    """Look up total input cost from DB, fallback to DEFAULT_COSTS."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT total_cost FROM input_costs
                WHERE LOWER(crop) = LOWER(%s)
                  AND (state IS NULL OR LOWER(state) = LOWER(%s))
                  AND (season IS NULL OR LOWER(season) = LOWER(%s))
                ORDER BY
                    (state IS NOT NULL) DESC,
                    (season IS NOT NULL) DESC
                LIMIT 1
                """,
                (crop, state or "", season or ""),
            )
            row = cur.fetchone()
            if row and row.get("total_cost") is not None:
                return float(row["total_cost"])
    except Exception as exc:
        logger.warning("Failed to fetch input cost for %s: %s", crop, exc)
    return DEFAULT_COSTS.get(crop, 30000)


def _get_modal_price(
    conn: psycopg.Connection,
    crop: str,
    district: str | None,
    state: str | None,
) -> float:
    """Look up most recent modal mandi price, fallback to DEFAULT_PRICES."""
    try:
        with conn.cursor() as cur:
            conditions = ["LOWER(commodity) = LOWER(%s)"]
            params: list[Any] = [crop]
            if district:
                conditions.append("LOWER(district) = LOWER(%s)")
                params.append(district)
            if state:
                conditions.append("LOWER(state) = LOWER(%s)")
                params.append(state)
            where = " AND ".join(conditions)
            cur.execute(
                f"""
                SELECT modal_price FROM mandi_prices
                WHERE {where}
                ORDER BY price_date DESC
                LIMIT 1
                """,
                params,
            )
            row = cur.fetchone()
            if row and row.get("modal_price") is not None:
                return float(row["modal_price"])
    except Exception as exc:
        logger.warning("Failed to fetch mandi price for %s: %s", crop, exc)
    return DEFAULT_PRICES.get(crop, 2000)
