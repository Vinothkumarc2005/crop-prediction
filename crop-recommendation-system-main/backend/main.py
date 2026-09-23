from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import numpy as np
import os
import logging
import httpx
from datetime import date, timedelta
from typing import Optional

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App Init ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Crop Recommendation API",
    description="AI-powered crop recommendation based on soil & climate parameters, NDVI, and weather patterns.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load Model ───────────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "best_model_crop.pkl")

try:
    model = joblib.load(MODEL_PATH)
    logger.info(f"Model loaded successfully from {MODEL_PATH}")
except FileNotFoundError:
    logger.error(f"Model file not found at {MODEL_PATH}")
    model = None

# Crop label mapping (encoded integers -> crop names, matching LabelEncoder order)
CROP_LABELS = [
    "banana", "blackgram", "chickpea", "kidneybeans",
    "lentil", "maize", "mothbeans", "mungbean",
    "pigeonpeas", "pomegranate", "rice"
]

# Ideal growing ranges for weather scoring
CROP_WEATHER_RANGES = {
    "banana":      {"temp_min": 20, "temp_max": 35, "rain_annual": 1500},
    "blackgram":   {"temp_min": 25, "temp_max": 35, "rain_annual": 800},
    "chickpea":    {"temp_min": 15, "temp_max": 29, "rain_annual": 450},
    "kidneybeans": {"temp_min": 18, "temp_max": 24, "rain_annual": 700},
    "lentil":      {"temp_min": 18, "temp_max": 30, "rain_annual": 375},
    "maize":       {"temp_min": 21, "temp_max": 30, "rain_annual": 650},
    "mothbeans":   {"temp_min": 24, "temp_max": 38, "rain_annual": 275},
    "mungbean":    {"temp_min": 28, "temp_max": 35, "rain_annual": 750},
    "pigeonpeas":  {"temp_min": 18, "temp_max": 30, "rain_annual": 800},
    "pomegranate": {"temp_min": 25, "temp_max": 35, "rain_annual": 375},
    "rice":        {"temp_min": 20, "temp_max": 35, "rain_annual": 1500},
}

# Crop seasons & 10-year optimal water requirements (mm)
CROP_SEASON_CONFIG = {
    "banana":      {"months": list(range(1, 13)), "optimal_rain": 1500, "season_name": "Year-round"},
    "blackgram":   {"months": [6, 7, 8, 9], "optimal_rain": 750, "season_name": "Kharif (Jun-Sep)"},
    "chickpea":    {"months": [10, 11, 12, 1, 2, 3], "optimal_rain": 450, "season_name": "Rabi (Oct-Mar)"},
    "kidneybeans": {"months": [5, 6, 7, 8, 9], "optimal_rain": 600, "season_name": "Kharif (May-Sep)"},
    "lentil":      {"months": [11, 12, 1, 2, 3], "optimal_rain": 380, "season_name": "Rabi (Nov-Mar)"},
    "maize":       {"months": [6, 7, 8, 9, 10], "optimal_rain": 700, "season_name": "Kharif (Jun-Oct)"},
    "mothbeans":   {"months": [7, 8, 9, 10], "optimal_rain": 300, "season_name": "Kharif (Jul-Oct)"},
    "mungbean":    {"months": [3, 4, 5, 6], "optimal_rain": 650, "season_name": "Zaid/Kharif (Mar-Jun)"},
    "pigeonpeas":  {"months": [6, 7, 8, 9, 10, 11, 12], "optimal_rain": 800, "season_name": "Kharif (Jun-Dec)"},
    "pomegranate": {"months": list(range(1, 13)), "optimal_rain": 500, "season_name": "Perennial (Annual)"},
    "rice":        {"months": [6, 7, 8, 9, 10, 11], "optimal_rain": 1350, "season_name": "Kharif (Jun-Nov)"},
}

# Market & Mandi price and cultivation economics benchmarks
CROP_MARKET_BENCHMARKS = {
    "banana":      {"modal_price": 2400, "forecast_price": 2680, "trend": "bullish", "yield_qtl_acre": 180.0, "cost_acre": 80000, "msp": None},
    "blackgram":   {"modal_price": 7200, "forecast_price": 7650, "trend": "bullish", "yield_qtl_acre": 6.5, "cost_acre": 16000, "msp": 7400},
    "chickpea":    {"modal_price": 5650, "forecast_price": 5980, "trend": "bullish", "yield_qtl_acre": 8.5, "cost_acre": 17000, "msp": 5440},
    "kidneybeans": {"modal_price": 9200, "forecast_price": 9800, "trend": "bullish", "yield_qtl_acre": 5.5, "cost_acre": 21000, "msp": None},
    "lentil":      {"modal_price": 6200, "forecast_price": 6500, "trend": "stable",  "yield_qtl_acre": 7.0, "cost_acre": 15000, "msp": 6425},
    "maize":       {"modal_price": 2280, "forecast_price": 2450, "trend": "bullish", "yield_qtl_acre": 28.0, "cost_acre": 22000, "msp": 2090},
    "mothbeans":   {"modal_price": 6800, "forecast_price": 7150, "trend": "stable",  "yield_qtl_acre": 4.8, "cost_acre": 10000, "msp": 6200},
    "mungbean":    {"modal_price": 8400, "forecast_price": 8850, "trend": "bullish", "yield_qtl_acre": 5.2, "cost_acre": 14000, "msp": 8558},
    "pigeonpeas":  {"modal_price": 9600, "forecast_price": 10400, "trend": "bullish", "yield_qtl_acre": 7.5, "cost_acre": 19000, "msp": 7550},
    "pomegranate": {"modal_price": 8500, "forecast_price": 9400, "trend": "bullish", "yield_qtl_acre": 45.0, "cost_acre": 95000, "msp": None},
    "rice":        {"modal_price": 2350, "forecast_price": 2480, "trend": "stable",  "yield_qtl_acre": 24.0, "cost_acre": 25000, "msp": 2300},
}

# ─── Schemas ──────────────────────────────────────────────────────────────────
class CropInput(BaseModel):
    N: float = Field(..., ge=0, le=200, description="Nitrogen content in soil (kg/ha)")
    P: float = Field(..., ge=0, le=200, description="Phosphorus content in soil (kg/ha)")
    K: float = Field(..., ge=0, le=200, description="Potassium content in soil (kg/ha)")
    temperature: float = Field(..., ge=-10, le=60, description="Temperature in °C")
    humidity: float = Field(..., ge=0, le=100, description="Relative humidity (%)")
    ph: float = Field(..., ge=0, le=14, description="Soil pH level")
    rainfall: float = Field(..., ge=0, le=500, description="Rainfall in mm")

    model_config = {
        "json_schema_extra": {
            "example": {
                "N": 90, "P": 42, "K": 43,
                "temperature": 20.8, "humidity": 82,
                "ph": 6.5, "rainfall": 202
            }
        }
    }


class PredictionResponse(BaseModel):
    recommended_crop: str
    confidence: float | None
    all_probabilities: dict[str, float] | None
    input_summary: dict


class WeatherRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    city: Optional[str] = None


class MarketProfitRequest(BaseModel):
    crop: str
    acres: float = 2.5


# ─── Helper: Compute crop weather score ───────────────────────────────────────
def compute_crop_weather_score(crop: str, avg_temp_6m: float, total_rain_6m: float) -> float:
    """Return 0–100 score how well forecast conditions suit a crop."""
    ranges = CROP_WEATHER_RANGES.get(crop)
    if not ranges:
        return 50.0

    t_mid = (ranges["temp_min"] + ranges["temp_max"]) / 2
    t_half = (ranges["temp_max"] - ranges["temp_min"]) / 2 + 5
    temp_score = max(0, 100 - abs(avg_temp_6m - t_mid) / t_half * 100)

    ideal_6m_rain = ranges["rain_annual"] / 2
    rain_score = max(0, 100 - abs(total_rain_6m - ideal_6m_rain) / (ideal_6m_rain + 1) * 100)

    return round(0.6 * temp_score + 0.4 * rain_score, 1)


# ─── Helper: Compute NDVI proxy ───────────────────────────────────────────────
def compute_ndvi_proxy(avg_precip_mm: float, avg_temp: float, avg_solar: float) -> dict:
    rain_score = min(avg_precip_mm / 150.0, 1.0)
    temp_score = max(0, 1 - abs(avg_temp - 25) / 25)
    solar_score = max(0, 1 - abs(avg_solar - 17) / 17)

    ndvi = round(0.5 * rain_score + 0.3 * temp_score + 0.2 * solar_score, 3)
    ndvi = max(0.0, min(1.0, ndvi))

    if ndvi < 0.2:
        category = "Poor"
        color = "#ef4444"
    elif ndvi < 0.4:
        category = "Fair"
        color = "#f59e0b"
    elif ndvi < 0.6:
        category = "Good"
        color = "#84cc16"
    else:
        category = "Excellent"
        color = "#22c55e"

    return {"score": ndvi, "category": category, "color": color}


# ─── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["System"])
def health_check():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "supported_crops": CROP_LABELS,
    }


@app.get("/api/geocode", tags=["Weather"])
async def geocode_city(city: str = Query(..., description="City name to geocode")):
    url = "https://geocoding-api.open-meteo.com/v1/search"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params={"name": city, "count": 1, "language": "en", "format": "json"})
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Geocoding service unavailable")
    data = resp.json()
    results = data.get("results", [])
    if not results:
        raise HTTPException(status_code=404, detail=f"City '{city}' not found")
    r = results[0]
    return {
        "city": r.get("name"),
        "country": r.get("country"),
        "lat": r["latitude"],
        "lon": r["longitude"],
        "timezone": r.get("timezone"),
    }


@app.post("/api/weather-analysis", tags=["Weather"])
async def weather_analysis(req: WeatherRequest):
    lat, lon = req.lat, req.lon
    today = date.today()
    forecast_end = today + timedelta(days=180)

    # 1. Fetch live 16-day high-resolution forecast
    forecast_url = "https://api.open-meteo.com/v1/forecast"
    forecast_params = {
        "latitude": lat,
        "longitude": lon,
        "daily": ["temperature_2m_max", "temperature_2m_min", "precipitation_sum", "relative_humidity_2m_max"],
        "forecast_days": 16,
        "timezone": "auto",
    }

    # 2. Fetch 10-year historical archive
    hist_end = date(today.year - 1, 12, 31)
    hist_start = date(today.year - 11, 1, 1)
    archive_url = "https://archive-api.open-meteo.com/v1/archive"
    archive_params = {
        "latitude": lat,
        "longitude": lon,
        "daily": ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"],
        "start_date": hist_start.isoformat(),
        "end_date": hist_end.isoformat(),
        "timezone": "auto",
    }

    # 3. Fetch NASA POWER for NDVI
    nasa_url = "https://power.larc.nasa.gov/api/temporal/monthly/point"
    nasa_end_year = today.year - 1
    nasa_start_year = today.year - 4
    nasa_params = {
        "parameters": "PRECTOTCORR,T2M,ALLSKY_SFC_SW_DWN",
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": f"{nasa_start_year}01",
        "end": f"{nasa_end_year}12",
        "format": "JSON",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            forecast_resp, archive_resp, nasa_resp = await _fetch_all(
                client, forecast_url, forecast_params, archive_url, archive_params, nasa_url, nasa_params
            )
        except Exception as e:
            logger.error(f"Weather API fetch failed: {e}")
            raise HTTPException(status_code=502, detail=f"Weather data fetch failed: {str(e)}")

    # ── Process 10-year historical archive first ──
    archive_data = archive_resp.json() if archive_resp.status_code == 200 else {}
    adaily = archive_data.get("daily", {})
    adates = adaily.get("time", [])
    atmax = adaily.get("temperature_2m_max", [])
    atmin = adaily.get("temperature_2m_min", [])
    arain = adaily.get("precipitation_sum", [])

    monthly_hist = {m: {"temps": [], "rains": []} for m in range(1, 13)}
    for i, d in enumerate(adates):
        month_num = int(d[5:7])
        if i < len(atmax) and atmax[i] is not None and i < len(atmin) and atmin[i] is not None:
            monthly_hist[month_num]["temps"].append((atmax[i] + atmin[i]) / 2)
        if i < len(arain) and arain[i] is not None:
            monthly_hist[month_num]["rains"].append(arain[i])

    month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    historical_10yr = []
    for m in range(1, 13):
        temps = monthly_hist[m]["temps"]
        rains = monthly_hist[m]["rains"]
        # Daily average rain in mm/day
        avg_rain_daily = round(float(np.mean(rains)), 2) if rains else 2.5
        historical_10yr.append({
            "month": month_names[m - 1],
            "avg_temp": round(float(np.mean(temps)), 1) if temps else 25.0,
            "avg_rain": avg_rain_daily,
        })

    trend_analysis = _compute_trend(adates, atmax, atmin, arain, today.year)
    ndvi_data = _compute_ndvi_from_nasa(nasa_resp)

    # ── Process live 16-day forecast & construct full 6-Month Forecast ──
    forecast_data = forecast_resp.json() if forecast_resp.status_code == 200 else {}
    daily = forecast_data.get("daily", {})

    temp_adj = trend_analysis.get("temp_delta", 0.0) if trend_analysis else 0.0
    rain_trend = trend_analysis.get("rainfall_trend", "stable") if trend_analysis else "stable"
    rain_factor = 1.08 if rain_trend == "increasing" else 0.92 if rain_trend == "decreasing" else 1.0

    forecast_6months = []
    for offset in range(6):
        # Calculate target month and year
        m_idx = (today.month - 1 + offset) % 12 + 1
        y_val = today.year + ((today.month - 1 + offset) // 12)
        ym = f"{y_val}-{m_idx:02d}"
        m_label = f"{month_names[m_idx - 1]} {y_val}"

        # 10-year historical baseline for this calendar month
        hist_temps = monthly_hist[m_idx]["temps"]
        hist_rains = monthly_hist[m_idx]["rains"]

        base_temp = float(np.mean(hist_temps)) if hist_temps else 25.0
        # Historical total monthly precipitation (approx sum across 10 years / 10)
        base_monthly_rain = (float(sum(hist_rains)) / 10.0) if hist_rains else 45.0

        est_temp = round(base_temp + (temp_adj * 0.4), 1)
        est_rain = round(base_monthly_rain * rain_factor, 1)

        # Estimate relative humidity realistically (higher during monsoon/rainy months)
        est_hum = round(min(92.0, max(42.0, 52.0 + (est_rain / 9.0) - (est_temp - 24.0) * 0.7)), 1)

        # For current month (offset 0), blend with live 16-day Open-Meteo forecast if available
        if offset == 0 and daily:
            live_tmax = daily.get("temperature_2m_max", [])
            live_tmin = daily.get("temperature_2m_min", [])
            live_rain = daily.get("precipitation_sum", [])
            live_hum = daily.get("relative_humidity_2m_max", [])
            if live_tmax and live_tmin:
                live_temps = [(live_tmax[j] + live_tmin[j]) / 2 for j in range(min(len(live_tmax), len(live_tmin))) if live_tmax[j] is not None and live_tmin[j] is not None]
                if live_temps:
                    est_temp = round((est_temp + float(np.mean(live_temps))) / 2, 1)
            if live_rain:
                valid_rains = [r for r in live_rain if r is not None]
                if valid_rains:
                    # 16-day rain scaled to full month
                    est_rain = round((est_rain + (float(sum(valid_rains)) * 1.8)) / 2, 1)
            if live_hum:
                valid_hum = [h for h in live_hum if h is not None]
                if valid_hum:
                    est_hum = round(float(np.mean(valid_hum)), 1)

        forecast_6months.append({
            "month": m_label,
            "ym": ym,
            "avg_temp": est_temp,
            "total_rain": est_rain,
            "avg_humidity": est_hum,
        })

    all_temps = [m["avg_temp"] for m in forecast_6months if m["avg_temp"] is not None]
    all_rains = [m["total_rain"] for m in forecast_6months if m["total_rain"] is not None]
    overall_avg_temp = round(float(np.mean(all_temps)), 1) if all_temps else 25.0
    overall_total_rain = round(float(sum(all_rains)), 1) if all_rains else 300.0

    # ── Compute crop weather scores ──
    crop_weather_scores = {}
    for crop in CROP_LABELS:
        crop_weather_scores[crop] = compute_crop_weather_score(crop, overall_avg_temp, overall_total_rain)

    # ── Compute 10-Year Historical Seasonal Rainfall for ALL 11 CROPS ──
    crop_10yr_rainfall = {}
    for crop in CROP_LABELS:
        cfg = CROP_SEASON_CONFIG.get(crop, {"months": [6, 7, 8, 9], "optimal_rain": 800, "season_name": "Kharif"})
        crop_months = set(cfg["months"])

        yearly_crop_rain = {}
        for i, d in enumerate(adates):
            yr = int(d[:4])
            mo = int(d[5:7])
            if mo in crop_months and i < len(arain) and arain[i] is not None:
                yearly_crop_rain[yr] = yearly_crop_rain.get(yr, 0.0) + arain[i]

        sorted_years = sorted(yearly_crop_rain.keys())
        yearly_list = [{"year": y, "rain": round(yearly_crop_rain[y], 1)} for y in sorted_years]
        avg_seasonal_rain = round(float(np.mean(list(yearly_crop_rain.values()))), 1) if yearly_crop_rain else cfg["optimal_rain"]
        opt = cfg["optimal_rain"]
        delta_pct = round(((avg_seasonal_rain - opt) / opt) * 100, 1)

        if delta_pct >= 10:
            sufficiency = "Surplus"
            desc = f"+{delta_pct}% rainfall surplus; low irrigation dependency."
        elif delta_pct >= -15:
            sufficiency = "Optimal"
            desc = "Rainfall aligns well with crop water requirements."
        elif delta_pct >= -35:
            sufficiency = "Moderate Deficit"
            desc = f"{abs(delta_pct)}% rainfall deficit; supplementary protective irrigation recommended."
        else:
            sufficiency = "High Deficit"
            desc = f"{abs(delta_pct)}% rainfall deficit; requires active drip or canal irrigation."

        crop_10yr_rainfall[crop] = {
            "season_name": cfg["season_name"],
            "optimal_rain": opt,
            "avg_10yr_rain": avg_seasonal_rain,
            "delta_pct": delta_pct,
            "sufficiency": sufficiency,
            "description": desc,
            "yearly_history": yearly_list[-10:],
        }

    return {
        "location": {"lat": lat, "lon": lon, "city": req.city},
        "ndvi": ndvi_data,
        "forecast_6months": forecast_6months,
        "overall_forecast": {
            "avg_temp": overall_avg_temp,
            "total_rain_6m": overall_total_rain,
        },
        "historical_10yr": historical_10yr,
        "trend_analysis": trend_analysis,
        "crop_weather_scores": crop_weather_scores,
        "crop_10yr_rainfall": crop_10yr_rainfall,
    }


# ─── Prediction endpoint ──────────────────────────────────────────────────────
@app.post("/api/predict", response_model=PredictionResponse, tags=["Prediction"])
def predict_crop(data: CropInput):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Please ensure best_model_crop.pkl is present."
        )

    features = np.array([[
        data.N, data.P, data.K,
        data.temperature, data.humidity,
        data.ph, data.rainfall
    ]])

    pred_index = int(model.predict(features)[0])
    recommended_crop = CROP_LABELS[pred_index]

    confidence = None
    all_probs = None
    if hasattr(model, "predict_proba"):
        try:
            proba = model.predict_proba(features)[0]
            confidence = round(float(proba[pred_index]) * 100, 2)
            all_probs = {
                CROP_LABELS[i]: round(float(p) * 100, 2)
                for i, p in enumerate(proba)
            }
        except Exception:
            pass

    logger.info(f"Prediction: {recommended_crop} (confidence: {confidence}%)")

    return PredictionResponse(
        recommended_crop=recommended_crop,
        confidence=confidence,
        all_probabilities=all_probs,
        input_summary={
            "N": data.N, "P": data.P, "K": data.K,
            "temperature": data.temperature,
            "humidity": data.humidity,
            "ph": data.ph,
            "rainfall": data.rainfall,
        }
    )


# ─── Market & Profit Endpoint ─────────────────────────────────────────────────
@app.post("/api/market-profit", tags=["Market"])
def get_market_profit(req: MarketProfitRequest):
    crop = req.crop.lower()
    benchmarks = CROP_MARKET_BENCHMARKS.get(crop, CROP_MARKET_BENCHMARKS["rice"])
    acres = max(0.1, req.acres)

    yield_per_acre = benchmarks["yield_qtl_acre"]
    harvest_price = benchmarks["forecast_price"]
    modal_price = benchmarks["modal_price"]
    cost_per_acre = benchmarks["cost_acre"]

    total_yield = round(yield_per_acre * acres, 2)
    gross_revenue = round(total_yield * harvest_price)
    total_cost = round(cost_per_acre * acres)
    net_profit = gross_revenue - total_cost
    roi = round((net_profit / total_cost) * 100, 1) if total_cost > 0 else 0

    return {
        "crop": crop,
        "acres": acres,
        "mandi_modal_price": modal_price,
        "forecast_harvest_price": harvest_price,
        "market_trend": benchmarks["trend"],
        "msp_floor": benchmarks.get("msp"),
        "yield_qtl_per_acre": yield_per_acre,
        "total_yield_qtl": total_yield,
        "gross_revenue": gross_revenue,
        "cost_per_acre": cost_per_acre,
        "total_cost": total_cost,
        "net_profit": net_profit,
        "net_profit_per_acre": round(net_profit / acres),
        "roi_pct": roi,
    }


# ─── Internal helpers ─────────────────────────────────────────────────────────
async def _fetch_all(client, forecast_url, forecast_params, archive_url, archive_params, nasa_url, nasa_params):
    import asyncio
    tasks = [
        client.get(forecast_url, params=forecast_params),
        client.get(archive_url, params=archive_params),
        client.get(nasa_url, params=nasa_params),
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            raise r
    return results


def _month_name(ym: str) -> str:
    names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    year, month = ym.split("-")
    return f"{names[int(month)-1]} {year}"


def _compute_trend(adates, atmax, atmin, arain, current_year):
    yearly = {}
    for i, d in enumerate(adates):
        yr = int(d[:4])
        if yr not in yearly:
            yearly[yr] = {"temps": [], "rains": []}
        if i < len(atmax) and atmax[i] is not None and i < len(atmin) and atmin[i] is not None:
            yearly[yr]["temps"].append((atmax[i] + atmin[i]) / 2)
        if i < len(arain) and arain[i] is not None:
            yearly[yr]["rains"].append(arain[i])

    years = sorted(yearly.keys())
    if len(years) < 6:
        return {"rainfall_trend": "stable", "temp_trend": "stable", "rainfall_delta": 0, "temp_delta": 0}

    early_years = years[:3]
    recent_years = years[-3:]

    early_rain = np.mean([sum(yearly[y]["rains"]) for y in early_years if yearly[y]["rains"]])
    recent_rain = np.mean([sum(yearly[y]["rains"]) for y in recent_years if yearly[y]["rains"]])
    rain_delta = round(float(recent_rain - early_rain), 1)

    early_temp = np.mean([np.mean(yearly[y]["temps"]) for y in early_years if yearly[y]["temps"]])
    recent_temp = np.mean([np.mean(yearly[y]["temps"]) for y in recent_years if yearly[y]["temps"]])
    temp_delta = round(float(recent_temp - early_temp), 2)

    rain_trend = "increasing" if rain_delta > 50 else "decreasing" if rain_delta < -50 else "stable"
    temp_trend = "warming" if temp_delta > 0.5 else "cooling" if temp_delta < -0.5 else "stable"

    return {
        "rainfall_trend": rain_trend,
        "temp_trend": temp_trend,
        "rainfall_delta": rain_delta,
        "temp_delta": temp_delta,
        "early_period": f"{early_years[0]}–{early_years[-1]}",
        "recent_period": f"{recent_years[0]}–{recent_years[-1]}",
    }


def _compute_ndvi_from_nasa(nasa_resp) -> dict:
    try:
        if hasattr(nasa_resp, "status_code") and nasa_resp.status_code != 200:
            return compute_ndvi_proxy(80, 25, 17)
        data = nasa_resp.json()
        params = data.get("properties", {}).get("parameter", {})
        precip_vals = list(params.get("PRECTOTCORR", {}).values())
        temp_vals = list(params.get("T2M", {}).values())
        solar_vals = list(params.get("ALLSKY_SFC_SW_DWN", {}).values())

        precip_vals = [v for v in precip_vals if v is not None and v > -990]
        temp_vals = [v for v in temp_vals if v is not None and v > -990]
        solar_vals = [v for v in solar_vals if v is not None and v > -990]

        avg_precip = float(np.mean(precip_vals)) * 30 if precip_vals else 80
        avg_temp = float(np.mean(temp_vals)) if temp_vals else 25
        avg_solar = float(np.mean(solar_vals)) if solar_vals else 17

        return compute_ndvi_proxy(avg_precip, avg_temp, avg_solar)
    except Exception as e:
        logger.warning(f"NASA POWER parse failed: {e}, using defaults")
        return compute_ndvi_proxy(80, 25, 17)
