"""Mosaic (Teradata via ODBC) data access + pandas data preparation.

Replaces the notebook's Spark ``Orion`` / ``mosaic.mq`` calls with a local
``pyodbc.connect('DSN=Mosaic2')`` connection and ``pandas.read_sql``.

BUGFIX (security): the notebook hard-coded a username/password. Those are
removed entirely -- the ``Mosaic2`` DSN uses integrated authentication.
"""

from __future__ import annotations

import warnings
from typing import List, Optional

import pandas as pd

# pyodbc is only needed at runtime on an analyst machine with the DSN.
try:  # pragma: no cover - import guard
    import pyodbc  # type: ignore
except Exception:  # pragma: no cover
    pyodbc = None


def get_connection(dsn: str = "Mosaic2"):
    """Open a pyodbc connection to Mosaic using integrated auth."""
    if pyodbc is None:
        raise RuntimeError(
            "pyodbc is not installed. Run `pip install -r requirements.txt`."
        )
    return pyodbc.connect(f"DSN={dsn}")


def _read_sql(query: str, conn) -> pd.DataFrame:
    with warnings.catch_warnings():
        # pandas warns when using a DBAPI connection that isn't SQLAlchemy.
        warnings.simplefilter("ignore")
        return pd.read_sql(query, conn)


# --------------------------------------------------------------------------- #
# Queries
# --------------------------------------------------------------------------- #
SEQUENCES_SQL = """
SELECT
    s.FLIGHT_CREW_CONTRCT_YEAR,
    s.FLIGHT_CREW_CONTRCT_MONTH,
    s.SEQ_NBR,
    s.SEQ_SCHD_START_DT,
    s.SCHD_END_DT,
    s.FLIGHT_CREW_BASE_CD,
    s.AIRCFT_EQUIP_FLEET_CD,
    s.SEQ_DIVISION_CD,
    s.SEQ_DUTY_PERIOD_CT,
    s.SEQ_CALNDR_DAY_CT,
    s.SEQ_CREW_POSITN_GROUP_CD,
    CAST(s.TTL_BLOCK_TM AS VARCHAR(20)) AS TTL_BLOCK_TM_STR,
    CAST(s.TTL_RIG_TM AS VARCHAR(20)) AS TTL_RIG_TM_STR,
    CASE
        WHEN p.CREW_MBR_POSITN_CD = 1 THEN 'CA'
        WHEN p.CREW_MBR_POSITN_CD = 2 THEN 'FO'
        WHEN p.CREW_MBR_POSITN_CD = 7 THEN 'FO'
        WHEN p.CREW_MBR_POSITN_CD = 6 THEN 'FO'
        WHEN p.CREW_MBR_POSITN_CD = 8 THEN 'CA'
    END AS seat
FROM
    PROD_FLIGHT_CREW_VWS.FLIGHT_CREW_PAIRED_SEQ s
    LEFT JOIN
    PROD_FLTCREW_ANALYTICS_DB.DPM_POSITN_XREF p
    ON s.SEQ_CREW_POSITN_GROUP_CD = p.SEQ_CREW_POSITN_GROUP_CD
WHERE
    s.FLIGHT_CREW_CONTRCT_YEAR = {year}
    AND s.FLIGHT_CREW_CONTRCT_MONTH = {month}
    AND s.ROW_EXPIRY_DT = '9999-12-31'
    AND s.FLIGHT_CREW_GROUP_CD = 'PI'
"""

ABSENCES_SQL = """
SELECT
    CONCAT(EQP, SEAT, BASE, DIVISION) AS Prim,
    BASE AS Base,
    DIVISION AS Division,
    SEAT AS Seat,
    EQP AS EqipmentType,
    CAST(SENIORITY AS INTEGER) AS SEN_INT,
    EEID AS Employee_Num,
    LAST_NAME AS LastName,
    TOTAL_CREDIT AS PDABS
FROM
    DTLAB_OPP_SNBX.HEADS
WHERE
    CONCAT(EQP, SEAT, BASE, DIVISION) = '{four_part}'
    AND PBS = '{pbs}'
    AND DNI_CALC = 'FALSE'
    AND CREATED = (
        SELECT MAX(CREATED)
        FROM DTLAB_OPP_SNBX.HEADS
        WHERE CONCAT(EQP, SEAT, BASE, DIVISION) = '{four_part}'
            AND PBS = '{pbs}'
            AND DNI_CALC = 'FALSE'
    )
"""


def fetch_sequences(conn, year: str, month: str) -> pd.DataFrame:
    """Fetch raw paired sequences and derive credit fields (pandas port)."""
    df = _read_sql(SEQUENCES_SQL.format(year=year, month=month), conn)
    return prepare_sequences(df)


def prepare_sequences(df: pd.DataFrame) -> pd.DataFrame:
    """Port of the notebook's Spark transforms to pandas.

    Parses the interval strings ("D HH:MM") into total minutes, then builds the
    ``4 Part`` key, ``Total`` credit hours and ``CreditperDay``.
    """
    df = df.copy()

    def to_minutes(series: pd.Series) -> pd.Series:
        s = series.astype("string").fillna("")
        day = s.str.extract(r"(\d+)\s", expand=False).astype("float").fillna(0)
        hour = s.str.extract(r"\s(\d+):", expand=False).astype("float").fillna(0)
        minute = s.str.extract(r":(\d+)", expand=False).astype("float").fillna(0)
        return day * 1440 + hour * 60 + minute

    df["TOT_BLOCK_MI"] = to_minutes(df["TTL_BLOCK_TM_STR"])
    df["TOT_RIG_MI"] = to_minutes(df["TTL_RIG_TM_STR"])

    df["4 Part"] = (
        df["AIRCFT_EQUIP_FLEET_CD"].astype("string").fillna("")
        + df["seat"].astype("string").fillna("")
        + df["FLIGHT_CREW_BASE_CD"].astype("string").fillna("")
        + df["SEQ_DIVISION_CD"].astype("string").fillna("")
    )

    df["Total"] = ((df["TOT_BLOCK_MI"] + df["TOT_RIG_MI"]) / 60).round(2)

    # Guard against divide-by-zero on calendar-day count.
    day_ct = pd.to_numeric(df["SEQ_CALNDR_DAY_CT"], errors="coerce")
    df["CreditperDay"] = df["Total"] / day_ct.where(day_ct > 0)

    # Parse schedule dates to real datetimes for the assignment matrix.
    df["SEQ_SCHD_START_DT"] = pd.to_datetime(df["SEQ_SCHD_START_DT"], errors="coerce")
    df["SCHD_END_DT"] = pd.to_datetime(df["SCHD_END_DT"], errors="coerce")

    return df


def fetch_absences(conn, four_part: str, pbs: str) -> pd.DataFrame:
    """Fetch the pilot roster + planned absence credit for a 4-part group."""
    df = _read_sql(ABSENCES_SQL.format(four_part=four_part, pbs=pbs), conn)
    df = df.rename(columns={"Employee_Num": "Employee#"})
    df["PDABS"] = pd.to_numeric(df["PDABS"], errors="coerce").fillna(0.0)
    df = df.sort_values("SEN_INT").reset_index(drop=True)
    return df


def fetch_widebody_fourparts(
    conn, year: str, month: str, fleets: List[str]
) -> List[dict]:
    """Return the distinct widebody 4-part bid positions available this month.

    Derived from the same sequences source so the list always reflects what can
    actually be run.
    """
    seq = fetch_sequences(conn, year, month)
    return summarize_fourparts(seq, fleets)


def summarize_fourparts(seq: pd.DataFrame, fleets: List[str]) -> List[dict]:
    fleet_set = {str(f) for f in fleets}
    wb = seq[seq["AIRCFT_EQUIP_FLEET_CD"].astype("string").isin(fleet_set)].copy()
    grouped = (
        wb.groupby("4 Part")
        .agg(
            equipment=("AIRCFT_EQUIP_FLEET_CD", "first"),
            seat=("seat", "first"),
            base=("FLIGHT_CREW_BASE_CD", "first"),
            division=("SEQ_DIVISION_CD", "first"),
            sequences=("SEQ_NBR", "count"),
        )
        .reset_index()
        .sort_values(["base", "equipment", "seat"])
    )
    out: List[dict] = []
    for _, r in grouped.iterrows():
        four_part = str(r["4 Part"])
        out.append(
            {
                "fourPart": four_part,
                "equipment": str(r["equipment"]),
                "seat": str(r["seat"]),
                "base": str(r["base"]),
                "division": str(r["division"]),
                "label": f"{r['base']} {r['equipment']} {r['seat']}",
                "sequences": int(r["sequences"]),
            }
        )
    return out
