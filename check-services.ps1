#!/usr/bin/env pwsh
# Service Status Check for World Engine

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                            ║" -ForegroundColor Cyan
Write-Host "║           🌐 World Engine Service Status                   ║" -ForegroundColor Cyan
Write-Host "║                                                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Function to check service health
function Test-Service {
    param(
        [string]$Name,
        [int]$Port,
        [string]$HealthPath = "/health"
    )

    $url = "http://localhost:$Port$HealthPath"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        Write-Host "  ✓ " -ForegroundColor Green -NoNewline
        Write-Host "$Name (Port $Port) - " -NoNewline
        Write-Host "UP" -ForegroundColor Green -NoNewline
        Write-Host " [$($response.StatusCode)]"
        return $true
    } catch {
        Write-Host "  ✗ " -ForegroundColor Red -NoNewline
        Write-Host "$Name (Port $Port) - " -NoNewline
        Write-Host "DOWN" -ForegroundColor Red
        return $false
    }
}

Write-Host "Checking services..." -ForegroundColor Yellow
Write-Host ""

$nucleusUp = Test-Service -Name "Nucleus Hub" -Port 3000
$sidecarUp = Test-Service -Name "Sidecar (Brain/Lexicon)" -Port 3002
$agentUp = Test-Service -Name "Agent Server" -Port 8765

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Summary
$upCount = @($nucleusUp, $sidecarUp, $agentUp) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count
$totalCount = 3

Write-Host ""
if ($upCount -eq $totalCount) {
    Write-Host "  🎉 All services are UP! ($upCount/$totalCount)" -ForegroundColor Green
} elseif ($upCount -gt 0) {
    Write-Host "  ⚠️  Some services are down ($upCount/$totalCount)" -ForegroundColor Yellow
} else {
    Write-Host "  ❌ All services are DOWN" -ForegroundColor Red
}
Write-Host ""

# Port details
Write-Host "Service Details:" -ForegroundColor White
Write-Host "  • Nucleus:    ws://localhost:3000 (WebSocket Hub)" -ForegroundColor Gray
Write-Host "  • Sidecar:    http://localhost:3002 (Brain/Lexicon/Pipeline)" -ForegroundColor Gray
Write-Host "  • Agent:      ws://localhost:8765 (Agent Chat)" -ForegroundColor Gray
Write-Host ""

# URLs
Write-Host "Access Points:" -ForegroundColor White
Write-Host "  • Agent Chat:   http://localhost:8765/" -ForegroundColor Cyan
Write-Host "  • IDE:          http://localhost:5173/" -ForegroundColor Cyan
Write-Host "  • Agent in IDE: http://localhost:5173/lab/agent-chat" -ForegroundColor Cyan
Write-Host ""
