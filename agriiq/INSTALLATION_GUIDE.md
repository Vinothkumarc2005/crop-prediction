# 🛠️ AgriIQ Installation & Execution Guide

Unified Architecture: **React + Vite** ➔ **FastAPI Backend (with LightGBM in-process)** ➔ **PostgreSQL + PostGIS**

---

## 🧭 Architecture & Components

| Component | Technology | Directory | How to Run | Port |
| :--- | :--- | :--- | :--- | :--- |
| **1. Database** | PostgreSQL 16 + PostGIS | `agriiq/db/init.sql` | Native or Docker | `5432` |
| **2. Backend + ML** | FastAPI + LightGBM + psycopg3 | `agriiq/fastapi-backend/` | `uvicorn app.main:app --port 8000 --reload` | `8000` |
| **3. Frontend** | React + TypeScript + Vite | `agriiq/frontend/` | `npm run dev` | `3000` / `5173` |

> [!NOTE]
> **No Spring Boot is required.**
> **No separate ML server is required.**
> Everything runs with one unified FastAPI backend on port 8000.

---

## 📍 Step 1: Database (PostgreSQL 16 + PostGIS)

### Method A: Docker (Fastest)
```powershell
cd "e:\crop prediction\agriiq"
docker compose up postgres -d
```

### Method B: Native Windows Installation
1. Install PostgreSQL 16:
   ```powershell
   winget install PostgreSQL.PostgreSQL.16 --accept-source-agreements --accept-package-agreements
   ```
2. Open **Application Stack Builder** ➔ install **Spatial Extensions ➔ PostGIS 3.x**.
3. Create database and load schema:
   ```powershell
   createdb -U postgres agriiq
   psql -U postgres -d agriiq -f "e:\crop prediction\agriiq\db\init.sql"
   ```

---

## 📍 Step 2: Unified FastAPI Backend

1. Navigate to `fastapi-backend`:
   ```powershell
   cd "e:\crop prediction\agriiq\fastapi-backend"
   ```
2. Virtual environment is pre-configured at `.venv`. Activate it:
   ```powershell
   .\.venv\Scripts\activate
   ```
3. Start the FastAPI backend:
   ```powershell
   .\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. Access interactive API documentation:
   - Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
   - ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
   - Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

5. Run automated test suite:
   ```powershell
   .\.venv\Scripts\pytest.exe -v
   ```

---

## 📍 Step 3: Frontend (React + Vite)

1. Navigate to `frontend`:
   ```powershell
   cd "e:\crop prediction\agriiq\frontend"
   ```
2. Start the Vite dev server:
   ```powershell
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173) (or [http://localhost:3000](http://localhost:3000)).

---

## 🚀 Step 4: Docker (Full Stack Option)

To run the complete platform inside containers:
```powershell
cd "e:\crop prediction\agriiq"
docker compose up --build
```

- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Unified API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 👤 Default Demo Accounts (Pre-seeded in DB)

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Demo Farmer** | `farmer@agriiq.in` | `Farmer@123` | Nashik, Maharashtra, 2 pre-configured fields |
| **Admin / Agronomist** | `admin@agriiq.in` | `Admin@123` | Pune, Maharashtra |
