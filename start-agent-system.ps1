#!/usr/bin/env pwsh
# World Engine - Agent System Startup Script
# Starts all required services for the multi-modal agent system

Write-Host "======================================" -ForegroundColor Cyan
Write-Host " World Engine - Agent System Startup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if services are already running
$nucleusRunning = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*nucleus*" }
$brainRunning = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*brain*" }
$sidecarRunning = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*py-sidecar*" }
$agentRunning = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*agent-server*" }

# Function to start a service in a new window
function Start-Service {
    param(
        [string]$Name,
        [string]$Path,
        [string]$Command,
        [string]$Color = "Green"
    )

    Write-Host "[Starting] $Name..." -ForegroundColor $Color
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$Path'; $Command" -WindowStyle Normal
    Start-Sleep -Seconds 2
}

# 1. Install Agent Server Dependencies (if needed)
if (-not (Test-Path "apps\agent-server\node_modules")) {
    Write-Host "[Setup] Installing agent-server dependencies..." -ForegroundColor Yellow
    Push-Location "apps\agent-server"
    pnpm install
    Pop-Location
    Write-Host "[Setup] Dependencies installed!" -ForegroundColor Green
    Write-Host ""
}

# 2. Start Python Sidecar (with agent extensions)
if (-not $sidecarRunning) {
    Start-Service -Name "Python Sidecar (Port 8002)" `
                  -Path "$PWD\apps\py-sidecar" `
                  -Command "python main.py" `
                  -Color "Magenta"
} else {
    Write-Host "[Skip] Python Sidecar already running" -ForegroundColor Yellow
}

# 3. Start Brain Service (if not running)
if (-not $brainRunning -and (Test-Path "apps\brain")) {
    Start-Service -Name "Brain Service (Port 8001)" `
                  -Path "$PWD\apps\brain" `
                  -Command "python server.py" `
                  -Color "Blue"
} else {
    Write-Host "[Skip] Brain Service already running or not found" -ForegroundColor Yellow
}

# 4. Start Nucleus (if not running)
if (-not $nucleusRunning -and (Test-Path "apps\nucleus")) {
    Start-Service -Name "Nucleus Hub (Port 8000)" `
                  -Path "$PWD\apps\nucleus" `
                  -Command "npm run dev" `
                  -Color "Cyan"
} else {
    Write-Host "[Skip] Nucleus already running or not found" -ForegroundColor Yellow
}

# 5. Start Agent Server
if (-not $agentRunning) {
    Start-Service -Name "Agent Server (Port 8765)" `
                  -Path "$PWD\apps\agent-server" `
                  -Command "npm run dev" `
                  -Color "Green"
} else {
    Write-Host "[Skip] Agent Server already running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " Services Started!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Agent Chat Interface: " -NoNewline
Write-Host "http://localhost:8765/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Service Endpoints:" -ForegroundColor White
Write-Host "  - Nucleus:      http://localhost:8000" -ForegroundColor Gray
Write-Host "  - Brain:        http://localhost:8001" -ForegroundColor Gray
Write-Host "  - Sidecar:      http://localhost:8002" -ForegroundColor Gray
Write-Host "  - Agent Server: http://localhost:8765" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop monitoring..." -ForegroundColor DarkGray

# Keep script alive to monitor
while ($true) {
    Start-Sleep -Seconds 10
}
