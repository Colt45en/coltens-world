# AgentHub Quick Start (PowerShell)

Write-Host "`nStarting AgentHub services...`n" -ForegroundColor Cyan

# Start TS Agent
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/k node ts_agent_server.js"

# Start Python Hub
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/k python agent_hub_server.py"

Start-Sleep -Seconds 2

Write-Host "✅ Services started:`n" -ForegroundColor Green
Write-Host "   TS Agent:   http://127.0.0.1:3002/health" -ForegroundColor White
Write-Host "   AgentHub:   http://127.0.0.1:3001/health" -ForegroundColor White
Write-Host "`n"
