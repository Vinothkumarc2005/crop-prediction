# sona-final-year-mini-it-aids-d-vinothkumar-c-256
> **StartupFair Hackathon:** Solo Participant 07 (Final Year Mini Project — IT / AIDS Dept)
> **Participant Name:** Vinothkumar C

---

# AgriIQ 🌾 — AI Crop Recommendation & Yield Prediction Platform

> Recommends the most **profitable crop** for a field by fusing satellite NDVI, soil properties, and district mandi prices — with **confidence intervals on every prediction**.

---

## 🚀 Quick Launch (One-Click)

Run `start.bat` from the root directory or execute in terminal:
```cmd
start.bat
```
This automatically verifies PostgreSQL, launches the FastAPI backend and React frontend, and opens the application in your browser at `http://localhost:3000`.

---

## 🏗️ Architecture

```text
┌─────────────────────────┐       HTTP / REST        ┌───────────────────────────────────────────────┐
│     React + Vite        │ ───────────────────────> │            ONE FastAPI Backend                │
│       frontend          │                          │   (Port 8000)                                 │
│     :3000 / :5173       │                          │   ├── psycopg3 (ConnectionPool) ──────────┐   │
└─────────────────────────┘                          │   └── LightGBM + SHAP (In-Process Module) │   │
                                                     └───────────────────────────────────────────│───┘
                                                                                                 │
                                                                                         ┌───────▼──────────┐
                                                                                         │   PostgreSQL /   │
                                                                                         │   PostGIS :5432  │
                                                                                         └──────────────────┘
```

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + Vite + Recharts + Leaflet | Interactive dashboard, field map drawing, confidence intervals, weather intel |
| **Backend & ML** | Python 3.12 + FastAPI + LightGBM + SHAP | JWT Auth, field CRUD, PostGIS spatial queries, quantile yield predictions, profitability engine |
| **Database** | PostgreSQL 16 + PostGIS | Spatial field boundary storage (`POLYGON`), NDVI time-series, mandi prices, soil chemistry |

---

## 🌟 Key Features

1. **Farm Map & Field Setup**: Draw farm field boundaries with interactive Leaflet GIS tools and calculate area in acres.
2. **Crop Intelligence & Recommendation**: Recommends crops best suited for the field's soil, weather, and district, with P10/P50/P90 yield prediction intervals.
3. **NDVI Satellite Monitor**: Track crop health and vegetation indices over time with future trend forecasts.
4. **10-Year Weather Intelligence**: Historical and seasonal rainfall, temperature, and humidity analysis by district and state.
5. **Fertilizer Advisor**: Tailored NPK dosage recommendations based on soil testing and growth stage.
6. **Profitability & ROI Calculator**: Computes expected revenues, cost of cultivation, and net profit per acre using live mandi price trends.
7. **AI Agronomist Chatbot (AgriBot)**: Context-aware interactive farming assistant.
8. **Live Mandi Prices**: APMC market price tracking across Indian states and commodities.

---

## 👤 Demo Accounts

```text
Farmer Account:
  Email:    farmer@agriiq.in
  Password: Farmer@123

Admin / Agronomist Account:
  Email:    admin@agriiq.in
  Password: Admin@123
```

---

## ⚡ Running Services & Ports

| Service | URL | Notes |
|---|---|---|
| **Frontend UI** | [http://localhost:3000](http://localhost:3000) | Vite dev server |
| **Backend API** | [http://localhost:8000/api](http://localhost:8000/api) | FastAPI unified service |
| **API Docs (Swagger)** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API exploration |
| **Health Check** | [http://localhost:8000/api/health](http://localhost:8000/api/health) | Service & DB status |
| **PostgreSQL Database** | `localhost:5432` | PostGIS spatial database |

---

## 📁 Repository Structure

```text
.
├── start.bat                         # One-click Windows starter script
├── agriiq/
│   ├── db/
│   │   └── init.sql                  # PostgreSQL + PostGIS schema & seed data
│   ├── fastapi-backend/              # Python FastAPI Application
│   │   ├── app/
│   │   │   ├── api/routes/           # auth, fields, predictions, mandi, weather, etc.
│   │   │   ├── core/                 # config, JWT security, dependencies
│   │   │   ├── db/                   # psycopg3 connection pool
│   │   │   ├── ml/                   # LightGBM yield quantile model & SHAP
│   │   │   ├── repositories/         # Parameterized SQL queries
│   │   │   └── main.py               # FastAPI entrypoint
│   │   ├── tests/                    # Pytest test suite
│   │   └── requirements.txt
│   ├── frontend/                     # React 18 + TypeScript + Vite UI
│   │   ├── src/
│   │   │   ├── components/           # AgriBot, WeatherWidget, CropRecommendationCard, etc.
│   │   │   └── pages/                # Dashboard, FieldSetup, NdviIndex, Profitability, etc.
│   │   └── package.json
│   ├── docker-compose.yml            # Containerized full-stack deployment
│   └── README.md
└── crop-recommendation-system-main/  # Reference ML models & research notebooks
```
