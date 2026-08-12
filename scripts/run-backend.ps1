<#
  Starts the TALV Optimizer local backend on http://localhost:5178.

  Usage:
    scripts\run-backend.ps1           # live Mosaic data (DSN=Mosaic2)
    scripts\run-backend.ps1 -Mock     # synthetic data, no Mosaic needed
#>
param(
  [switch]$Mock
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

if ($Mock) { $env:TALV_MOCK = "1" } else { $env:TALV_MOCK = "0" }

Write-Host "Starting TALV Optimizer backend (Mock=$($Mock.IsPresent))..." -ForegroundColor Cyan
Write-Host "Open http://localhost:5178 in your browser.`n" -ForegroundColor Green

Set-Location (Join-Path $repo "backend\node")
node server.js
