"""Command-line entry point for the TALV core.

Emits newline-delimited JSON (NDJSON) to stdout so the Node backend can stream
progress to the browser. Each line is a JSON object with a ``type`` field:

  {"type": "period", ...}
  {"type": "fourparts", "items": [...]}
  {"type": "progress", "fourPart": "...", "talv": 80.0, "step": 5, "total": 121}
  {"type": "groupResult", ...}
  {"type": "result", "optimalByGroup": {...}, "excelPath": "..."}
  {"type": "error", "message": "..."}

Usage:
  python cli.py period [--mock]
  python cli.py list-fourparts [--mock]
  python cli.py run --fourparts A,B --talv-low 72 --talv-high 84 --lcw 7 \
                    --out results.xlsx [--mock]
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from typing import List, Optional

from talv_core.config import load_settings
from talv_core.contract import detect_contract_period
from talv_core import mosaic
from talv_core.excel import build_workbook
from talv_core.optimizer import run_group_sweep


def emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def _period_payload(period) -> dict:
    return {
        "type": "period",
        "today": period.today.isoformat(),
        "contractMonth": period.contract_month_name,
        "contractYear": period.con_year,
        "contractMonthNum": period.con_month,
        "pbs": period.pbs,
        "startDate": period.start_date.isoformat(),
        "endDate": period.end_date.isoformat(),
    }


def cmd_period(args) -> int:
    period = detect_contract_period()
    emit(_period_payload(period))
    return 0


def cmd_list_fourparts(args) -> int:
    settings = load_settings()
    period = detect_contract_period()
    emit(_period_payload(period))

    if args.mock:
        from talv_core.mock_data import mock_sequences, MOCK_FOURPARTS

        seq = mock_sequences(period, MOCK_FOURPARTS)
        items = mosaic.summarize_fourparts(seq, settings.widebody_fleets)
    else:
        conn = mosaic.get_connection(settings.dsn)
        try:
            items = mosaic.fetch_widebody_fourparts(
                conn, period.con_year, period.con_month, settings.widebody_fleets
            )
        finally:
            conn.close()

    emit({"type": "fourparts", "items": items})
    return 0


def cmd_run(args) -> int:
    settings = load_settings()
    period = detect_contract_period()
    emit(_period_payload(period))

    four_parts: List[str] = [x.strip() for x in args.fourparts.split(",") if x.strip()]
    if not four_parts:
        emit({"type": "error", "message": "No 4-parts provided."})
        return 2

    if args.mock:
        from talv_core.mock_data import mock_sequences, mock_absences

        sequences = mock_sequences(period, four_parts)
        conn = None
    else:
        conn = mosaic.get_connection(settings.dsn)
        sequences = mosaic.fetch_sequences(conn, period.con_year, period.con_month)

    results = []
    optimal_by_group = {}
    try:
        for fp in four_parts:
            if args.mock:
                from talv_core.mock_data import mock_absences

                absences = mock_absences(fp)
            else:
                absences = mosaic.fetch_absences(conn, fp, period.pbs)

            def progress_cb(talv, step, total, _fp=fp):
                emit(
                    {
                        "type": "progress",
                        "fourPart": _fp,
                        "talv": talv,
                        "step": step,
                        "total": total,
                    }
                )

            result = run_group_sweep(
                four_part=fp,
                sequences=sequences,
                absences=absences,
                period=period,
                talv_low=args.talv_low,
                talv_high=args.talv_high,
                talv_step=settings.talv_step,
                lcw=args.lcw,
                progress_cb=progress_cb,
            )
            results.append(result)
            optimal_by_group[fp] = {
                "optimalTalv": result.optimal_talv,
                "bestOpenTime": result.best_open_time,
                "totalPilots": result.total_pilots,
                "totalCredit": result.total_credit,
            }
            emit(
                {
                    "type": "groupResult",
                    "fourPart": fp,
                    "optimalTalv": result.optimal_talv,
                    "bestOpenTime": result.best_open_time,
                    "totalPilots": result.total_pilots,
                    "totalCredit": result.total_credit,
                    "summary": result.summary_records(),
                    "employees": result.employees,
                    "plannedAbsence": result.planned_absence,
                    "tracker": result.tracker,
                    "reserveFlag": result.reserve_flag,
                }
            )
    finally:
        if conn is not None:
            conn.close()

    excel_path: Optional[str] = None
    if args.out:
        excel_path = build_workbook(results, args.out)

    emit(
        {
            "type": "result",
            "optimalByGroup": optimal_by_group,
            "excelPath": excel_path,
        }
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TALV optimizer core")
    parser.add_argument("--mock", action="store_true", help="Use synthetic data (no Mosaic).")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("period", help="Print the detected contract period.")
    sub.add_parser("list-fourparts", help="List available widebody 4-parts.")

    run_p = sub.add_parser("run", help="Run the TALV sweep.")
    run_p.add_argument("--fourparts", required=True, help="Comma-separated 4-part codes.")
    run_p.add_argument("--talv-low", type=float, default=None)
    run_p.add_argument("--talv-high", type=float, default=None)
    run_p.add_argument("--lcw", type=int, default=None)
    run_p.add_argument("--out", default=None, help="Path to write the .xlsx workbook.")

    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    # Apply config defaults for optional numeric args.
    settings = load_settings()
    if getattr(args, "talv_low", None) is None:
        args.talv_low = settings.talv_low
    if getattr(args, "talv_high", None) is None:
        args.talv_high = settings.talv_high
    if getattr(args, "lcw", None) is None:
        args.lcw = settings.lcw

    try:
        if args.command == "period":
            return cmd_period(args)
        if args.command == "list-fourparts":
            return cmd_list_fourparts(args)
        if args.command == "run":
            return cmd_run(args)
    except Exception as exc:  # pragma: no cover
        emit({"type": "error", "message": str(exc), "trace": traceback.format_exc()})
        return 1

    parser.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
