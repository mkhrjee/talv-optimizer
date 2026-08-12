# Analyst Setup & Usage Guide

## What you need

| Requirement | Notes |
|-------------|-------|
| **Python 3.10+** | On `PATH` (`python --version`). Provides the analytics. |
| **Node.js 18+** | On `PATH` (`node --version`). Runs the local API. |
| **`Mosaic2` ODBC DSN** | Windows integrated auth. Required for live runs. |

> The tool runs entirely **on your machine**: the local backend serves the web app
> and queries Mosaic through the `Mosaic2` DSN. Nothing is hosted externally and
> nothing sensitive leaves your laptop.

## One-time setup

From the repository folder in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

This installs Python and Node dependencies and builds a local copy of the app.

## Running

1. Start the backend (leave this window open while you work):

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\run-backend.ps1
   ```

   or double-click **`Start-Backend.bat`**.

2. Open the tool at **`http://localhost:5178`** (served by the backend).

3. In the tool:
   - Pick one or more **widebody bid positions** (multi-select; your last selection is
     remembered).
   - Adjust **TALV bounds** (default 72–84) and the **LCW** (± 7 or ± 10) if needed.
   - Click **Run optimization**. Watch the progress bar.
   - Review the **optimal TALV**, interactive charts and summary table.
   - Click **Download Excel** for the `TALVs.xlsx`-style workbook.

The **contract month is detected automatically** (the upcoming month) and shown in the
header.

## Try it without Mosaic

To explore the interface with synthetic data (no DSN needed):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-backend.ps1 -Mock
```

A yellow "mock mode" banner appears so results are never mistaken for real data.

## Troubleshooting

**"Could not reach the local backend"**
- Make sure the backend window is running and shows
  `listening on http://localhost:5178`.
- Reload the page.

**"pyodbc is not installed" / DSN errors**
- Re-run `scripts\setup.ps1`.
- Confirm the DSN exists: it must be named exactly **`Mosaic2`** (ODBC Data Source
  Administrator → System/User DSN).

**Port 5178 already in use**
- Set another port before starting: `"$env:PORT=5200; scripts\run-backend.ps1"`, and
  open `http://localhost:5200`.

**A previously selected position disappeared**
- The position list reflects what is available for the detected contract month; a
  4-part with no sequences this month won't appear.

## How results are produced

See [`ALGORITHM.md`](ALGORITHM.md) for the full method and the list of bug fixes made
when porting from the original notebook.
