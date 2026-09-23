"""
WeatherService — synthetic 10-year weather history and 6-month forecast.

Generates realistic monthly weather data per (district, state) using
Indian seasonal climate patterns:
  • Kharif season (Jun–Oct): monsoon rainfall, high humidity
  • Rabi season  (Nov–Mar): dry cool weather
  • Zaid season  (Apr–May): hot, low rainfall

Data is stored in the weather_readings table and fetched from there on
subsequent calls. Provider pattern mirrors ndvi_service (mock by default).

Key outputs
-----------
get_weather_history()   – list of monthly records for the past N years
get_weather_forecast()  – 6-month forward projection with confidence
get_weather_summary()   – season-averaged stats + drought risk score
"""
from __future__ import annotations

import logging
import math
import random
import uuid
from datetime import date
from typing import Any

import psycopg

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── District climate baselines ────────────────────────────────────────────────
# Each entry: { month→(rainfall_mm, tmax, tmin, humidity) } tuned to real IMD normals
_DISTRICT_BASELINES: dict[str, dict[str, Any]] = {
    "nashik": {
        "annual_rain": 690,
        "temp_max_base": [27, 30, 34, 38, 38, 32, 28, 27, 29, 32, 30, 27],
        "temp_min_base": [10, 12, 17, 22, 25, 23, 21, 20, 20, 18, 13, 10],
        "humidity_base": [45, 40, 35, 30, 35, 72, 85, 88, 80, 60, 50, 45],
        "rain_dist":     [3, 2, 4, 8, 22, 110, 165, 160, 90, 80, 30, 16],
    },
    "amritsar": {
        "annual_rain": 645,
        "temp_max_base": [19, 21, 27, 35, 40, 40, 36, 34, 34, 33, 26, 19],
        "temp_min_base": [4,  6,  11, 18, 23, 27, 27, 26, 22, 14, 8,  4 ],
        "humidity_base": [65, 55, 45, 30, 25, 35, 60, 70, 55, 40, 55, 65],
        "rain_dist":     [24, 22, 22, 10, 12, 25, 110, 130, 70, 12, 5, 20],
    },
    "guntur": {
        "annual_rain": 980,
        "temp_max_base": [30, 33, 37, 40, 40, 36, 32, 31, 32, 33, 31, 29],
        "temp_min_base": [20, 21, 24, 28, 29, 28, 26, 26, 26, 25, 22, 20],
        "humidity_base": [65, 60, 55, 55, 60, 65, 78, 80, 80, 75, 70, 65],
        "rain_dist":     [10, 8, 12, 18, 30, 60, 90, 110, 160, 180, 90, 30],
    },
    "pune": {
        "annual_rain": 622,
        "temp_max_base": [30, 33, 37, 38, 37, 31, 28, 27, 29, 31, 30, 29],
        "temp_min_base": [12, 14, 18, 22, 24, 23, 21, 21, 21, 19, 15, 12],
        "humidity_base": [42, 38, 32, 30, 35, 70, 84, 87, 80, 62, 48, 43],
        "rain_dist":     [4, 2, 3, 8, 18, 90, 130, 120, 80, 75, 30, 10],
    },
}

_DEFAULT_BASELINE = {
    "annual_rain": 700,
    "temp_max_base": [28, 31, 35, 38, 38, 32, 29, 28, 30, 32, 30, 28],
    "temp_min_base": [12, 14, 18, 22, 25, 24, 22, 21, 21, 18, 14, 11],
    "humidity_base": [55, 48, 42, 36, 40, 68, 82, 85, 78, 62, 52, 55],
    "rain_dist":     [8, 5, 8, 12, 22, 90, 140, 145, 100, 90, 35, 18],
}


def _get_baseline(district: str | None) -> dict[str, Any]:
    key = (district or "").lower()
    return _DISTRICT_BASELINES.get(key, _DEFAULT_BASELINE)


def ensure_weather_seeded(
    conn: psycopg.Connection,
    district: str | None,
    state: str | None,
    years: int = 10,
) -> None:
    """
    Seed 10 years of monthly weather data if not yet present.
    Called once per district when weather data is first requested.
    """
    district = district or "Unknown"
    state = state or "Unknown"
    current_year = date.today().year

    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) as cnt FROM weather_readings WHERE LOWER(district)=LOWER(%s) AND LOWER(state)=LOWER(%s)",
            (district, state),
        )
        row = cur.fetchone()
        if row and (row.get("cnt") or 0) >= years * 12:
            return  # already seeded

    logger.info("Seeding %d years of weather data for %s, %s", years, district, state)
    baseline = _get_baseline(district)
    rng = random.Random(hash(f"{district}_{state}"))

    rows: list[dict] = []
    for year_offset in range(years):
        year = current_year - years + year_offset + 1  # e.g. 2016..2025
        # Inter-annual variation: slight warming trend (~0.03°C/yr) + rainfall anomaly
        warming = year_offset * 0.03
        rain_anomaly = rng.gauss(1.0, 0.12)  # multiplicative factor

        for month in range(1, 13):
            idx = month - 1
            base_rain = baseline["rain_dist"][idx]
            tmax = baseline["temp_max_base"][idx] + warming + rng.gauss(0, 0.8)
            tmin = baseline["temp_min_base"][idx] + warming + rng.gauss(0, 0.6)
            rain = max(0.0, base_rain * rain_anomaly + rng.gauss(0, base_rain * 0.15))
            humid = min(98, max(20, baseline["humidity_base"][idx] + rng.gauss(0, 4)))
            # Solar radiation — higher in clear months
            solar_base = 18.0 - 6.0 * math.sin(math.pi * (month - 1) / 6)
            solar = max(8.0, solar_base + rng.gauss(0, 1.5))
            # Hargreaves ET0 approx
            et0 = 0.0023 * (tmax - tmin) ** 0.5 * ((tmax + tmin) / 2 + 17.8) * solar * 0.408
            et0 = max(1.0, et0)
            rows.append({
                "district": district,
                "state": state,
                "year": year,
                "month": month,
                "rainfall_mm": round(rain, 2),
                "temp_max_c": round(tmax, 2),
                "temp_min_c": round(tmin, 2),
                "humidity_pct": round(humid, 2),
                "solar_rad_mj": round(solar, 2),
                "et0_mm": round(et0, 2),
                "source": "mock",
            })

    if not rows:
        return

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO weather_readings
              (district, state, year, month, rainfall_mm, temp_max_c, temp_min_c,
               humidity_pct, solar_rad_mj, et0_mm, source)
            VALUES
              (%(district)s, %(state)s, %(year)s, %(month)s, %(rainfall_mm)s,
               %(temp_max_c)s, %(temp_min_c)s, %(humidity_pct)s,
               %(solar_rad_mj)s, %(et0_mm)s, %(source)s)
            ON CONFLICT (district, state, year, month, source) DO NOTHING
            """,
            rows,
        )
    conn.commit()
    logger.debug("Seeded %d weather records for %s", len(rows), district)


def get_weather_history(
    conn: psycopg.Connection,
    district: str | None,
    state: str | None,
    years: int = 10,
) -> list[dict]:
    """Return monthly weather records for the past `years` years (oldest first)."""
    ensure_weather_seeded(conn, district, state, years)
    district = district or "Unknown"
    state = state or "Unknown"
    current_year = date.today().year
    from_year = current_year - years + 1

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT year, month, rainfall_mm, temp_max_c, temp_min_c,
                   humidity_pct, solar_rad_mj, et0_mm
            FROM weather_readings
            WHERE LOWER(district)=LOWER(%s) AND LOWER(state)=LOWER(%s)
              AND year >= %s
            ORDER BY year ASC, month ASC
            """,
            (district, state, from_year),
        )
        rows = cur.fetchall()

    result = []
    for r in rows:
        result.append({
            "year":         r["year"],
            "month":        r["month"],
            "yearMonth":    f"{r['year']}-{r['month']:02d}",
            "rainfallMm":   float(r["rainfall_mm"] or 0),
            "tempMaxC":     float(r["temp_max_c"]  or 0),
            "tempMinC":     float(r["temp_min_c"]  or 0),
            "tempAvgC":     round((float(r["temp_max_c"] or 0) + float(r["temp_min_c"] or 0)) / 2, 2),
            "humidityPct":  float(r["humidity_pct"] or 0),
            "solarRadMj":   float(r["solar_rad_mj"] or 0),
            "et0Mm":        float(r["et0_mm"] or 0),
            "isForecast":   False,
        })
    return result


def get_weather_forecast(
    district: str | None,
    state: str | None,
    months: int = 6,
    history: list[dict] | None = None,
) -> list[dict]:
    """
    Generate `months` months of forward weather forecast.

    Method:
      1. Use last 10 years of the same calendar month as historical mean
      2. Apply inter-annual trend (warming of ~0.03°C/yr)
      3. Add small noise for uncertainty
    Returns list with isForecast=True and confidenceBand (low/high).
    """
    district = district or "Unknown"
    baseline = _get_baseline(district)
    today = date.today()
    rng = random.Random(hash(f"forecast_{district}_{today.year}_{today.month}"))

    result = []
    for i in range(months):
        total_months = today.month - 1 + i + 1
        yr = today.year + (total_months - 1) // 12
        mo = ((total_months - 1) % 12) + 1
        idx = mo - 1
        warming_trend = 0.03 * (yr - 2015)  # warming since baseline year

        base_rain = baseline["rain_dist"][idx]
        rain_mean = base_rain
        rain_std = max(5.0, base_rain * 0.18)
        rain_fc = max(0.0, rain_mean + rng.gauss(0, rain_std * 0.5))

        tmax_fc = baseline["temp_max_base"][idx] + warming_trend + rng.gauss(0, 0.5)
        tmin_fc = baseline["temp_min_base"][idx] + warming_trend + rng.gauss(0, 0.4)
        humid_fc = min(98, max(20, baseline["humidity_base"][idx] + rng.gauss(0, 3)))
        solar_base = 18.0 - 6.0 * math.sin(math.pi * (mo - 1) / 6)
        solar_fc = max(8.0, solar_base + rng.gauss(0, 1.0))

        result.append({
            "year":            yr,
            "month":           mo,
            "yearMonth":       f"{yr}-{mo:02d}",
            "rainfallMm":      round(rain_fc, 2),
            "rainfallLow":     round(max(0, rain_fc - rain_std), 2),
            "rainfallHigh":    round(rain_fc + rain_std, 2),
            "tempMaxC":        round(tmax_fc, 2),
            "tempMinC":        round(tmin_fc, 2),
            "tempAvgC":        round((tmax_fc + tmin_fc) / 2, 2),
            "tempAvgHigh":     round((tmax_fc + tmin_fc) / 2 + 1.5, 2),
            "tempAvgLow":      round((tmax_fc + tmin_fc) / 2 - 1.5, 2),
            "humidityPct":     round(humid_fc, 2),
            "solarRadMj":      round(solar_fc, 2),
            "isForecast":      True,
        })
    return result


def get_weather_summary(
    conn: psycopg.Connection,
    district: str | None,
    state: str | None,
    season: str = "Kharif",
) -> dict:
    """
    Compute season-averaged weather stats and drought risk score.

    Kharif months: Jun–Oct (6–10)
    Rabi months:   Nov–Mar (11–3)

    Returns:
      avgRainfallMm, avgTempC, droughtRiskScore (0–1), rainfallAnomaly,
      warmingTrendC, historicalYears
    """
    ensure_weather_seeded(conn, district, state, 10)
    district = district or "Unknown"
    state = state or "Unknown"

    if "rabi" in season.lower():
        season_months = [11, 12, 1, 2, 3]
    else:
        season_months = [6, 7, 8, 9, 10]

    month_placeholders = ",".join(["%s"] * len(season_months))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT year, month, rainfall_mm, temp_max_c, temp_min_c, et0_mm
            FROM weather_readings
            WHERE LOWER(district)=LOWER(%s) AND LOWER(state)=LOWER(%s)
              AND month IN ({month_placeholders})
            ORDER BY year ASC, month ASC
            """,
            [district, state] + season_months,
        )
        rows = cur.fetchall()

    if not rows:
        return {
            "avgRainfallMm":    120.0,
            "avgTempC":         28.0,
            "droughtRiskScore": 0.2,
            "rainfallAnomaly":  0.0,
            "warmingTrendC":    0.0,
            "historicalYears":  0,
        }

    rains = [float(r["rainfall_mm"] or 0) for r in rows]
    temps = [(float(r["temp_max_c"] or 0) + float(r["temp_min_c"] or 0)) / 2 for r in rows]
    et0s  = [float(r["et0_mm"] or 0) for r in rows]

    avg_rain = sum(rains) / len(rains)
    avg_temp = sum(temps) / len(temps)
    avg_et0  = sum(et0s)  / len(et0s)

    # Compute per-year averages for trend
    years_data: dict[int, list[float]] = {}
    for r in rows:
        yr = r["year"]
        years_data.setdefault(yr, []).append(float(r["rainfall_mm"] or 0))
    yearly_means = [(yr, sum(v) / len(v)) for yr, v in sorted(years_data.items())]
    n = len(yearly_means)

    # Linear trend (simple least squares)
    warming_trend = 0.0
    if n >= 3:
        xs = list(range(n))
        ys = [v for _, v in yearly_means]
        x_mean = sum(xs) / n
        y_mean = sum(ys) / n
        num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
        den = sum((x - x_mean) ** 2 for x in xs) or 1e-9
        rain_trend_per_yr = num / den
        rain_anomaly = round(rain_trend_per_yr * 10, 1)  # 10-year anomaly
    else:
        rain_anomaly = 0.0

    # Drought risk: based on rainfall vs ET0 ratio
    # Ratio < 0.5 → HIGH drought risk; > 1.5 → LOW
    ratio = avg_rain / (avg_et0 * len(season_months) + 1e-9)
    drought_risk = max(0.0, min(1.0, 1.0 - ratio * 0.5))

    return {
        "avgRainfallMm":    round(avg_rain, 1),
        "avgTempC":         round(avg_temp, 1),
        "droughtRiskScore": round(drought_risk, 3),
        "droughtRiskLabel": _drought_label(drought_risk),
        "rainfallAnomaly":  rain_anomaly,
        "warmingTrendC":    round((avg_temp - temps[0]) if len(temps) > 1 else 0, 2),
        "historicalYears":  n,
        "seasonRainfallTotal": round(avg_rain * len(season_months), 1),
    }


def _drought_label(score: float) -> str:
    if score < 0.2:
        return "LOW"
    if score < 0.45:
        return "MODERATE"
    if score < 0.7:
        return "HIGH"
    return "SEVERE"
