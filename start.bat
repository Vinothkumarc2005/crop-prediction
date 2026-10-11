@echo off
REM ============================================================
REM  AgriIQ — Project Starter
REM  Starts: PostgreSQL (Local or Docker), FastAPI backend, React frontend
REM  Usage:  Double-click start.bat  OR  run from cmd/PowerShell
REM ============================================================
title AgriIQ - Starting Services

color 0A
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║              AgriIQ — AI Crop Intelligence                 ║
echo  ║              Starting all project services...              ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.

REM ── Step 1: Check PostgreSQL (Local or Docker) ───────────────
echo [1/3] Checking PostgreSQL database...
netstat -ano -p tcp | findstr ":5432 " >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PostgreSQL is already running on port 5432.
    goto check_backend
)

REM If not listening on 5432, try starting via Docker Compose
echo       Port 5432 not detected. Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] PostgreSQL is not running on port 5432, and Docker is not available.
    echo        If your PostgreSQL service is installed, please start it in Windows Services.
    echo        Attempting to proceed anyway...
    goto check_backend
)

echo       Starting PostgreSQL container via Docker Compose...
cd /d "%~dp0agriiq"
docker compose up -d postgres
if %errorlevel% neq 0 (
    echo [WARN] Failed to start PostgreSQL via Docker. Attempting to proceed anyway...
    goto check_backend
)
echo [OK] PostgreSQL container started.

REM Wait for container to accept connections
echo       Waiting for PostgreSQL to be ready...
:wait_postgres
docker exec agriiq-postgres pg_isready -U agriiq -d agriiq >nul 2>&1
if %errorlevel% neq 0 (
    ping 127.0.0.1 -n 3 >nul
    goto wait_postgres
)
echo [OK] PostgreSQL is ready.

:check_backend
REM ── Step 2: Start FastAPI Backend ────────────────────────────
echo.
echo [2/3] Checking FastAPI Backend (port 8000)...
netstat -ano -p tcp | findstr ":8000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] FastAPI Backend is already running on port 8000.
    goto check_frontend
)

cd /d "%~dp0agriiq\fastapi-backend"
if exist ".venv\Scripts\python.exe" (
    echo [OK] Found Python virtual environment.
    start "AgriIQ Backend [DO NOT CLOSE]" cmd /k "echo ====================================================== && echo AgriIQ Backend is RUNNING. DO NOT CLOSE THIS WINDOW! && echo ====================================================== && call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    echo [WARN] No virtual environment found. Using system Python.
    start "AgriIQ Backend [DO NOT CLOSE]" cmd /k "echo ====================================================== && echo AgriIQ Backend is RUNNING. DO NOT CLOSE THIS WINDOW! && echo ====================================================== && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
)
echo [OK] FastAPI backend window launched.

REM Wait for backend port 8000 to be listening
echo       Waiting for backend to be ready on port 8000...
set /a bcount=0
:wait_backend_loop
netstat -ano -p tcp | findstr ":8000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Backend is ready on port 8000.
    goto check_frontend
)
ping 127.0.0.1 -n 2 >nul
set /a bcount+=1
if %bcount% geq 25 (
    echo [WARN] Backend startup took longer than expected. Continuing...
    goto check_frontend
)
goto wait_backend_loop

:check_frontend
REM ── Step 3: Start React Frontend ─────────────────────────────
echo.
echo [3/3] Checking React Frontend (port 3000)...
netstat -ano -p tcp | findstr ":3000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] React Frontend is already running on port 3000.
    goto open_browser
)

cd /d "%~dp0agriiq\frontend"
if not exist "node_modules" (
    echo       node_modules not found - running npm install...
    call npm install
)

start "AgriIQ Frontend [DO NOT CLOSE]" cmd /k "echo ====================================================== && echo AgriIQ Frontend is RUNNING. DO NOT CLOSE THIS WINDOW! && echo ====================================================== && npm run dev"
echo [OK] React frontend window launched.

REM ── Step 4: Wait for frontend to be active before opening browser
echo.
echo       Waiting for frontend server to become ready on port 3000...
set /a fcount=0
:wait_frontend_loop
netstat -ano -p tcp | findstr ":3000 " >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Frontend is online and responding on port 3000.
    goto open_browser
)
ping 127.0.0.1 -n 2 >nul
set /a fcount+=1
if %fcount% geq 35 (
    echo [WARN] Frontend server is taking longer to start. Opening browser now...
    goto open_browser
)
goto wait_frontend_loop

:open_browser
echo.
echo [OK] Opening browser at http://localhost:3000
start http://localhost:3000

REM ── Summary ───────────────────────────────────────────────────
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║                      AgriIQ is Live!                       ║
echo  ╠════════════════════════════════════════════════════════════╣
echo  ║  Frontend          -  http://localhost:3000                ║
echo  ║  Fallback Link     -  http://127.0.0.1:3000                ║
echo  ║  Farm Map Setup    -  http://localhost:3000/fields/new     ║
echo  ║  NDVI Monitor      -  http://localhost:3000/ndvi           ║
echo  ║  Crop Intelligence -  http://localhost:3000/crop           ║
echo  ║  Weather Intel     -  http://localhost:3000/weather-intel  ║
echo  ║  Fertilizer Advisor-  http://localhost:3000/fertilizer     ║
echo  ║  Profitability ROI -  http://localhost:3000/profitability  ║
echo  ║  Market Prices     -  http://localhost:3000/market         ║
echo  ║  Backend API Docs  -  http://localhost:8000/docs           ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  *************************************************************
echo  IMPORTANT: KEEP THE BACKEND AND FRONTEND COMMAND WINDOWS OPEN!
echo  Do NOT close the black command prompt windows.
echo  Closing them will stop the servers and cause "Connection Refused".
echo  *************************************************************
echo.
pause
