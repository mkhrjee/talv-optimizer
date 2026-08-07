"""Greedy sequence-assignment simulation and TALV sweep.

This is a behaviour-preserving but vectorised (NumPy) port of the notebook's
``assignSequences`` / ``calculateOpenTime`` / ``countReserves`` loop, plus the
TALV sweep. Bug fixes are flagged with ``BUGFIX`` comments.

Algorithm summary (per TALV value):
  * Each pilot starts with credit = their planned-absence credit (PDABS).
  * ``Max_Avl`` = (TALV + LCW) - PDABS  -> room to absorb sequence credit.
  * ``Min_Req`` = max(0, (TALV - LCW) - PDABS) -> credit still needed for a line.
  * Sequences are taken best-first (highest credit/day) and assigned to the
    first available pilot (seniority order) with enough remaining ``Max_Avl``
    and no day conflict (occupied days + trailing rest days).
  * A pilot whose ``Min_Req`` is still > 0 afterwards is a Reserve; the credit
    assigned to Reserves is counted as "open time".
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

import numpy as np
import pandas as pd

from .contract import ContractPeriod, fmt_day


def determine_rest_days(total_hours: float) -> int:
    """Rest days required after a sequence, by credit hours."""
    if total_hours < 10:
        return 0
    if total_hours < 20:
        return 1
    if total_hours < 30:
        return 2
    return 3


@dataclass
class _Seq:
    total: float
    need: np.ndarray  # int indices of occupied + rest day-columns


def _build_sequence_index(
    sequences: pd.DataFrame, period: ContractPeriod
) -> List[_Seq]:
    """Precompute the day-column indices each sequence occupies (+ rest days)."""
    day_index = {name: i for i, name in enumerate(period.date_columns)}
    n_days = len(period.date_columns)
    built: List[_Seq] = []

    for _, seq in sequences.iterrows():
        start = seq["SEQ_SCHD_START_DT"]
        end = seq["SCHD_END_DT"]
        if pd.isna(start) or pd.isna(end):
            built.append(_Seq(total=float(seq["Total"]), need=np.empty(0, dtype=int)))
            continue

        occupied: List[int] = []
        for d in pd.date_range(start=start, end=end):
            idx = day_index.get(fmt_day(d.date()))
            # BUGFIX: silently skip days that fall outside the matrix window
            # instead of raising an IndexError (notebook assumed every day
            # existed as a column).
            if idx is not None:
                occupied.append(idx)

        rest = determine_rest_days(float(seq["Total"]))
        if occupied:
            last = max(occupied)
            # BUGFIX: rest days are assigned by calendar position for BOTH the
            # availability check and the marking. The notebook checked
            # availability using fragile ``%b%-d`` string parsing (which breaks
            # on Windows and across month/year boundaries) but marked rest days
            # by column position -- an inconsistency. We unify on position.
            rest_idx = [last + k for k in range(1, rest + 1) if last + k < n_days]
        else:
            rest_idx = []

        need = np.array(sorted(set(occupied) | set(rest_idx)), dtype=int)
        built.append(_Seq(total=float(seq["Total"]), need=need))

    return built


def _round(x: float, ndigits: int = 2) -> float:
    return float(np.round(x, ndigits))


def _talv_values(low: float, high: float, step: float) -> List[float]:
    n = int(round((high - low) / step)) + 1
    return [round(low + i * step, 2) for i in range(n)]


@dataclass
class GroupResult:
    four_part: str
    total_credit: float
    total_pilots: int
    optimal_talv: float
    best_open_time: float
    talvs: List[float]
    lineholders: List[int]
    reserves: List[int]
    open_times: List[float]
    employees: List[str]
    planned_absence: List[float]
    tracker: Dict[str, List[Optional[float]]]  # "TALV: xx.x" -> per-pilot values
    reserve_flag: Dict[str, List[bool]]        # same keys -> per-pilot reserve mask

    def summary_records(self) -> List[dict]:
        return [
            {
                "talv": self.talvs[i],
                "lineholders": self.lineholders[i],
                "reserves": self.reserves[i],
                "openTime": self.open_times[i],
            }
            for i in range(len(self.talvs))
        ]


def run_group_sweep(
    four_part: str,
    sequences: pd.DataFrame,
    absences: pd.DataFrame,
    period: ContractPeriod,
    talv_low: float,
    talv_high: float,
    talv_step: float,
    lcw: int,
    progress_cb: Optional[Callable[[float, int, int], None]] = None,
) -> GroupResult:
    """Run the TALV sweep for a single 4-part group."""
    seqs = sequences[sequences["4 Part"] == four_part].copy()
    seqs = seqs.sort_values(by="CreditperDay", ascending=False)
    total_credit = float(seqs["Total"].sum())

    seq_index = _build_sequence_index(seqs, period)
    seq_totals = np.array([s.total for s in seq_index], dtype=float)
    seq_needs = [s.need for s in seq_index]

    employees = absences["Employee#"].astype(str).tolist()
    pdabs = absences["PDABS"].to_numpy(dtype=float)
    n_pilots = len(employees)
    n_days = len(period.date_columns)

    # Sweep from high -> low so ties keep the higher TALV (matches notebook).
    talv_desc = list(reversed(_talv_values(talv_low, talv_high, talv_step)))
    total_steps = len(talv_desc)

    results_by_talv: Dict[float, dict] = {}
    best_open_time = float("inf")
    optimal_talv = talv_desc[0] if talv_desc else talv_high

    for step_i, talv in enumerate(talv_desc):
        max_credit = talv + lcw
        min_credit = talv - lcw

        max_avl = max_credit - pdabs
        min_req = min_credit - pdabs
        min_req = np.where(min_req < 0, 0.0, min_req)  # resetMinReq
        cred = pdabs.copy()  # Cred_Hrs starts at PDABS

        occ = np.zeros((n_pilots, n_days), dtype=bool)

        for total, need in zip(seq_totals, seq_needs):
            if n_pilots == 0:
                break
            eligible = max_avl >= total
            if need.size:
                conflict = occ[:, need].any(axis=1)
                eligible &= ~conflict
            if not eligible.any():
                continue
            p = int(np.argmax(eligible))  # first eligible pilot (seniority order)
            if need.size:
                occ[p, need] = True
            cred[p] += total
            max_avl[p] -= total
            min_req[p] -= total

        is_reserve = min_req > 0
        # BUGFIX: the notebook's calculateOpenTime raised UnboundLocalError when
        # there were zero reserves (the percentage was only set inside the loop).
        # Here open time is well-defined and 0 when there are no reserves. The
        # credit assigned to sub-minimum (reserve) pilots is returned to open
        # time: (Cred_Hrs - PDABS) summed over reserves.
        open_credit = float(np.sum((cred[is_reserve] - pdabs[is_reserve])))
        open_time_perc = _round(open_credit / total_credit * 100, 2) if total_credit > 0 else 0.0
        reserves = int(np.count_nonzero(is_reserve))

        results_by_talv[talv] = {
            "open_time": open_time_perc,
            "reserves": reserves,
            "tracker": (cred - pdabs).copy(),
        }

        if open_time_perc < best_open_time:
            best_open_time = open_time_perc
            optimal_talv = talv

        if progress_cb is not None:
            progress_cb(talv, step_i + 1, total_steps)

    # Assemble ascending-ordered outputs for charts/tables.
    talvs_asc = _talv_values(talv_low, talv_high, talv_step)
    lineholders: List[int] = []
    reserves_list: List[int] = []
    open_times: List[float] = []
    tracker: Dict[str, List[Optional[float]]] = {}
    reserve_flag: Dict[str, List[bool]] = {}

    for talv in talvs_asc:
        r = results_by_talv[talv]
        reserves_list.append(r["reserves"])
        lineholders.append(n_pilots - r["reserves"])
        open_times.append(r["open_time"])

        key = f"TALV: {talv}"
        vals = r["tracker"]
        # Reserve when (seq credit + PDABS) < (TALV - LCW), i.e. below minimum.
        flag = (vals + pdabs) < (talv - lcw)
        tracker[key] = [float(v) for v in vals]
        reserve_flag[key] = [bool(b) for b in flag]

    return GroupResult(
        four_part=four_part,
        total_credit=_round(total_credit, 2),
        total_pilots=n_pilots,
        optimal_talv=float(optimal_talv),
        best_open_time=_round(best_open_time, 2) if best_open_time != float("inf") else 0.0,
        talvs=talvs_asc,
        lineholders=lineholders,
        reserves=reserves_list,
        open_times=open_times,
        employees=employees,
        planned_absence=[float(x) for x in pdabs],
        tracker=tracker,
        reserve_flag=reserve_flag,
    )
