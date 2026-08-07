"""Configuration loading for the TALV core.

Reads defaults from ``shared/config.json`` so the Python core, Node backend and
React frontend all share a single source of truth.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import List


def _shared_config_path() -> Path:
    # backend/python/talv_core/config.py -> repo root is three parents up.
    return Path(__file__).resolve().parents[3] / "shared" / "config.json"


@dataclass
class Settings:
    talv_low: float = 72.0
    talv_high: float = 84.0
    talv_step: float = 0.1
    lcw: int = 7
    lcw_options: List[int] = field(default_factory=lambda: [7, 10])
    dsn: str = "Mosaic2"
    widebody_fleets: List[str] = field(default_factory=lambda: ["777", "787"])


def load_settings(path: str | Path | None = None) -> Settings:
    cfg_path = Path(path) if path else _shared_config_path()
    data = json.loads(cfg_path.read_text(encoding="utf-8"))
    defaults = data.get("defaults", {})
    return Settings(
        talv_low=float(defaults.get("talvLow", 72.0)),
        talv_high=float(defaults.get("talvHigh", 84.0)),
        talv_step=float(defaults.get("talvStep", 0.1)),
        lcw=int(defaults.get("lcw", 7)),
        lcw_options=[int(x) for x in defaults.get("lcwOptions", [7, 10])],
        dsn=str(data.get("mosaic", {}).get("dsn", "Mosaic2")),
        widebody_fleets=[str(x) for x in data.get("widebodyFleets", ["777", "787"])],
    )
