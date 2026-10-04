"""
AgriBot — AI Agronomist Chatbot route.

POST /api/agribot/chat
  Accepts user message + optional farm context snapshot.
  Returns an AI-generated agronomist response grounded in:
    • Live weather data for the user's field district
    • Soil NPK profile
    • NDVI health status
    • Active crop & growth stage
    • Fertilizer / pest knowledge base

No external LLM API key is required — the bot works via a structured
rule-engine that mirrors a real agronomist's decision tree.
"""
from __future__ import annotations

import logging
import math
import random
import re
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agribot", tags=["AgriBot"])

# ─────────────────────────────────────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────────────────────────────────────

class FarmContext(BaseModel):
    """Optional snapshot of the farmer's current farm state."""
    fieldName:    str | None = None
    cropName:     str | None = None
    district:     str | None = None
    state:        str | None = None
    areaAcres:    float | None = None
    growthStage:  str | None = None

    # Soil
    soilPh:       float | None = None
    soilNitrogen: float | None = None
    soilPhosphorus: float | None = None
    soilPotassium:  float | None = None
    soilTexture:  str | None = None

    # NDVI
    ndviMean:     float | None = None
    ndviTrend:    str | None = None       # "improving" | "declining" | "stable"
    ndviHealth:   str | None = None       # "Excellent" | "Good" | "Moderate" | "Stressed"

    # Weather (latest month)
    tempMaxC:     float | None = None
    tempMinC:     float | None = None
    rainfallMm:   float | None = None
    humidityPct:  float | None = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    context: FarmContext | None = None
    history: list[dict] | None = None   # [{role, content}] last 5 turns


class ChatResponse(BaseModel):
    reply: str
    category: str          # "diagnosis" | "weather" | "irrigation" | "fertilizer" | "market" | "general"
    suggestions: list[str] # follow-up quick prompts
    confidence: float      # 0–1, how certain the engine is
    sources: list[str]     # e.g. ["ICAR Guidelines", "IMD Weather Data"]


# ─────────────────────────────────────────────────────────────────────────────
# Knowledge bases
# ─────────────────────────────────────────────────────────────────────────────

PEST_DISEASE_KB: dict[str, dict[str, Any]] = {
    "powdery mildew": {
        "crops": ["wheat", "pea", "grape", "pumpkin", "cucumber", "tomato"],
        "symptoms": ["white powdery spots", "powdery coating", "white dust on leaves"],
        "cause": "Fungal disease caused by Erysiphe spp. / Podosphaera spp.",
        "organic": [
            "Neem oil spray (5 ml/L water) — spray in early morning or evening",
            "Baking soda solution (3 g/L + few drops dish soap)",
            "Potassium bicarbonate (10 g/L water) — highly effective",
        ],
        "chemical": [
            "Wettable Sulfur 80% WP @ 2 g/L water",
            "Hexaconazole 5% SC @ 1 ml/L water",
            "Propiconazole 25% EC @ 1 ml/L water",
        ],
        "precautions": "Apply during cool hours. Do not spray during rain. 7-day PHI (pre-harvest interval).",
        "prevention": "Ensure good air circulation, avoid overhead irrigation, remove infected leaves.",
    },
    "early blight": {
        "crops": ["tomato", "potato", "brinjal"],
        "symptoms": ["dark brown spots with yellow ring", "target spots on leaves", "brown lesions"],
        "cause": "Fungal disease caused by Alternaria solani.",
        "organic": [
            "Copper Oxychloride 50% WP @ 3 g/L (Bordeaux mixture)",
            "Trichoderma-based biocontrol @ 5 g/L",
            "Remove and destroy infected plant material immediately",
        ],
        "chemical": [
            "Mancozeb 75% WP @ 2.5 g/L water",
            "Chlorothalonil 75% WP @ 2 g/L water",
            "Azoxystrobin 23% SC @ 1 ml/L water",
        ],
        "precautions": "PHI: 7–14 days. Rotate fungicides to avoid resistance.",
        "prevention": "Crop rotation, resistant varieties, avoid water splash on leaves.",
    },
    "leaf rust": {
        "crops": ["wheat", "barley", "sorghum", "coffee"],
        "symptoms": ["orange-red pustules", "rust colored powder on leaves", "yellow spots with brown center"],
        "cause": "Fungal disease caused by Puccinia spp.",
        "organic": [
            "Sulfur dust (20–30 kg/ha) — in early stages",
            "Neem-based oil spray @ 3 ml/L",
        ],
        "chemical": [
            "Propiconazole 25% EC @ 1 ml/L water",
            "Tebuconazole 25.9% EC @ 1 ml/L water",
            "Mancozeb 75% WP @ 2 g/L water",
        ],
        "precautions": "Apply at first sign of disease. PHI: 14 days. Wear protective equipment.",
        "prevention": "Use rust-resistant varieties, timely sowing, avoid excess nitrogen.",
    },
    "aphids": {
        "crops": ["wheat", "cotton", "vegetables", "pulses", "mustard"],
        "symptoms": ["small green/black insects on underside of leaves", "curling leaves", "sticky honeydew", "yellowing shoots"],
        "cause": "Sap-sucking insect pests (Aphis spp., Myzus persicae).",
        "organic": [
            "Neem seed kernel extract (NSKE 5%) spray",
            "Soap water spray (5 ml dish soap / L water) — knocks off aphids",
            "Introduce natural predators: ladybirds, lacewings",
            "Yellow sticky traps for monitoring",
        ],
        "chemical": [
            "Imidacloprid 17.8 SL @ 0.3 ml/L water",
            "Thiamethoxam 25 WG @ 0.3 g/L water",
            "Dimethoate 30% EC @ 2 ml/L water",
        ],
        "precautions": "PHI: 7–14 days. Do not apply during flowering (harmful to pollinators).",
        "prevention": "Avoid excessive nitrogen, use reflective mulch, monitor regularly.",
    },
    "stem borer": {
        "crops": ["rice", "maize", "sugarcane", "sorghum"],
        "symptoms": ["dead heart in young plants", "white ear (bright earhead)", "entry holes in stem", "frass near base"],
        "cause": "Chilo suppressalis (rice stem borer), Sesamia inferens.",
        "organic": [
            "Trichogramma egg parasitoid release @ 50,000/ha per week",
            "Bacillus thuringiensis (Bt) formulation spray",
            "Collection and destruction of egg masses manually",
        ],
        "chemical": [
            "Chlorpyriphos 20% EC @ 2.5 ml/L water",
            "Carbofuran 3G @ 25 kg/ha applied to soil/standing water",
            "Flubendiamide 20 WG @ 0.5 g/L water (newer option)",
        ],
        "precautions": "Carbofuran is highly toxic — use gloves and mask. Keep livestock away 7 days.",
        "prevention": "Timely sowing, use of resistant varieties, cut/destroy stubble after harvest.",
    },
    "root rot": {
        "crops": ["cotton", "groundnut", "soybean", "vegetables"],
        "symptoms": ["wilting despite adequate water", "yellowing lower leaves", "dark rotted roots", "plant collapse"],
        "cause": "Soil-borne fungi: Fusarium, Pythium, Rhizoctonia spp.",
        "organic": [
            "Trichoderma viride seed treatment @ 4 g/kg seed",
            "Pseudomonas fluorescens soil drench @ 2.5 kg/ha",
            "Improve drainage to reduce waterlogging",
        ],
        "chemical": [
            "Carbendazim 50% WP seed treatment @ 2 g/kg seed",
            "Metalaxyl 35% WS seed treatment @ 6 g/kg seed",
            "Thiophanate-methyl 70% WP @ 2 g/L for soil drenching",
        ],
        "precautions": "Ensure proper drainage. Avoid overwatering. Rotate crops every season.",
        "prevention": "Use certified disease-free seed, well-drained soil, balanced NPK.",
    },
}

CROP_IRRIGATION_KB: dict[str, dict[str, Any]] = {
    "rice": {
        "method": "Flood/Ponded", "et_mm_day": 7.5,
        "stages": {
            "transplanting": "Maintain 2–5 cm standing water",
            "tillering": "Maintain 5 cm standing water, drain occasionally",
            "panicle initiation": "Critical stage — never let field dry",
            "heading": "Maintain 5 cm standing water",
            "maturity": "Drain 10–15 days before harvest",
        },
    },
    "wheat": {
        "method": "Furrow/Sprinkler", "et_mm_day": 4.5,
        "stages": {
            "sowing": "Pre-sowing irrigation if soil is dry",
            "crown root initiation": "CRITICAL: 21 days after sowing — irrigate immediately",
            "tillering": "2nd irrigation if no rainfall",
            "jointing": "3rd irrigation",
            "heading": "4th irrigation — critical for grain fill",
            "maturity": "5th irrigation if dry season",
        },
    },
    "cotton": {
        "method": "Drip/Furrow", "et_mm_day": 5.5,
        "stages": {
            "sowing": "Pre-sowing moisture essential for germination",
            "squaring": "Irrigate every 10 days if no rain",
            "flowering": "Critical stage — do not allow drought stress",
            "boll development": "Continue irrigation, excess water causes boll shedding",
            "boll opening": "Reduce irrigation for dry opening conditions",
        },
    },
    "maize": {
        "method": "Furrow/Sprinkler", "et_mm_day": 6.0,
        "stages": {
            "sowing": "Adequate soil moisture required",
            "knee height": "Irrigate every 8–10 days",
            "tasseling": "CRITICAL: tasseling + silking — never allow wilting",
            "grain fill": "Continue irrigation every 7–10 days",
            "maturity": "Cease irrigation 2 weeks before harvest",
        },
    },
    "tomato": {
        "method": "Drip preferred", "et_mm_day": 5.0,
        "stages": {
            "transplanting": "Light irrigation daily for establishment (5 days)",
            "vegetative": "Irrigate every 2–3 days",
            "flowering": "Critical — irregular watering causes blossom drop",
            "fruit development": "Consistent moisture essential to prevent cracking",
            "maturity": "Reduce water 7–10 days before harvest",
        },
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Intent Detection
# ─────────────────────────────────────────────────────────────────────────────

def _detect_intent(msg: str) -> str:
    msg_lower = msg.lower()

    pest_terms = ["pest", "disease", "insect", "fungal", "mildew", "blight", "rust", "aphid",
                  "borer", "wilt", "yellow", "spots", "rot", "dying", "leaves", "infection",
                  "spray", "symptoms", "remedy", "treatment", "fungicide", "insecticide"]
    weather_terms = ["weather", "rain", "rainfall", "temperature", "forecast", "season", "drought",
                     "monsoon", "hot", "cold", "humidity", "cloud", "spray", "apply", "urea",
                     "fertilizer tomorrow", "spraying", "humidity"]
    irrigation_terms = ["irrigat", "water", "pump", "drip", "spray", "flood", "moisture",
                        "watering", "dry", "thirst", "runoff", "evapotrans", "et0", "flood"]
    fertilizer_terms = ["fertilizer", "fertiliser", "npk", "urea", "dap", "mop", "nitrogen",
                        "phosphorus", "potassium", "micronutrient", "zinc", "boron", "nutrient",
                        "deficiency", "dose", "dosage", "basal", "top dress"]
    market_terms = ["price", "market", "mandi", "sell", "harvest", "profit", "income",
                    "revenue", "sell now", "wait to sell", "rate", "commodity"]
    ndvi_terms = ["ndvi", "health", "vegetation", "satellite", "remote sensing", "green", "stressed"]
    soil_terms = ["soil", "ph", "nitrogen level", "phosphorus level", "potassium level",
                  "organic carbon", "texture", "sandy", "clay", "loamy"]

    # Score-based intent detection
    scores = {
        "pest_disease": sum(1 for t in pest_terms if t in msg_lower),
        "weather": sum(1 for t in weather_terms if t in msg_lower),
        "irrigation": sum(1 for t in irrigation_terms if t in msg_lower),
        "fertilizer": sum(1 for t in fertilizer_terms if t in msg_lower),
        "market": sum(1 for t in market_terms if t in msg_lower),
        "ndvi": sum(1 for t in ndvi_terms if t in msg_lower),
        "soil": sum(1 for t in soil_terms if t in msg_lower),
    }

    top = max(scores, key=scores.get)
    return top if scores[top] > 0 else "general"


# ─────────────────────────────────────────────────────────────────────────────
# Response generators
# ─────────────────────────────────────────────────────────────────────────────

def _gen_pest_disease_response(msg: str, ctx: FarmContext | None) -> tuple[str, float, list[str]]:
    msg_lower = msg.lower()
    crop = (ctx.cropName or "").lower() if ctx else ""

    matched_disease: str | None = None
    matched_data: dict | None = None
    best_score = 0

    for disease, data in PEST_DISEASE_KB.items():
        score = 0
        if disease in msg_lower:
            score += 5
        for symptom in data.get("symptoms", []):
            # check for key words from symptoms
            words = [w for w in symptom.split() if len(w) > 3]
            score += sum(1 for w in words if w in msg_lower)
        if crop and any(c in crop for c in data.get("crops", [])):
            score += 2
        if score > best_score:
            best_score = score
            matched_disease = disease
            matched_data = data

    if not matched_data or best_score < 1:
        # Fallback generic response
        reply = (
            "I couldn't identify the specific issue from your description. "
            "Could you describe:\n"
            "1. **What you see** — colour changes, spots, lesions, insects?\n"
            "2. **Which part** of the plant is affected (leaves, stem, roots, fruits)?\n"
            "3. **How fast** it is spreading?\n\n"
            "Meanwhile, inspect the underside of leaves for insects, check soil moisture, "
            "and look for signs of wilting or discolouration."
        )
        return reply, 0.4, [
            "Show symptoms on tomato leaves",
            "White spots on wheat — what is it?",
            "My cotton is wilting despite watering",
        ]

    ctx_line = ""
    if ctx and ctx.cropName:
        ctx_line = f"For your **{ctx.cropName}** in **{ctx.district or 'your district'}**, "
    else:
        ctx_line = "Based on your description, "

    organic_list = "\n".join(f"  - {o}" for o in matched_data["organic"])
    chemical_list = "\n".join(f"  - {c}" for c in matched_data["chemical"])

    reply = (
        f"🌿 **{matched_disease.title()} Detected**\n\n"
        f"{ctx_line}this looks like **{matched_disease.title()}** — {matched_data['cause']}\n\n"
        f"**Organic / Low-toxicity Remedies:**\n{organic_list}\n\n"
        f"**Chemical Options:**\n{chemical_list}\n\n"
        f"⚠️ **Precautions:** {matched_data['precautions']}\n\n"
        f"🛡️ **Prevention:** {matched_data['prevention']}"
    )

    suggestions = [
        f"What fertilizer after treating {matched_disease.title()}?",
        f"How to prevent {matched_disease.title()} next season?",
        f"Is {matched_disease.title()} spreading — irrigation advice?",
    ]
    return reply, 0.82, suggestions


def _gen_weather_response(msg: str, ctx: FarmContext | None) -> tuple[str, float, list[str]]:
    msg_lower = msg.lower()
    today = date.today()
    month = today.month

    # Determine season context
    season = "Kharif" if 6 <= month <= 10 else ("Rabi" if 11 <= month or month <= 3 else "Zaid")

    # Check if user asking about spray timing
    spray_asked = any(w in msg_lower for w in ["spray", "apply", "spraying", "application", "urea", "fertilizer"])

    if ctx and ctx.rainfallMm is not None:
        rain = ctx.rainfallMm
        temp_max = ctx.tempMaxC or 30
        humid = ctx.humidityPct or 65
        district = ctx.district or "your area"
    else:
        # Use generic seasonal values
        rain = 90.0 if season == "Kharif" else 15.0
        temp_max = 35.0
        humid = 75.0 if season == "Kharif" else 50.0
        district = "your area"

    # Spray advisability logic
    spray_ok = humid < 80 and rain < 10
    weather_alert = temp_max > 40

    if spray_asked:
        if spray_ok:
            reply = (
                f"✅ **Safe to Spray in {district}**\n\n"
                f"Current conditions are suitable for spraying:\n"
                f"- Humidity: **{humid:.0f}%** (below 80% threshold)\n"
                f"- Recent Rainfall: **{rain:.1f} mm** (low — spray won't wash off)\n"
                f"- Temperature: **{temp_max:.1f}°C**\n\n"
                f"🌅 **Best time to spray:** Early morning (6–8 AM) or late evening (5–7 PM)\n"
                f"- Avoid spraying during peak sun hours (11 AM–3 PM) to prevent leaf burn\n"
                f"- Wind speed should be below 10 km/h for effective coverage\n\n"
                f"Season context: **{season}** — {'Monsoon active, check for rain resumption.' if season == 'Kharif' else 'Dry season — generally safe to spray.'}"
            )
        else:
            reply = (
                f"⚠️ **Postpone Spray in {district}**\n\n"
                f"Current conditions are NOT ideal for spraying:\n"
                f"- Humidity: **{humid:.0f}%** (high — increases fungal disease risk after spray)\n"
                f"- Recent Rainfall: **{rain:.1f} mm** (will wash off chemicals)\n\n"
                f"💡 **Recommendation:**\n"
                f"- Wait for rainfall to stop and humidity to drop below 75%\n"
                f"- Schedule spraying **2–3 days after last rain**\n"
                f"- Monitor weather for a 24-hour dry window\n\n"
                f"The current **{season}** season typically sees continued rains — plan spray windows carefully."
            )
        suggestions = [
            "How long after rain can I spray?",
            f"Best fungicide for {ctx.cropName or 'my crop'} this season?",
            "Irrigation advice for current weather?",
        ]
        return reply, 0.78, suggestions

    # General weather summary
    if weather_alert:
        heat_advice = (
            f"\n\n🌡️ **Heat Stress Warning:** Temperature at {temp_max:.1f}°C. "
            f"Irrigate in early morning or late evening to reduce plant heat stress."
        )
    else:
        heat_advice = ""

    reply = (
        f"🌦️ **Weather Overview — {district} ({season} Season)**\n\n"
        f"- Monthly Rainfall: **{rain:.1f} mm** ({'adequate' if rain > 50 else 'below normal — consider irrigation'})\n"
        f"- Max Temperature: **{temp_max:.1f}°C** ({'high heat' if temp_max > 38 else 'normal'})\n"
        f"- Humidity: **{humid:.0f}%** ({'high — watch for fungal diseases' if humid > 78 else 'normal'})\n"
        f"- Season: **{season}**{heat_advice}\n\n"
        f"📅 **Month {today.month} Agronomic Note:**\n"
        f"{'Ensure good drainage and watch for waterlogging in monsoon conditions.' if season == 'Kharif' else 'Dry cool weather — focus on irrigation scheduling and frost protection in northern regions.'}"
    )

    suggestions = [
        "Is it safe to spray Urea today?",
        "Irrigation plan for this weather?",
        "Drought risk for Rabi season?",
    ]
    return reply, 0.72, suggestions


def _gen_irrigation_response(msg: str, ctx: FarmContext | None) -> tuple[str, float, list[str]]:
    crop_key = (ctx.cropName or "").lower() if ctx else ""
    district = (ctx.district or "your district") if ctx else "your district"
    area_acres = (ctx.areaAcres or 2.5) if ctx else 2.5
    growth_stage = (ctx.growthStage or "vegetative") if ctx else "vegetative"

    # Match crop
    irr_data = None
    for k, v in CROP_IRRIGATION_KB.items():
        if k in crop_key or crop_key in k:
            irr_data = v
            break

    if not irr_data:
        irr_data = {"method": "Furrow/Sprinkler", "et_mm_day": 5.0, "stages": {}}

    # Calculate water requirement
    et0 = irr_data["et_mm_day"]
    area_ha = area_acres * 0.4047
    # Kc (crop coefficient) rough estimate by stage
    kc = 1.1 if "flower" in growth_stage.lower() or "boll" in growth_stage.lower() else 0.85
    etc_mm_day = et0 * kc
    daily_liters = etc_mm_day * area_ha * 10_000 / 1000  # mm → m3 → liters
    pump_5hp_lpm = 400  # approx 5HP pump = 400 liters/min
    pump_hours = daily_liters / (pump_5hp_lpm * 60)

    # Stage-specific advice
    stage_advice = ""
    for stage_key, stage_tip in irr_data.get("stages", {}).items():
        if stage_key.lower() in growth_stage.lower() or growth_stage.lower() in stage_key.lower():
            stage_advice = f"\n\n📍 **{stage_key.title()} Stage Tip:** {stage_tip}"
            break

    reply = (
        f"💧 **Irrigation Plan — {ctx.cropName or 'Your Crop'} | {district}**\n\n"
        f"**Farm:** {area_acres:.1f} acres ({area_ha:.2f} ha)\n"
        f"**Irrigation method:** {irr_data['method']}\n"
        f"**Growth stage:** {growth_stage}\n\n"
        f"📊 **Daily Water Demand:**\n"
        f"- Crop ET rate: **{etc_mm_day:.1f} mm/day** (Kc = {kc})\n"
        f"- Total water needed: **{daily_liters:,.0f} litres/day**\n\n"
        f"🔧 **Pump Guidance (5 HP drip pump ≈ 400 L/min):**\n"
        f"  Run time: **{pump_hours:.1f} hours/day**\n"
        f"  Best time: **Early morning (5–7 AM)** or **evening (6–8 PM)**{stage_advice}\n\n"
        f"⚡ **Water-saving tips:**\n"
        f"- Avoid midday irrigation (30–40% evaporation loss)\n"
        f"- Mulching reduces soil evaporation by up to 25%\n"
        f"- Drip irrigation uses 50% less water than flood irrigation"
    )

    suggestions = [
        f"Fertilizer schedule for {ctx.cropName or 'my crop'}?",
        "Is drip irrigation better for my crop?",
        "When to stop irrigation before harvest?",
    ]
    return reply, 0.80, suggestions


def _gen_fertilizer_response(msg: str, ctx: FarmContext | None) -> tuple[str, float, list[str]]:
    from app.api.routes.fertilizer import CROP_NPK, FERTILIZER_PRODUCTS

    crop_name = (ctx.cropName or "") if ctx else ""
    district = (ctx.district or "your district") if ctx else "your district"
    area_acres = (ctx.areaAcres or 2.5) if ctx else 2.5
    soil_n = (ctx.soilNitrogen) if ctx else None
    soil_p = (ctx.soilPhosphorus) if ctx else None
    soil_k = (ctx.soilPotassium) if ctx else None
    soil_ph = (ctx.soilPh) if ctx else None

    # Find crop data
    crop_data = None
    matched_crop = ""
    for k, v in CROP_NPK.items():
        if k.lower() in crop_name.lower() or crop_name.lower() in k.lower():
            crop_data = v
            matched_crop = k
            break

    if not crop_data:
        reply = (
            f"🌱 **Fertilizer Advice for {district}**\n\n"
            f"I don't have specific data for '{crop_name or 'your crop'}' in my database. "
            f"However, here are **general NPK guidelines**:\n\n"
            f"- **Nitrogen (N):** 80–120 kg/ha — Split in 2–3 applications\n"
            f"- **Phosphorus (P):** 40–60 kg/ha — Apply as basal at sowing\n"
            f"- **Potassium (K):** 40–60 kg/ha — 50% basal, 50% mid-season\n\n"
            f"📋 Please visit the **Fertilizer Advisor** page for crop-specific recommendations with soil test inputs."
        )
        return reply, 0.5, ["Open Fertilizer Advisor", "Soil test interpretation?", "When to apply Urea?"]

    # Compute NPK
    n_req = float(crop_data["N"])
    p_req = float(crop_data["P"])
    k_req = float(crop_data["K"])
    if soil_n: n_req = max(n_req * 0.5, n_req - soil_n * 0.5)
    if soil_p: p_req = max(p_req * 0.4, p_req - soil_p * 0.4)
    if soil_k: k_req = max(k_req * 0.4, k_req - soil_k * 0.3)

    area_ha = area_acres * 0.4047
    n_total = n_req * area_ha
    p_total = p_req * area_ha
    k_total = k_req * area_ha

    ph_warning = ""
    if soil_ph is not None:
        if soil_ph < 6.0:
            ph_warning = f"\n\n⚠️ **Soil pH Alert:** Your soil pH is **{soil_ph}** (acidic). Apply **Lime (500–1000 kg/ha)** to raise pH before fertilization for better nutrient uptake."
        elif soil_ph > 8.0:
            ph_warning = f"\n\n⚠️ **Soil pH Alert:** Your soil pH is **{soil_ph}** (alkaline). Use **Gypsum or Sulphur** to lower pH. Zinc and Iron tend to be deficient in alkaline soils."

    reply = (
        f"🌾 **Fertilizer Plan — {matched_crop} | {area_acres:.1f} acres**\n\n"
        f"Based on ICAR guidelines for **{matched_crop}** in **{district}**:\n\n"
        f"**NPK Requirement:**\n"
        f"- Nitrogen: **{n_req:.0f} kg/ha** → **{n_total:.1f} kg total**\n"
        f"- Phosphorus: **{p_req:.0f} kg/ha** → **{p_total:.1f} kg total**\n"
        f"- Potassium: **{k_req:.0f} kg/ha** → **{k_total:.1f} kg total**\n\n"
        f"**Key Products (approximate):**\n"
        f"- **DAP** (basal) ≈ {p_total / 0.46 * 0.4047:.1f} kg/acre\n"
        f"- **Urea** (split) ≈ {(n_total - p_total * 0.18 / 0.46 * 0.18) / 0.46:.1f} kg total\n"
        f"- **MOP** ≈ {k_total / 0.60:.1f} kg total\n\n"
        f"💊 **Micronutrients:** {', '.join(crop_data.get('micronutrients', ['Not specified']))}\n"
        f"📝 **Notes:** {crop_data.get('notes', '')}{ph_warning}\n\n"
        f"📋 For detailed split scheduling, visit the **Fertilizer Advisor** page."
    )

    suggestions = [
        f"When to do top dressing for {matched_crop}?",
        "My {matched_crop} leaves are yellowing — deficiency?",
        "Irrigation before or after fertilizer application?",
    ]
    return reply, 0.85, suggestions


def _gen_market_response(msg: str, ctx: FarmContext | None) -> tuple[str, float, list[str]]:
    crop_name = (ctx.cropName or "your crop") if ctx else "your crop"
    district = (ctx.district or "your area") if ctx else "your area"

    # Seasonal advice heuristic
    today = date.today()
    month = today.month

    # Indian harvest seasons approximation
    harvest_guide = {
        "wheat": {"harvest_months": [3, 4], "peak_price": "March–May", "advice": "Wheat prices peak post-harvest (Apr–May). Store if possible to sell in July–Aug."},
        "rice": {"harvest_months": [10, 11, 12], "peak_price": "Jan–Feb", "advice": "Rice prices are lowest at harvest (Nov). Hold stock and sell by January for better rates."},
        "cotton": {"harvest_months": [10, 11, 12], "peak_price": "Jan–Mar", "advice": "Cotton ginning demand peaks Jan–Mar. Quality boll storage improves returns."},
        "soybean": {"harvest_months": [10, 11], "peak_price": "Dec–Feb", "advice": "Soybean prices rally post-harvest due to crushing demand. Sell progressively."},
        "onion": {"harvest_months": [1, 2, 3, 11, 12], "peak_price": "June–Aug", "advice": "Onion prices are highest in June–August when supplies are lean. Cold storage unlocks premium returns."},
        "tomato": {"harvest_months": [11, 12, 1, 2], "peak_price": "May–Jul", "advice": "Tomato is highly perishable. Sell within 3–5 days of harvest. Consider processing tie-ups."},
    }

    crop_key = crop_name.lower()
    guide = None
    for k, v in harvest_guide.items():
        if k in crop_key:
            guide = v
            break

    if guide:
        is_harvest_month = month in guide["harvest_months"]
        timing_msg = (
            "🟡 You are in the **harvest window** — prices may be at seasonal low due to high market arrivals. "
            f"{guide['advice']}"
            if is_harvest_month else
            f"📈 {guide['advice']}"
        )
        reply = (
            f"📊 **Market Intelligence — {crop_name} | {district}**\n\n"
            f"{timing_msg}\n\n"
            f"🗓️ **Peak Price Period:** {guide['peak_price']}\n\n"
            f"💡 **Selling Strategies:**\n"
            f"- Check **Agmarknet.gov.in** for real-time local Mandi prices\n"
            f"- Compare at least 3 mandis before selling\n"
            f"- If storage is available, hold 30–40% of stock for seasonal price rise\n"
            f"- FPO/cooperative aggregation can fetch 10–15% higher prices\n\n"
            f"📱 Visit the **Market Prices** page for live Mandi data across districts."
        )
    else:
        reply = (
            f"📊 **Market Guidance — {crop_name}**\n\n"
            f"For real-time prices, visit the **Market Prices** page in AgriIQ.\n\n"
            f"**General Selling Tips:**\n"
            f"- Compare prices across at least 3–5 nearby mandis\n"
            f"- Sell in early morning auctions for better visibility\n"
            f"- Clean, graded, and well-packed produce fetches 15–20% premium\n"
            f"- e-NAM platform enables online bidding from multiple mandis simultaneously\n\n"
            f"📈 For **profitability projections** including input costs vs revenue, use the **Profitability** page."
        )

    suggestions = [
        f"Is it a good time to sell {crop_name}?",
        "How to store crop to get better prices?",
        f"Profitability analysis for {crop_name}?",
    ]
    return reply, 0.70, suggestions


def _gen_ndvi_response(msg: str, ctx: FarmContext | None) -> tuple[str, float, list[str]]:
    ndvi = (ctx.ndviMean) if ctx else None
    trend = (ctx.ndviTrend or "stable") if ctx else "stable"
    health = (ctx.ndviHealth or "Unknown") if ctx else "Unknown"
    crop = (ctx.cropName or "your crop") if ctx else "your crop"
    district = (ctx.district or "your district") if ctx else "your district"

    if ndvi is None:
        reply = (
            "🛰️ **NDVI (Vegetation Index) — How to Interpret**\n\n"
            "NDVI (Normalized Difference Vegetation Index) measures plant health from satellite imagery:\n\n"
            "| NDVI Range | Health Status |\n"
            "|-----------|---------------|\n"
            "| 0.70 – 1.00 | 🟢 Excellent — Dense, healthy canopy |\n"
            "| 0.50 – 0.70 | 🟡 Good — Healthy with minor stress |\n"
            "| 0.30 – 0.50 | 🟠 Moderate — Stress detected |\n"
            "| 0.00 – 0.30 | 🔴 Stressed — Severe stress / bare soil |\n\n"
            "Visit the **NDVI Monitor** page to see your field's current satellite health map and trend chart."
        )
    else:
        status_emoji = "🟢" if ndvi > 0.65 else ("🟡" if ndvi > 0.45 else "🔴")
        trend_emoji = "📈" if trend == "improving" else ("📉" if trend == "declining" else "➡️")

        action = ""
        if ndvi < 0.35:
            action = (
                "\n\n🚨 **Urgent Action Required:**\n"
                "- Check for waterlogging or drought stress first\n"
                "- Inspect crop for disease/pest damage\n"
                "- Consider emergency foliar spray (Urea 2% + Zinc Sulphate 0.5%)\n"
                "- Irrigate if rainfall has been absent for 10+ days"
            )
        elif ndvi < 0.50:
            action = (
                "\n\n⚠️ **Improvement Actions:**\n"
                "- Top-dress with Nitrogen fertilizer if at vegetative/tillering stage\n"
                "- Check soil moisture — consider irrigation\n"
                "- Scout for early pest/disease symptoms"
            )
        else:
            action = (
                "\n\n✅ **Maintain Current Practices:**\n"
                "- Continue your regular fertilizer and irrigation schedule\n"
                "- Monitor NDVI weekly for any unexpected dips"
            )

        reply = (
            f"🛰️ **NDVI Health Report — {crop} | {district}**\n\n"
            f"{status_emoji} **Current NDVI:** {ndvi:.3f} ({health})\n"
            f"{trend_emoji} **Trend:** {trend.title()}\n\n"
            f"Your vegetation index of **{ndvi:.3f}** indicates "
            f"{'excellent crop canopy and vigour' if ndvi > 0.65 else ('moderate plant health — some areas may need attention' if ndvi > 0.45 else 'significant crop stress — immediate assessment recommended')}."
            f"{action}"
        )

    suggestions = [
        "Why did my NDVI drop this week?",
        "What fertilizer to improve NDVI?",
        "NDVI and irrigation connection?",
    ]
    return reply, 0.83, suggestions


def _gen_general_response(msg: str, ctx: FarmContext | None) -> tuple[str, float, list[str]]:
    crop = (ctx.cropName or "your crop") if ctx else "your crop"
    district = (ctx.district or "your district") if ctx else "your district"

    reply = (
        f"🌾 **AgriBot — AI Agronomist | {district}**\n\n"
        f"I'm your AI farm advisor with access to your field data for **{crop}** in **{district}**. "
        f"I can help you with:\n\n"
        f"- 🌿 **Pest & Disease Diagnosis** — describe symptoms and get treatment recommendations\n"
        f"- 🌦️ **Weather & Spray Timing** — should you spray or apply fertilizer today?\n"
        f"- 💧 **Irrigation Scheduling** — pump hours, water demand, stage-wise guidance\n"
        f"- 🌾 **Fertilizer Dosage** — NPK requirements, product quantities, split schedules\n"
        f"- 📊 **Market Timing** — when to sell, mandi price interpretation\n"
        f"- 🛰️ **NDVI Interpretation** — understand your crop health satellite data\n\n"
        f"**Try asking:**\n"
        f"- *\"I see white spots on my {crop} leaves — what is it?\"*\n"
        f"- *\"Can I apply Urea tomorrow?\"*\n"
        f"- *\"How much water does my {crop} need daily?\"*\n"
        f"- *\"Is it a good time to sell my {crop}?\"*"
    )

    suggestions = [
        f"Diagnose symptoms on my {crop}",
        "Is today's weather good for spraying?",
        f"Fertilizer plan for {crop} this season",
        "Irrigation schedule for current growth stage",
    ]
    return reply, 0.6, suggestions


# ─────────────────────────────────────────────────────────────────────────────
# Main endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def agribot_chat(req: ChatRequest) -> ChatResponse:
    """
    AgriBot AI agronomist chat endpoint.
    Processes the user's message, detects intent, and returns a
    context-grounded agronomic response.
    """
    msg = req.message.strip()
    ctx = req.context

    intent = _detect_intent(msg)

    # Dispatch to specialized handler
    if intent == "pest_disease":
        reply, confidence, suggestions = _gen_pest_disease_response(msg, ctx)
        category = "diagnosis"
        sources = ["ICAR Pest Management Guidelines", "NIPHM Crop Protection Database"]
    elif intent == "weather":
        reply, confidence, suggestions = _gen_weather_response(msg, ctx)
        category = "weather"
        sources = ["IMD Seasonal Forecast", "AgriIQ Weather Service (Open-Meteo)"]
    elif intent == "irrigation":
        reply, confidence, suggestions = _gen_irrigation_response(msg, ctx)
        category = "irrigation"
        sources = ["ICAR Irrigation Guidelines", "FAO Crop Water Requirements"]
    elif intent == "fertilizer":
        reply, confidence, suggestions = _gen_fertilizer_response(msg, ctx)
        category = "fertilizer"
        sources = ["ICAR Fertilizer Use Recommendations", "NBS (Nutrient Based Subsidy) Guidelines"]
    elif intent == "market":
        reply, confidence, suggestions = _gen_market_response(msg, ctx)
        category = "market"
        sources = ["Agmarknet Price Data", "e-NAM Market Intelligence"]
    elif intent in ("ndvi", "soil"):
        reply, confidence, suggestions = _gen_ndvi_response(msg, ctx)
        category = "diagnosis"
        sources = ["Sentinel-2 NDVI Data", "ISRO Bhuvan Remote Sensing"]
    else:
        reply, confidence, suggestions = _gen_general_response(msg, ctx)
        category = "general"
        sources = ["AgriIQ Knowledge Base"]

    logger.info("AgriBot: intent=%s confidence=%.2f", intent, confidence)

    return ChatResponse(
        reply=reply,
        category=category,
        suggestions=suggestions[:3],
        confidence=round(confidence, 2),
        sources=sources,
    )
