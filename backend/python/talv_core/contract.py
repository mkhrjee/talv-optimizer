"""Contract-month detection and assignment-matrix date range.

Ported verbatim (behaviour-preserving) from the notebook, with Windows-safe
date formatting.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Dict, List, Tuple


def get_contract_months(year: int) -> Dict[str, Tuple[datetime.date, datetime.date]]:
    """AA contract-month boundaries (not calendar months) for a given year."""
    return {
        "January": (datetime.date(year, 1, 1), datetime.date(year, 1, 30)),
        "February": (datetime.date(year, 1, 31), datetime.date(year, 3, 1)),
        "March": (datetime.date(year, 3, 2), datetime.date(year, 3, 31)),
        "April": (datetime.date(year, 4, 1), datetime.date(year, 5, 1)),
        "May": (datetime.date(year, 5, 2), datetime.date(year, 6, 1)),
        "June": (datetime.date(year, 6, 2), datetime.date(year, 7, 1)),
        "July": (datetime.date(year, 7, 2), datetime.date(year, 7, 31)),
        "August": (datetime.date(year, 8, 1), datetime.date(year, 8, 30)),
        "September": (datetime.date(year, 8, 31), datetime.date(year, 9, 30)),
        "October": (datetime.date(year, 10, 1), datetime.date(year, 10, 31)),
        "November": (datetime.date(year, 11, 1), datetime.date(year, 12, 1)),
        "December": (datetime.date(year, 12, 2), datetime.date(year, 12, 31)),
    }


def fmt_day(d: datetime.date) -> str:
    """Format a date as e.g. ``Jan1`` (Windows-safe; avoids ``%-d``)."""
    return f"{d.strftime('%b')}{d.day}"


@dataclass
class ContractPeriod:
    today: datetime.date
    contract_month_date: datetime.date
    contract_month_name: str
    con_year: str
    con_month: str
    start_date: datetime.date
    end_date: datetime.date
    adj_start_date: datetime.date
    adj_end_date: datetime.date
    date_columns: List[str]

    @property
    def pbs(self) -> str:
        return f"{self.con_year}-{self.con_month}-v01"


def detect_contract_period(today: datetime.date | None = None) -> ContractPeriod:
    """Detect the upcoming contract month and build the assignment date range."""
    today = today or datetime.date.today()

    # Next contract month = first of this month + 31 days (lands in next month).
    contract_month_date = today.replace(day=1) + datetime.timedelta(days=31)
    contract_month_name = contract_month_date.strftime("%B")
    con_year = str(contract_month_date.year)
    con_month = contract_month_date.strftime("%m")

    bounds = get_contract_months(contract_month_date.year)[contract_month_name]
    start_date, end_date = bounds
    adj_start_date = start_date - datetime.timedelta(days=1)
    adj_end_date = end_date + datetime.timedelta(days=8)

    date_columns: List[str] = []
    current = adj_start_date
    while current <= adj_end_date:
        date_columns.append(fmt_day(current))
        current += datetime.timedelta(days=1)

    return ContractPeriod(
        today=today,
        contract_month_date=contract_month_date,
        contract_month_name=contract_month_name,
        con_year=con_year,
        con_month=con_month,
        start_date=start_date,
        end_date=end_date,
        adj_start_date=adj_start_date,
        adj_end_date=adj_end_date,
        date_columns=date_columns,
    )
