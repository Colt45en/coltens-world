# scripts/doctor-windows-node.ps1
#
# Windows Node.js Environment Diagnostics
# Detects WSL shims, PATH issues, and version mismatches
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/doctor-windows-node.ps1

$ErrorActionPreference = "Stop"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   Windows Node.js Environment Doctor   " -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

function Show-Cmd($name) {
  Write-Host "`n=== $name ===" -ForegroundColor Cyan
  try {
    $wherePaths = where.exe $name 2>$null
    if ($wherePaths) {
      $wherePaths | ForEach-Object { Write-Host "where: $_" -ForegroundColor Yellow }
    } else {
      Write-Host "where: (not found)" -ForegroundColor Red
    }
  } catch {
    Write-Host "where: (not found)" -ForegroundColor Red
  }

  try {
    $cmd = Get-Command $name -ErrorAction Stop
    Write-Host "Get-Command: $($cmd.Source)" -ForegroundColor Green
    Write-Host "CommandType: $($cmd.CommandType)" -ForegroundColor Gray
  } catch {
    Write-Host "Get-Command: (not found)" -ForegroundColor Red
  }
}

Show-Cmd node
Show-Cmd npm
Show-Cmd pnpm
Show-Cmd wsl

Write-Host "`n=== Versions ===" -ForegroundColor Cyan
try {
  $nodeVer = node -v 2>&1
  Write-Host "node: $nodeVer" -ForegroundColor Green
} catch {
  Write-Host "node: failed to execute" -ForegroundColor Red
}

try {
  $npmVer = npm -v 2>&1
  Write-Host "npm:  $npmVer" -ForegroundColor Green
} catch {
  Write-Host "npm: failed to execute" -ForegroundColor Red
}

try {
  $pnpmVer = pnpm -v 2>&1
  Write-Host "pnpm: $pnpmVer" -ForegroundColor Green
} catch {
  Write-Host "pnpm: (not installed or failed to execute)" -ForegroundColor Yellow
}

Write-Host "`n=== PATH Sanity (top 15 entries) ===" -ForegroundColor Cyan
$env:Path.Split(";") | Select-Object -First 15 | ForEach-Object {
  Write-Host "  $_" -ForegroundColor Gray
}

Write-Host "`n=== Analysis ===" -ForegroundColor Cyan

# Check for WSL shim issues
$nodeWhere = where.exe node 2>$null
if ($nodeWhere -match "wsl" -or $nodeWhere -match "WindowsApps") {
  Write-Host "[WARNING] Node may be a WSL shim or Store alias!" -ForegroundColor Red
  Write-Host "  Fix: Settings → Apps → App execution aliases → Disable node.exe/npm.exe" -ForegroundColor Yellow
}

# Check for pnpm
try {
  $null = pnpm -v 2>&1
  Write-Host "[OK] pnpm is installed and executable" -ForegroundColor Green
} catch {
  Write-Host "[WARNING] pnpm not found - run 'corepack enable' then 'corepack prepare pnpm@latest --activate'" -ForegroundColor Yellow
}

# Check Node version
try {
  $nodeVer = node -v 2>&1
  $verNum = [int]($nodeVer -replace "v(\d+)\..*", '$1')
  if ($verNum -ge 18) {
    Write-Host "[OK] Node version $nodeVer is sufficient (>=18 required)" -ForegroundColor Green
  } else {
    Write-Host "[WARNING] Node version $nodeVer is old (recommend >=18)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[ERROR] Could not determine Node version" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Doctor complete ✅" -ForegroundColor Green
Write-Host "`nNext steps if issues found:" -ForegroundColor Cyan
Write-Host "  1. Disable Store aliases: Settings → Apps → App execution aliases" -ForegroundColor Gray
Write-Host "  2. Install Node LTS: winget install Volta.Volta (recommended)" -ForegroundColor Gray
Write-Host "  3. Enable pnpm: corepack enable && corepack prepare pnpm@latest --activate" -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan
