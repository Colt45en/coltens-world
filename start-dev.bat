@echo off
REM World Engine Development Server Startup Script (Windows)
REM Starts Nucleus (Node.js backend), IDE (Vite), Preview Runtime, and Python sidecar

setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ========================================
echo   WORLD ENGINE - Development Startup
echo ========================================
echo.

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    exit /b 1
)

REM Check for Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python is not installed or not in PATH
    exit /b 1
)

REM Check for pnpm
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pnpm is not installed
    echo Run: corepack enable && corepack prepare pnpm@latest --activate
    exit /b 1
)

echo [1/4] Installing dependencies...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pnpm install failed
    exit /b 1
)

echo.
echo [2/4] Running type check...
call pnpm run type-check
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Type check failed, continuing anyway...
)

echo.
echo [3/4] Building projects...
call pnpm run build
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Build had issues, continuing anyway...
)

echo.
echo ========================================
echo   Starting Servers...
echo ========================================
echo.
echo Nucleus (Node backend):  http://localhost:3000
echo IDE (Web editor):        http://localhost:5173
echo Preview (Game engine):   http://localhost:5174
echo Python sidecar:          http://localhost:8001
echo.
echo Press Ctrl+C to stop all services
echo.

REM Start all services in parallel
start "World Engine - Nucleus" cmd /k "cd apps\nucleus && pnpm run dev"
start "World Engine - IDE Web" cmd /k "cd apps\ide-web && pnpm run dev"
start "World Engine - Preview Runtime" cmd /k "cd apps\preview-runtime && pnpm run dev"
start "World Engine - Python Sidecar" cmd /k "cd apps\py-sidecar && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"

echo.
echo All services started. Waiting for windows to load...
timeout /t 5 /nobreak

echo.
echo Opening IDE in browser...
start "" "http://localhost:5173"

echo.
echo Startup complete! Check the terminal windows for logs.
pause
