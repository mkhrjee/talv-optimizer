# TALV Optimizer

Self-serve tool to find the optimal **TALV (Target Average Line Value)** for each
PBS run. Analysts pick one or more widebody bid positions, set the TALV bounds and
the Line Construction Window (LCW), and the tool simulates schedule construction
across the TALV range to find the value that minimizes open time — producing an
interactive dashboard and a downloadable Excel workbook (matching the existing
`TALVs.xlsx`).

This replaces the hand-run Databricks notebook (`TALV Final - 777CALAXI.ipynb`).

## Architecture

```
┌────────────────────┐        ┌──────────────────────────────────────────┐
│  React frontend     │  HTTP  │  Local backend (analyst's machine)        │
│  (GitHub Pages)     │ ─────▶ │  Node API  ──spawns──▶  Python core        │
│  charts + Excel dl  │  SSE   │  (localhost:5178)       pyodbc DSN=Mosaic2 │
└────────────────────┘        └──────────────────────────────────────────┘
```

- **Frontend** (`frontend/`) — React + Vite, deployed to GitHub Pages. Static only.
- **Backend** (`backend/node/`) — zero-dependency Node HTTP server. Serves a small
  JSON/SSE API and (optionally) the built frontend. Runs **locally** because it needs
  the Mosaic ODBC DSN.
- **Python core** (`backend/python/`) — the analytics: Mosaic queries (pyodbc),
  the greedy assignment + TALV sweep, and Excel generation. This is a
  behaviour-preserving port of the notebook (Spark → pandas), with bug fixes flagged
  in the code (`BUGFIX` comments). See [`docs/ALGORITHM.md`](docs/ALGORITHM.md).

Because GitHub Pages is HTTPS and the backend is `http://localhost`, the frontend
detects and calls the local backend. If a browser blocks the cross-origin/localhost
call, the backend can also **serve the app itself** at `http://localhost:5178`
(built into `backend/node/public`).

## Quick start (analyst)

Prerequisites: **Python 3.10+**, **Node.js 18+**, and the **`Mosaic2`** ODBC DSN.

```powershell
# 1. One-time setup (installs deps + builds the local app copy)
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

# 2. Start the backend (live Mosaic)
powershell -ExecutionPolicy Bypass -File scripts\run-backend.ps1
#   ...or just double-click Start-Backend.bat
```

Then open the **GitHub Pages URL** (or `http://localhost:5178` directly) and run.

### Try it without Mosaic (synthetic data)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-backend.ps1 -Mock
```

## Developing

```powershell
# Python core (no server) — synthetic data
cd backend\python
python cli.py --mock run --fourparts 777CALAXI,787CAORDI --out out.xlsx

# Frontend dev server
cd frontend
npm run dev
```

## Configuration

Shared defaults live in [`shared/config.json`](shared/config.json) (TALV bounds, step,
LCW options, widebody fleet codes, Mosaic DSN, backend port) — read by the Python
core, Node backend and frontend.

## Repository layout

| Path | Purpose |
|------|---------|
| `frontend/` | React app (GitHub Pages) |
| `backend/node/` | Local API + SSE + static fallback |
| `backend/python/` | Analytics core, Mosaic queries, Excel generation |
| `shared/config.json` | Single source of shared defaults |
| `scripts/` | Setup and run helpers |
| `docs/` | Algorithm notes and analyst setup guide |
| `.github/workflows/` | GitHub Pages deploy |

See [`docs/SETUP.md`](docs/SETUP.md) for the full analyst guide and troubleshooting.
