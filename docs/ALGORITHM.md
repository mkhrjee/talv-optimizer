# The TALV Optimization Algorithm

This document explains what the tool computes and records the changes made when
porting the original Databricks/Spark notebook to the local pandas + pyodbc core.

## Concept

**TALV (Target Average Line Value)** is the credit-hour target PBS uses to build
each pilot's monthly line. The tool answers: *for the upcoming contract month and a
given bid position (4-part), what TALV minimizes open time?*

- **4-part** = Equipment + Seat + Base + Division, e.g. `777CALAXI` → 777 / CA / LAX / I.
- **LCW (Line Construction Window)** = ± credit hours around TALV that a line may be
  built to (default ±7, alternative ±10).
- **Open time** = flying that could not be placed on a full line (assigned to pilots
  who fall to Reserve). Lower is better.

## Steps

1. **Detect the contract month** — the next month after today, with AA contract-month
   date boundaries (`contract.py`).
2. **Pull sequences** for the month (`FLIGHT_CREW_PAIRED_SEQ`), parse block/rig time to
   minutes, compute `Total` credit hours and `CreditperDay`, and sort best-first.
3. **Pull the roster + planned absences** (`HEADS`) for the 4-part; each pilot has a
   planned-absence credit `PDABS`.
4. **Sweep TALV** from high to low (default 84.0 → 72.0, step 0.1). For each value:
   - Each pilot starts with credit = `PDABS`.
   - `Max_Avl = (TALV + LCW) − PDABS` (room to absorb sequences).
   - `Min_Req = max(0, (TALV − LCW) − PDABS)` (credit still needed for a line).
   - **Greedy assignment**: take sequences best-first; assign each to the first
     available pilot (seniority order) with enough `Max_Avl` and no day conflict
     (occupied days + trailing rest days). Rest days: `<10h→0, <20h→1, <30h→2, else 3`.
   - A pilot with `Min_Req > 0` afterwards is a **Reserve**; the sequence credit given
     to Reserves counts as **open time**.
   - Record Lineholders, Reserves and Open Time %.
5. **Pick the optimal TALV** = the value with the lowest open time % (ties keep the
   higher TALV).
6. **Output** — interactive charts + tables in the browser, and an Excel workbook with
   one sheet per 4-part (summary table + per-pilot credit tracker + embedded chart),
   matching the analysts' existing `TALVs.xlsx`.

## Port notes & bug fixes (flagged in code as `BUGFIX`)

| Area | Notebook behaviour | Change |
|------|--------------------|--------|
| Data source | Spark `Orion` / `mosaic.mq` | `pyodbc.connect('DSN=Mosaic2')` + `pandas.read_sql` |
| Credentials | Hard-coded username/password | Removed — DSN uses integrated auth |
| `calculateOpenTime` | `open_time_perc` only set inside the `Min_Req>0` branch → `UnboundLocalError` when there were **no reserves** | Open time is computed after the loop and is well-defined (0 when no reserves) |
| `isReqd` helper | Referenced non-existent columns `"Employee"` / `"Min_Reqd"` (would crash; unused) | Dropped; reserve status derived directly from `Min_Req` |
| Rest-day dates | Availability check used `%b%-d` string parsing (`%-d` is invalid on Windows; breaks across month/year) but marked rest days by column position — inconsistent | Unified: occupied + rest days computed by **calendar column position** |
| Out-of-window days | Assumed every sequence day existed as a matrix column (could `IndexError`) | Days outside the assignment window are skipped safely |
| `SEQ_CALNDR_DAY_CT = 0` | Would divide by zero in `CreditperDay` | Guarded (NaN instead of error) |
| Performance | `DataFrame.iterrows` triple loop (slow) | Vectorised with NumPy occupancy arrays — same result, seconds instead of minutes |

The numeric semantics (starting credit = PDABS, `Max_Avl` / `Min_Req` definitions,
greedy best-first / seniority-order assignment, reserve = `Min_Req > 0`, open time =
Σ over reserves of `Cred_Hrs − PDABS`, and the `8888` reserve marker in the tracker)
are preserved.

## Assumptions to confirm

- **Widebody fleets** are configured in `shared/config.json` (`777`, `787`, `767`,
  `330`, `350`); adjust to match the fleets actually in service.
- Tie-breaking prefers the **higher** TALV when two values have equal open time
  (matches the notebook's high→low sweep).
