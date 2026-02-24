$ErrorActionPreference = "Stop"
Set-Location (Split-Path $MyInvocation.MyCommand.Path)

py .\world_engine_core_service.py stop
py .\world_engine_core_service.py remove

Write-Host "🧹 Service removed: WorldEngineCoreSvc"
