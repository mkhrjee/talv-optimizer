<#
  TALV Optimizer - one-click launcher.

  Double-clicking "Start TALV Optimizer.bat" at the top of the folder runs this
  script. It takes care of everything needed to open the tool:
    - checks that the required components are present
    - prepares the tool the very first time it is run (only happens once)
    - starts the tool and opens it in your browser automatically

  Leave the black window open while you use the tool. Closing the window
  stops the tool.
#>

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$port = 5178
if ($env:PORT) { $port = $env:PORT }
$url = "http://localhost:$port"

function Write-Step($msg) {
  Write-Host ""
  Write-Host $msg -ForegroundColor Cyan
}

function Fail-Friendly($reason) {
  Write-Host ""
  Write-Host "===================================================================" -ForegroundColor Red
  Write-Host " The TALV Optimizer could not start."                                -ForegroundColor Red
  Write-Host " Please contact the tool owner or your support team for help."       -ForegroundColor Red
  Write-Host " Details: $reason"                                                   -ForegroundColor Red
  Write-Host "===================================================================" -ForegroundColor Red
  Write-Host ""
  Read-Host "Press Enter to close this window"
  exit 1
}

Write-Host "===================================================================" -ForegroundColor DarkCyan
Write-Host "  TALV Optimizer" -ForegroundColor DarkCyan
Write-Host "===================================================================" -ForegroundColor DarkCyan

# --- 1. Make sure the required components are present -----------------------
$havePython = $null -ne (Get-Command python -ErrorAction SilentlyContinue)
$haveNode = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
$haveNpm = $null -ne (Get-Command npm -ErrorAction SilentlyContinue)

if (-not $havePython) { Fail-Friendly "Python is not installed on this computer." }
if (-not $haveNode -or -not $haveNpm) { Fail-Friendly "Node.js is not installed on this computer." }

# --- 2. First-time preparation (only runs once) ------------------------------
$publicDir = Join-Path $repo "backend\node\public"
$publicReady = Test-Path (Join-Path $publicDir "index.html")
$nodeModulesReady = Test-Path (Join-Path $repo "frontend\node_modules")

$pythonPackagesReady = $true
try {
  python -c "import pandas, numpy, openpyxl, pyodbc" 2>$null
  if ($LASTEXITCODE -ne 0) { $pythonPackagesReady = $false }
} catch {
  $pythonPackagesReady = $false
}

if (-not $publicReady -or -not $nodeModulesReady -or -not $pythonPackagesReady) {
  Write-Step "Preparing the TALV Optimizer for first use - this can take a few minutes..."

  try {
    python -m pip install --quiet -r (Join-Path $repo "backend\python\requirements.txt")
  } catch {
    Fail-Friendly "Could not install required components ($($_.Exception.Message))"
  }

  Push-Location (Join-Path $repo "frontend")
  try {
    npm install --no-audit --no-fund --silent
    npm run build --silent
  } catch {
    Pop-Location
    Fail-Friendly "Could not prepare the tool ($($_.Exception.Message))"
  }
  Pop-Location

  New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
  Get-ChildItem $publicDir -Force -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $repo "frontend\dist\*") $publicDir -Recurse -Force

  Write-Host "Done preparing the tool." -ForegroundColor Green
}

# --- 3. Start the tool --------------------------------------------------------
Write-Step "Starting the TALV Optimizer..."

if (-not $env:TALV_MOCK) { $env:TALV_MOCK = "0" }

$serverDir = Join-Path $repo "backend\node"
$proc = Start-Process -FilePath "node" -ArgumentList "server.js" `
  -WorkingDirectory $serverDir -NoNewWindow -PassThru

# Wait for the tool to be ready (up to ~30 seconds) before opening the browser.
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $resp = Invoke-WebRequest -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 1
    if ($resp.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
  if ($proc.HasExited) { Fail-Friendly "The tool closed unexpectedly while starting." }
}

if ($ready) {
  Write-Host "Opening the TALV Optimizer in your browser..." -ForegroundColor Green
  Start-Process $url
} else {
  Write-Host "The tool is taking longer than expected to start." -ForegroundColor Yellow
  Write-Host "Open $url in your browser once it is ready." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "===================================================================" -ForegroundColor DarkCyan
Write-Host " The TALV Optimizer is running."                                       -ForegroundColor DarkCyan
Write-Host " Keep this window open while you use the tool."                        -ForegroundColor DarkCyan
Write-Host " To stop the tool, close this window."                                 -ForegroundColor DarkCyan
Write-Host "===================================================================" -ForegroundColor DarkCyan
Write-Host ""

Wait-Process -Id $proc.Id
