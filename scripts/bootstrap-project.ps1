#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Cyan
  Write-Host $Title -ForegroundColor Cyan
  Write-Host "============================================================" -ForegroundColor Cyan
}

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Invoke-Checked([string]$Command, [switch]$AllowFailure) {
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
    throw "Command failed: $Command"
  }
  return $LASTEXITCODE
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pySidecarPath = Join-Path $repoRoot "apps/py-sidecar"
$venvPath = Join-Path $pySidecarPath ".venv"
$requirementsPath = Join-Path $pySidecarPath "requirements.txt"
$venvPython = Join-Path $venvPath "Scripts/python.exe"

Write-Section "Project Bootstrap: Toolchain checks"
Assert-Command "pnpm"
Assert-Command "python"
pnpm --version | Out-Host
python --version | Out-Host

Write-Section "Project Bootstrap: Node dependency install"
Push-Location $repoRoot
Invoke-Checked "pnpm install --frozen-lockfile"

Write-Section "Project Bootstrap: Type-check gate"
$typecheckCode = Invoke-Checked "pnpm run type-check" -AllowFailure
if ($typecheckCode -ne 0) {
  Write-Host "Type-check reports existing workspace errors (continuing bootstrap)." -ForegroundColor Yellow
}
Pop-Location

Write-Section "Project Bootstrap: Python sidecar environment"
if (-not (Test-Path $venvPython)) {
  Write-Host "Creating sidecar virtual environment at $venvPath"
  python -m venv $venvPath
}

if (-not (Test-Path $requirementsPath)) {
  throw "Missing requirements file: $requirementsPath"
}

& $venvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Failed to upgrade pip in sidecar venv." }

& $venvPython -m pip install -r $requirementsPath
if ($LASTEXITCODE -ne 0) { throw "Failed to install sidecar requirements." }

Write-Section "Project Bootstrap: Sidecar smoke tests"
Push-Location $pySidecarPath
& $venvPython -c "import app.main as m; print('import ok:', hasattr(m, 'app'))"
if ($LASTEXITCODE -ne 0) { throw "Failed sidecar app import smoke test." }

& $venvPython -c "import fastapi, uvicorn; print('fastapi:', fastapi.__version__)"
if ($LASTEXITCODE -ne 0) { throw "Failed dependency import smoke test." }
Pop-Location

Write-Section "Bootstrap complete"
Write-Host "Run one-key dev with task: World Engine: Dev Core (nucleus+ide+sidecar)" -ForegroundColor Green
Write-Host "Or run: pnpm run dev:all" -ForegroundColor Green
