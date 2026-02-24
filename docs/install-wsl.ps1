# Install WSL Optional Component
# This script must be run as Administrator

Write-Host "================================" -ForegroundColor Cyan
Write-Host "WSL Optional Component Installer" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Installing WSL Optional Component..." -ForegroundColor Green
Write-Host "(This may take a few minutes)" -ForegroundColor Gray
Write-Host ""

# Install WSL optional component
wsl.exe --install --no-distribution

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart your computer" -ForegroundColor White
Write-Host "2. After restart, open PowerShell and run: npm install" -ForegroundColor White
Write-Host ""

$restart = Read-Host "Restart now? (y/n)"
if ($restart -eq 'y' -or $restart -eq 'yes') {
    Write-Host "Restarting in 10 seconds... (Ctrl+C to cancel)" -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    Restart-Computer -Force
} else {
    Write-Host "Remember to restart your computer manually!" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
}
