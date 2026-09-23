"""
Field routes — port of Java FieldController.java.

POST   /api/fields
GET    /api/fields
GET    /api/fields/{id}
GET    /api/fields/{id}/ndvi
GET    /api/fields/{id}/ndvi/forecast
GET    /api/fields/{id}/weather
GET    /api/fields/{id}/soil
GET    /api/fields/{id}/history
DELETE /api/fields/{id}
"""
import uuid

from fastapi import APIRouter, Query

from app.core.dependencies import CurrentUser, DbConn
from app.schemas.field import CreateFieldRequest, FieldResponse, NdviResponse, SoilResponse
from app.schemas.weather import NdviForecastResponse, NdviPoint, WeatherResponse, WeatherPoint, WeatherSummary
from app.services import field_service, ndvi_forecast_service, weather_service

router = APIRouter(prefix="/fields", tags=["Fields"])


@router.post("", response_model=FieldResponse, status_code=201)
def create_field(req: CreateFieldRequest, user: CurrentUser, conn: DbConn) -> FieldResponse:
    """Create a new field. Automatically generates NDVI and soil data."""
    return field_service.create_field(conn, req, user)


@router.get("", response_model=list[FieldResponse])
def list_fields(user: CurrentUser, conn: DbConn) -> list[FieldResponse]:
    """List all fields for the current user."""
    return field_service.list_fields(conn, user)


@router.get("/{field_id}", response_model=FieldResponse)
def get_field(field_id: uuid.UUID, user: CurrentUser, conn: DbConn) -> FieldResponse:
    """Get a single field by ID."""
    return field_service.get_field(conn, field_id, user)


@router.get("/{field_id}/ndvi", response_model=NdviResponse)
def get_ndvi(field_id: uuid.UUID, user: CurrentUser, conn: DbConn) -> NdviResponse:
    """Get NDVI time-series for a field."""
    return field_service.get_ndvi(conn, field_id, user)


@router.get("/{field_id}/ndvi/forecast", response_model=NdviForecastResponse)
def get_ndvi_forecast(
    field_id: uuid.UUID,
    user: CurrentUser,
    conn: DbConn,
    months: int = Query(6, ge=1, le=12, description="Months to forecast ahead"),
) -> NdviForecastResponse:
    """Get 6-month NDVI forecast for a field using trend extrapolation."""
    field = field_service.get_field(conn, field_id, user)
    result = ndvi_forecast_service.forecast_ndvi(
        conn,
        field_id=field_id,
        district=field.district,
        months=months,
    )
    return NdviForecastResponse(
        fieldId=str(field_id),
        district=field.district,
        historical=[NdviPoint(**p) for p in result["historical"]],
        forecast=[NdviPoint(**p) for p in result["forecast"]],
        trend=result["trend"],
        residualStd=result["residualStd"],
        ndviForecast3m=result["ndviForecast3m"],
        healthAt3m=result["healthAt3m"],
    )


@router.get("/{field_id}/weather", response_model=WeatherResponse)
def get_field_weather(
    field_id: uuid.UUID,
    user: CurrentUser,
    conn: DbConn,
    season: str = Query("Kharif", description="Kharif | Rabi"),
    years:  int = Query(10, ge=1, le=20),
) -> WeatherResponse:
    """
    Get 10-year weather history + 6-month forecast for the field's district.
    """
    field = field_service.get_field(conn, field_id, user)
    district = field.district or "Unknown"
    state    = field.state    or "Unknown"

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


@router.get("/{field_id}/soil", response_model=SoilResponse)
def get_soil(field_id: uuid.UUID, user: CurrentUser, conn: DbConn) -> SoilResponse:
    """Get the latest soil profile for a field."""
    return field_service.get_soil(conn, field_id, user)


@router.get("/{field_id}/history", response_model=list[dict])
def get_history(field_id: uuid.UUID, user: CurrentUser, conn: DbConn) -> list[dict]:
    """Get historical yield data for the field's district."""
    return field_service.get_history(conn, field_id, user)


@router.delete("/{field_id}", status_code=204)
def delete_field(field_id: uuid.UUID, user: CurrentUser, conn: DbConn) -> None:
    """Delete a field and all associated data."""
    field_service.delete_field(conn, field_id, user)
