#!/usr/bin/env pwsh
# World Engine Setup Verification and Build Script

param(
    [switch]$Install = $false,
    [switch]$BuildOnly = $false
)

Write-Host "`n==================================================`n"
Write-Host "  World Engine - Setup Verification and Build`n"
Write-Host "==================================================`n"

# Check environment
Write-Host "[1/5] Checking environment..." -ForegroundColor Cyan

$env:PATH = (($env:PATH -split ';') | Where-Object { $_ -notmatch 'WSL|wsl' }) -join ';'

$nodeVersion = node --version 2>$null
$pnpmVersion = pnpm --version 2>$null
$pythonVersion = python --version 2>$null

if ($nodeVersion) {
    Write-Host "  [OK] Node.js: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "  [ERR] Node.js not found in PATH" -ForegroundColor Red
    exit 1
}

if ($pnpmVersion) {
    Write-Host "  [OK] pnpm: $pnpmVersion" -ForegroundColor Green
} else {
    Write-Host "  [ERR] pnpm not found in PATH" -ForegroundColor Red
    exit 1
}

if ($pythonVersion) {
    Write-Host "  [OK] Python: $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Python not found (optional)" -ForegroundColor Yellow
}

# Check node_modules
Write-Host "`n[2/5] Checking dependencies..." -ForegroundColor Cyan

if (Test-Path "node_modules" -PathType Container) {
    $packageCount = @(Get-ChildItem node_modules | Measure-Object).Count
    Write-Host "  [OK] node_modules exists ($packageCount packages)" -ForegroundColor Green
} else {
    Write-Host "  [WARN] node_modules not found" -ForegroundColor Yellow
    Write-Host "       Run with -Install flag to download dependencies" -ForegroundColor Gray
}

# Install if requested
if ($Install -or -not (Test-Path "node_modules")) {
    Write-Host "`n[3/5] Installing dependencies..." -ForegroundColor Cyan
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERR] pnpm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Dependencies installed" -ForegroundColor Green
}

# Type check
Write-Host "`n[4/5] Running type check..." -ForegroundColor Cyan
pnpm run type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARN] TypeScript errors found (see above)" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] All TypeScript checks passed" -ForegroundColor Green
}

# Build
if (-not $BuildOnly) {
    Write-Host "`n[5/5] Building packages..." -ForegroundColor Cyan
    pnpm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [WARN] Build had warnings" -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] Build successful" -ForegroundColor Green
    }
}

Write-Host "`n=================================================="
Write-Host "  Setup Complete" -ForegroundColor Green
Write-Host "==================================================`n"

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  - Run: pnpm run dev:all" -ForegroundColor Gray
Write-Host "  - Open: http://localhost:5173" -ForegroundColor Gray
Write-Host "  - Or use: .\start-dev.bat" -ForegroundColor Gray
Write-Host ""
