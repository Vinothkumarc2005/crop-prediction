# AgriIQ — FastAPI Backend

Unified FastAPI backend that consolidates the previous Spring Boot backend (port 8080)
and the separate ML FastAPI service (port 8000) into a **single application**.

## Architecture

```
React + Vite (port 3000 dev / 80 prod)
         ↓  HTTP
FastAPI backend (port 8000)
  ├── psycopg3 → PostgreSQL + PostGIS (port 5432)
  └── LightGBM (in-process, no HTTP)
```

## Quick Start

### Prerequisites
- Python 3.11+
- PostgreSQL 16 + PostGIS (or use Docker Compose)

### 1. Set up environment

```bash
cd fastapi-backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET
```

### 3. Start database

```bash
# From repo root:
docker compose up postgres -d
```

### 4. Run the backend

```bash
cd fastapi-backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API docs: http://localhost:8000/docs
Health:   http://localhost:8000/ping

### 5. Run tests

```bash
pytest tests/ -v
```

## Docker (full stack)

```bash
# From repo root:
docker compose up --build
```

Services:
- Frontend: http://localhost:3000
- API:      http://localhost:8000
- API docs: http://localhost:8000/docs

## API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/register` | POST | — | Register new user |
| `/api/auth/login` | POST | — | Login, receive JWT |
| `/api/auth/me` | GET | JWT | Current user profile |
| `/api/fields` | POST | JWT | Create field |
| `/api/fields` | GET | JWT | List my fields |
| `/api/fields/{id}` | GET | JWT | Get field |
| `/api/fields/{id}/ndvi` | GET | JWT | NDVI time-series |
| `/api/fields/{id}/soil` | GET | JWT | Soil profile |
| `/api/fields/{id}/history` | GET | JWT | District yield history |
| `/api/fields/{id}` | DELETE | JWT | Delete field |
| `/api/predict/yield` | POST | JWT | Predict yield P10/P50/P90 |
| `/api/recommend/crops` | POST | JWT | Rank crop recommendations |
| `/api/mandi-prices` | GET | — | Market price search |
| `/api/mandi-prices/commodities` | GET | — | Available commodities |
| `/api/mandi-prices/trend` | GET | — | Price trend chart data |
| `/api/feedback` | POST | JWT | Log harvest feedback |
| `/api/feedback/field/{id}` | GET | JWT | Feedback for a field |
| `/api/feedback/summary/{id}` | GET | JWT | Accuracy summary |
| `/api/health` | GET | — | Service health check |
| `/ping` | GET | — | Liveness probe |

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | psycopg3 connection string |
| `JWT_SECRET` | — | Min 32-char secret key |
| `JWT_EXPIRATION_SECONDS` | `86400` | Token lifetime (24h) |
| `MODEL_DIR` | `ml_models` | LightGBM model directory |
| `NDVI_PROVIDER` | `mock` | `mock` or `live` |
| `SOIL_PROVIDER` | `mock` | `mock` or `live` |
| `CORS_ORIGINS` | see .env.example | Allowed CORS origins |

## Project Structure

```
app/
├── main.py              # FastAPI app, lifespan, CORS
├── core/
│   ├── config.py        # Pydantic-settings
│   ├── security.py      # JWT + bcrypt
│   └── dependencies.py  # get_db, get_current_user
├── db/
│   ├── connection.py    # psycopg3 connection pool
│   └── transaction.py   # Transaction context manager
├── api/
│   ├── router.py        # Root router
│   └── routes/          # auth, fields, predictions, mandi, feedback, health
├── services/            # Business logic (ported from Java services)
├── repositories/        # psycopg3 SQL queries (no ORM)
├── schemas/             # Pydantic request/response models
├── ml/
│   └── yield_model.py   # LightGBM quantile regression
└── exceptions/
    └── handlers.py      # Global exception handlers
```

## Migration Notes

This backend replaces:
- `agriiq/backend/` — Spring Boot 3 application
- `agriiq/ml-service/` — Separate FastAPI ML service

**Existing passwords** in the database are preserved — bcrypt rounds=12 matches
Spring Boot's `BCryptPasswordEncoder(12)` default.

**Existing database schema** is unchanged (`db/init.sql`).

**API contract** is preserved — all endpoints, paths, and JSON field names match
the original Spring Boot controllers exactly.
