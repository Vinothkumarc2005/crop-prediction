"""
Mandi price Pydantic schemas.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class MandiPriceRecord(BaseModel):
    id: str
    commodity: str
    variety: str | None = None
    market: str
    district: str
    state: str
    priceDate: date | str
    minPrice: Decimal | None = None
    maxPrice: Decimal | None = None
    modalPrice: Decimal | None = None
    source: str | None = None


class MandiSearchResponse(BaseModel):
    prices: list[MandiPriceRecord]
    total: int


class MandiTrendResponse(BaseModel):
    commodity: str
    district: str
    series: list[dict]
