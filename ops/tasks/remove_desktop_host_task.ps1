$ErrorActionPreference = "Stop"
$taskName = "WorldEngineDesktopHost"

Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "🧹 Scheduled task removed: $taskName"
