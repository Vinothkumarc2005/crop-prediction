"""
Mandi price routes — port of Java MandiPriceController.java.

GET /api/mandi-prices
GET /api/mandi-prices/commodities
GET /api/mandi-prices/trend
"""
from typing import Optional

from fastapi import APIRouter, Query

from app.core.dependencies import DbConn
from app.schemas.mandi import MandiSearchResponse, MandiTrendResponse
from app.services import mandi_service

router = APIRouter(prefix="/mandi-prices", tags=["Market Prices"])


@router.get("", response_model=MandiSearchResponse)
def search_prices(
    conn: DbConn,
    commodity: Optional[str] = Query(None),
    district: Optional[str]  = Query(None),
    state: Optional[str]     = Query(None),
    limit: int               = Query(100, ge=1, le=500),
) -> MandiSearchResponse:
    """Search mandi prices with optional filters."""
    return mandi_service.search_prices(conn, commodity, district, state, limit)


@router.get("/commodities", response_model=list[str])
def list_commodities(conn: DbConn) -> list[str]:
    """Return distinct commodity names available in the mandi price table."""
    return mandi_service.list_commodities(conn)


@router.get("/trend", response_model=MandiTrendResponse)
def get_price_trend(
    conn: DbConn,
    commodity: str = Query(...),
    district: str  = Query(...),
) -> MandiTrendResponse:
    """Return price time-series for a commodity × district combination."""
    return mandi_service.get_price_trend(conn, commodity, district)
