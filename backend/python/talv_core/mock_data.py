"""Deterministic synthetic data for local testing without a Mosaic DSN.

Enabled via the CLI ``--mock`` flag. Produces DataFrames shaped exactly like
the real Mosaic queries so the optimizer / Excel paths are exercised faithfully.
"""

from __future__ import annotations

import hashlib
from typing import List

import numpy as np
import pandas as pd

from .contract import ContractPeriod
from .mosaic import prepare_sequences

MOCK_FOURPARTS = ["777CALAXI", "777FOLAXI", "787CAORDI", "787FOMIAI"]


def _seed(text: str) -> int:
    return int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**32)


def _split_fourpart(fp: str):
    return fp[0:3], fp[3:5], fp[5:8], fp[8:] or "I"


def mock_sequences(period: ContractPeriod, four_parts: List[str]) -> pd.DataFrame:
    rows = []
    seq_nbr = 1000
    for fp in four_parts:
        eqp, seat, base, div = _split_fourpart(fp)
        rng = np.random.default_rng(_seed(fp))
        n_seq = int(rng.integers(120, 200))
        span_days = (period.end_date - period.start_date).days
        for _ in range(n_seq):
            seq_nbr += 1
            offset = int(rng.integers(0, max(span_days - 4, 1)))
            length = int(rng.integers(1, 4))
            start = period.start_date + pd.Timedelta(days=offset)
            end = start + pd.Timedelta(days=length - 1)
            block_min = int(rng.integers(240, 1400))
            rig_min = int(rng.integers(0, 300))
            rows.append(
                {
                    "FLIGHT_CREW_CONTRCT_YEAR": period.con_year,
                    "FLIGHT_CREW_CONTRCT_MONTH": period.con_month,
                    "SEQ_NBR": seq_nbr,
                    "SEQ_SCHD_START_DT": start.strftime("%Y-%m-%d"),
                    "SCHD_END_DT": end.strftime("%Y-%m-%d"),
                    "FLIGHT_CREW_BASE_CD": base,
                    "AIRCFT_EQUIP_FLEET_CD": eqp,
                    "SEQ_DIVISION_CD": div,
                    "SEQ_DUTY_PERIOD_CT": length,
                    "SEQ_CALNDR_DAY_CT": length,
                    "SEQ_CREW_POSITN_GROUP_CD": f"{eqp}{seat}",
                    "TTL_BLOCK_TM_STR": _fmt_interval(block_min),
                    "TTL_RIG_TM_STR": _fmt_interval(rig_min),
                    "seat": seat,
                }
            )
    df = pd.DataFrame(rows)
    return prepare_sequences(df)


def _fmt_interval(minutes: int) -> str:
    days, rem = divmod(minutes, 1440)
    hours, mins = divmod(rem, 60)
    return f"{days} {hours:02d}:{mins:02d}"


def mock_absences(four_part: str) -> pd.DataFrame:
    eqp, seat, base, div = _split_fourpart(four_part)
    rng = np.random.default_rng(_seed(four_part + "abs"))
    n_pilots = int(rng.integers(80, 140))
    rows = []
    for i in range(n_pilots):
        rows.append(
            {
                "Prim": four_part,
                "Base": base,
                "Division": div,
                "Seat": seat,
                "EqipmentType": eqp,
                "SEN_INT": i + 1,
                "Employee#": str(100000 + _seed(four_part) % 900000 + i),
                "LastName": f"PILOT{i+1:03d}",
                "PDABS": round(float(rng.uniform(0, 45)), 2),
            }
        )
    df = pd.DataFrame(rows).sort_values("SEN_INT").reset_index(drop=True)
    return df
