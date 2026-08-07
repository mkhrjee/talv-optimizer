@echo off
REM Double-click launcher for the TALV Optimizer local backend (live Mosaic).
REM Requires Node.js and Python on PATH and the "Mosaic2" ODBC DSN.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-backend.ps1"
pause
