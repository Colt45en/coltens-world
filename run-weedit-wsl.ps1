#!/usr/bin/env powershell
param(
  [string]$FilePath = "",
  [switch]$CompileOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Escape-BashSingleQuoted([string]$Value) {
  if ([string]::IsNullOrEmpty($Value)) { return "''" }
  return "'" + ($Value -replace "'", "'\\''") + "'"
}

Assert-Command "wsl.exe"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoPathWindows = $scriptDir
$repoPathWsl = (& wsl.exe wslpath -a $repoPathWindows).Trim()

if ([string]::IsNullOrWhiteSpace($repoPathWsl)) {
  throw "Unable to translate Windows path to WSL path: $repoPathWindows"
}

$escapedRepo = Escape-BashSingleQuoted $repoPathWsl
$escapedFile = if ([string]::IsNullOrWhiteSpace($FilePath)) { "" } else { " " + (Escape-BashSingleQuoted $FilePath) }

$compileCommand = "cd $escapedRepo && if ! command -v cc >/dev/null 2>&1; then echo 'cc not found in WSL. Install build tools with: sudo apt update ; sudo apt install -y build-essential'; exit 127; fi && cc -std=c11 -O2 -Wall -Wextra -pedantic -o weedit weedit.c"

if ($CompileOnly) {
  & wsl.exe bash -lc $compileCommand
  exit $LASTEXITCODE
}

$runCommand = "$compileCommand && ./weedit$escapedFile"
& wsl.exe bash -lc $runCommand
exit $LASTEXITCODE
