$ErrorActionPreference = "Stop"

$taskName = "WorldEngineDesktopHost"
$python = (Get-Command py).Source
$repoRoot = (Resolve-Path ".").Path
$cmd = "py -m uvicorn ops.servers.desktop_host:app --host 127.0.0.1 --port 3002 --log-level info"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -Command `"$cmd`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel LeastPrivilege

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force
Start-ScheduledTask -TaskName $taskName

Write-Host "✅ Scheduled task installed + started: $taskName"
