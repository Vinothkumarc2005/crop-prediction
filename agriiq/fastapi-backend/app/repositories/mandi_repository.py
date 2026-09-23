"""
MandiRepository — psycopg queries for the mandi_prices table.
"""
from __future__ import annotations

from typing import Any

import psycopg


def search(
    conn: psycopg.Connection,
    commodity: str | None = None,
    district: str | None = None,
    state: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """
    Search mandi prices with optional filters.
    Matches Spring's MandiPriceRepository.search().
    """
    conditions = []
    params: list[Any] = []

    if commodity:
        conditions.append("LOWER(commodity) = LOWER(%s)")
        params.append(commodity)
    if district:
        conditions.append("LOWER(district) = LOWER(%s)")
        params.append(district)
    if state:
        conditions.append("LOWER(state) = LOWER(%s)")
        params.append(state)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, commodity, variety, market, district, state,
                   price_date, min_price, max_price, modal_price, source, created_at
            FROM mandi_prices
            {where}
            ORDER BY price_date DESC
            LIMIT %s
            """,
            params,
        )
        return cur.fetchall()


def find_distinct_commodities(conn: psycopg.Connection) -> list[str]:
    """Return sorted list of distinct commodity names."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT DISTINCT commodity FROM mandi_prices ORDER BY commodity"
        )
        return [row["commodity"] for row in cur.fetchall()]


def find_by_commodity_and_district(
    conn: psycopg.Connection,
    commodity: str,
    district: str,
    limit: int = 90,
) -> list[dict[str, Any]]:
    """
    Return prices for *commodity* in *district*, newest first.
    Matches Spring's findByCommodityIgnoreCaseAndDistrictIgnoreCaseOrderByPriceDateDesc().
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, commodity, variety, market, district, state,
                   price_date, min_price, max_price, modal_price, source, created_at
            FROM mandi_prices
            WHERE LOWER(commodity) = LOWER(%s)
              AND LOWER(district)  = LOWER(%s)
            ORDER BY price_date DESC
            LIMIT %s
            """,
            (commodity, district, limit),
        )
        return cur.fetchall()
