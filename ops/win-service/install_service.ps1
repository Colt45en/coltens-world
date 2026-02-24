$ErrorActionPreference = "Stop"
Set-Location (Split-Path $MyInvocation.MyCommand.Path)

py .\world_engine_core_service.py install
py .\world_engine_core_service.py start

Write-Host "✅ Service installed + started: WorldEngineCoreSvc"
sc query WorldEngineCoreSvc
