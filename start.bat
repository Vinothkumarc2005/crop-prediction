@echo off
REM ============================================================
REM  AgriIQ — Project Starter
REM  Starts: PostgreSQL (Local or Docker), FastAPI backend, React frontend
REM  Usage:  Double-click start.bat  OR  run from cmd/PowerShell
REM ============================================================
title AgriIQ - Starting Services

color 0A
echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         AgriIQ — AI Crop Intelligence           ║
echo  ║         Starting all project services...        ║
echo  ╚══════════════════════════════════════════════════╝
echo.

REM ── Step 1: Check PostgreSQL (Local or Docker) ───────────────
echo [1/3] Checking PostgreSQL database...
netstat -ano | findstr /R ":5432.*LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PostgreSQL is already running on port 5432.
    goto start_backend
)

REM If not listening on 5432, try starting via Docker Compose
echo       Port 5432 not detected. Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] PostgreSQL is not running on port 5432, and Docker is not available.
    echo        If your PostgreSQL service is installed, please start it in Windows Services.
    echo        Attempting to proceed anyway...
    goto start_backend
)

echo       Starting PostgreSQL container via Docker Compose...
cd /d "%~dp0agriiq"
docker compose up -d postgres
if %errorlevel% neq 0 (
    echo [WARN] Failed to start PostgreSQL via Docker. Attempting to proceed anyway...
    goto start_backend
)
echo [OK] PostgreSQL container started.

REM Wait for container to accept connections
echo       Waiting for PostgreSQL to be ready...
:wait_postgres
docker exec agriiq-postgres pg_isready -U agriiq -d agriiq >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 2 /nobreak >nul
    goto wait_postgres
)
echo [OK] PostgreSQL is ready.

:start_backend
REM ── Step 2: Start FastAPI Backend ────────────────────────────
echo.
echo [2/3] Starting FastAPI Backend (port 8000)...
cd /d "%~dp0agriiq\fastapi-backend"

if exist ".venv\Scripts\python.exe" (
    echo [OK] Found Python virtual environment (.venv).
    start "AgriIQ Backend (port 8000)" /D "%~dp0agriiq\fastapi-backend" cmd /k "call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    echo [WARN] No .venv found. Using system Python.
    start "AgriIQ Backend (port 8000)" /D "%~dp0agriiq\fastapi-backend" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
)
echo [OK] FastAPI backend window launched.

REM ── Step 3: Wait briefly for backend to initialize ───────────
echo.
echo       Waiting 4s for backend to initialize...
timeout /t 4 /nobreak >nul

REM ── Step 4: Start React Frontend ─────────────────────────────
echo.
echo [3/3] Starting React Frontend (port 3000)...
cd /d "%~dp0agriiq\frontend"

if not exist "node_modules" (
    echo       node_modules not found — running npm install...
    call npm install
)

start "AgriIQ Frontend (port 3000)" /D "%~dp0agriiq\frontend" cmd /k "npm run dev"
echo [OK] React frontend window launched.

REM ── Step 5: Open browser ─────────────────────────────────────
echo.
echo       Waiting 4s for frontend dev server...
timeout /t 4 /nobreak >nul

echo.
echo [OK] Opening browser at http://localhost:3000
start http://localhost:3000

REM ── Summary ───────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║                  AgriIQ is Live!                    ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║  Frontend          →  http://localhost:3000          ║
echo  ║  Farm Map Setup    →  http://localhost:3000/fields/new║
echo  ║  NDVI Monitor      →  http://localhost:3000/ndvi     ║
echo  ║  Crop Intelligence →  http://localhost:3000/crop     ║
echo  ║  Weather Intel     →  http://localhost:3000/weather-intel║
echo  ║  Fertilizer Advisor→  http://localhost:3000/fertilizer║
echo  ║  Profitability & ROI→ http://localhost:3000/profitability║
echo  ║  Market Prices     →  http://localhost:3000/market   ║
echo  ║  Backend API Docs  →  http://localhost:8000/docs     ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause
