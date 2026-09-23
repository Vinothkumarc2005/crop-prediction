"""
MandiService — port of Java MandiPriceService.java.

Provides market price search, commodity list, and price trend queries.
"""
from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any

import psycopg

from app.repositories import mandi_repository
from app.schemas.mandi import MandiPriceRecord, MandiSearchResponse, MandiTrendResponse

logger = logging.getLogger(__name__)


def search_prices(
    conn: psycopg.Connection,
    commodity: str | None = None,
    district: str | None = None,
    state: str | None = None,
    limit: int = 100,
) -> MandiSearchResponse:
    """Search mandi prices with optional filters."""
    rows = mandi_repository.search(conn, commodity, district, state, limit)
    prices = [_map_price(r) for r in rows]
    return MandiSearchResponse(prices=prices, total=len(prices))


def list_commodities(conn: psycopg.Connection) -> list[str]:
    """Return sorted list of available commodities."""
    return mandi_repository.find_distinct_commodities(conn)


def get_price_trend(
    conn: psycopg.Connection,
    commodity: str,
    district: str,
) -> MandiTrendResponse:
    """Return price time-series for commodity × district."""
    rows = mandi_repository.find_by_commodity_and_district(conn, commodity, district)
    series = [
        {
            "date":       str(r["price_date"]),
            "minPrice":   float(r["min_price"]) if r.get("min_price") else None,
            "maxPrice":   float(r["max_price"]) if r.get("max_price") else None,
            "modalPrice": float(r["modal_price"]) if r.get("modal_price") else None,
        }
        for r in rows
    ]
    return MandiTrendResponse(commodity=commodity, district=district, series=series)


def _map_price(row: dict) -> MandiPriceRecord:
    return MandiPriceRecord(
        id=str(row["id"]),
        commodity=row["commodity"],
        variety=row.get("variety"),
        market=row["market"],
        district=row["district"],
        state=row["state"],
        priceDate=str(row["price_date"]),
        minPrice=row.get("min_price"),
        maxPrice=row.get("max_price"),
        modalPrice=row.get("modal_price"),
        source=row.get("source"),
    )
