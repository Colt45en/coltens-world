@echo off
REM Simple setup and build script for Windows

cd /d "%~dp0"

echo Checking pnpm...
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pnpm not found. Please install pnpm first.
    exit /b 1
)

echo Installing dependencies...
call pnpm install --frozen-lockfile

if %ERRORLEVEL% NEQ 0 (
    echo WARNING: pnpm install reported warnings
    echo Continuing anyway...
)

echo.
echo Running type check...
call pnpm run type-check

echo.
echo Building packages...
call pnpm run build

echo.
echo Setup complete!
echo.
echo Next: pnpm run dev:all
echo Or:    .\start-dev.bat
echo.
pause
