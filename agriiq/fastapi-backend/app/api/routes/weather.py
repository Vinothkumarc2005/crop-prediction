"""
Weather routes.

GET /api/weather         — district-level weather history (10 years)
GET /api/weather/forecast — 6-month forward weather forecast
"""
from fastapi import APIRouter, Query

from app.core.dependencies import CurrentUser, DbConn
from app.schemas.weather import WeatherResponse, WeatherPoint, WeatherSummary
from app.services import weather_service

router = APIRouter(prefix="/weather", tags=["Weather"])


@router.get("", response_model=WeatherResponse)
def get_weather_history(
    district: str = Query(..., description="District name, e.g. Nashik"),
    state:    str = Query(..., description="State name, e.g. Maharashtra"),
    season:   str = Query("Kharif", description="Kharif | Rabi"),
    years:    int = Query(10, ge=1, le=20),
    user: CurrentUser = None,
    conn: DbConn = None,
) -> WeatherResponse:
    """
    Return 10-year monthly weather history + 6-month forecast + summary stats
    for the given district/state.
    """
    history_raw  = weather_service.get_weather_history(conn, district, state, years)
    forecast_raw = weather_service.get_weather_forecast(district, state, months=6)
    summary_raw  = weather_service.get_weather_summary(conn, district, state, season)

    return WeatherResponse(
        district=district,
        state=state,
        season=season,
        history=[WeatherPoint(**p) for p in history_raw],
        forecast=[WeatherPoint(**p) for p in forecast_raw],
        summary=WeatherSummary(**summary_raw),
    )


@router.get("/forecast", response_model=list[WeatherPoint])
def get_weather_forecast(
    district: str = Query(...),
    state:    str = Query(...),
    months:   int = Query(6, ge=1, le=12),
    user: CurrentUser = None,
) -> list[WeatherPoint]:
    """Return only the forward weather forecast (no DB needed)."""
    forecast_raw = weather_service.get_weather_forecast(district, state, months)
    return [WeatherPoint(**p) for p in forecast_raw]
