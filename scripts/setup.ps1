<#
  One-time setup for the TALV Optimizer local tool (fully local — nothing is
  hosted externally).
  - Installs Python dependencies (backend/python/requirements.txt)
  - Installs frontend npm dependencies and builds the app into
    backend/node/public, so the local backend can serve it directly at
    http://localhost:5178.

  Prerequisites: Python 3.10+ and Node.js 18+ on PATH, plus the "Mosaic2"
  ODBC DSN configured for live runs.
#>
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

Write-Host "== Installing Python dependencies ==" -ForegroundColor Cyan
python -m pip install -r (Join-Path $repo "backend\python\requirements.txt")

Write-Host "== Installing frontend dependencies ==" -ForegroundColor Cyan
Push-Location (Join-Path $repo "frontend")
npm install --no-audit --no-fund

Write-Host "== Building frontend ==" -ForegroundColor Cyan
npm run build
Pop-Location

$pub = Join-Path $repo "backend\node\public"
New-Item -ItemType Directory -Force -Path $pub | Out-Null
Get-ChildItem $pub -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $repo "frontend\dist\*") $pub -Recurse -Force

Write-Host "`nSetup complete. Start the backend with scripts\run-backend.ps1" -ForegroundColor Green
