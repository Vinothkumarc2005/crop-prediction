# AgriIQ 🌾 — AI Crop Recommendation & Yield Prediction Platform

> Recommends the most **profitable crop** for a field by fusing satellite NDVI, soil properties, and district mandi prices — with **confidence intervals on every prediction**.

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
|-------|-----------|---------|
| **Frontend** | React 18 + Vite + Recharts + Leaflet | Interactive dashboard, field map draw, confidence intervals |
| **Backend & ML** | Python 3.12 + FastAPI + LightGBM + SHAP | JWT Auth, field CRUD, PostGIS spatial queries, quantile predictions, profitability engine |
| **Database** | PostgreSQL 16 + PostGIS | Spatial field boundary storage (`POLYGON`), NDVI time-series, mandi prices, soil chemistry |

---

## ⚡ Quick Start

### Option A: Docker Compose (Full Stack)

```bash
cd agriiq
docker compose up --build
```

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:8000/api |
| **Interactive Docs (Swagger)** | http://localhost:8000/docs |
| **Health Check** | http://localhost:8000/api/health |

---

### Option B: Local Development

#### 1. Database (PostgreSQL 16 + PostGIS)
```powershell
cd agriiq
docker compose up postgres -d
```

#### 2. FastAPI Backend
```powershell
cd agriiq/fastapi-backend
.\.venv\Scripts\activate
uvicorn app.main:app --port 8000 --reload
```

#### 3. Frontend
```powershell
cd agriiq/frontend
npm run dev
```

---

## 👤 Demo Credentials
```text
Farmer Account:
  Email:    farmer@agriiq.in
  Password: Farmer@123

Admin / Agronomist Account:
  Email:    admin@agriiq.in
  Password: Admin@123
```

---

## 🧠 ML Model Details

- **Algorithm:** LightGBM Quantile Regressors (3 quantile models: $\alpha = 0.1, 0.5, 0.9$ for P10, P50, P90)
- **Explainability:** SHAP `TreeExplainer` providing plain-English top drivers for each crop recommendation
- **Features:** Satellite NDVI (mean, peak, trend), Soil chemistry (N, P, K, pH, OC, texture), Season, District, Crop rotation history penalty
- **Location:** Integrated directly in `fastapi-backend/app/ml/yield_model.py` (no inter-service HTTP latency)

---

## 📁 Clean Repository Layout

```text
agriiq/
├── db/
│   └── init.sql              # PostgreSQL + PostGIS schema & seed dataset
├── fastapi-backend/          # Unified Python FastAPI Application
│   ├── app/
│   │   ├── api/routes/       # auth, fields, predictions, mandi, feedback, health
│   │   ├── core/             # config, security (bcrypt + JWT), dependencies
│   │   ├── db/               # psycopg3 pool & transaction manager
│   │   ├── ml/               # LightGBM yield quantile model & SHAP explainer
│   │   ├── repositories/     # Pure parameterized SQL queries (no ORM)
│   │   ├── schemas/          # Pydantic validation schemas
│   │   ├── services/         # Profitability & agronomic business logic
│   │   └── main.py           # FastAPI entrypoint, lifespan, CORS
│   ├── tests/                # 24 Pytest unit & integration tests
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                 # React 18 + TypeScript + Vite UI
│   ├── src/
│   │   ├── api/client.ts     # Axios API client (port 8000)
│   │   ├── components/       # CropCard, RangeBar, LeafletDrawControl, etc.
│   │   └── pages/            # Dashboard, FieldSetup, YieldDetail, MarketPrices, History
│   └── package.json
├── docker-compose.yml        # 3-service deployment (postgres, backend, frontend)
├── INSTALLATION_GUIDE.md     # Step-by-step installation instructions
└── README.md
```
