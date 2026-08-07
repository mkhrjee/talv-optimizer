"""TALV optimization core package.

Ports the original Databricks/Spark notebook logic to local pandas + pyodbc,
with bug fixes flagged in-line (see comments prefixed with ``BUGFIX``).
"""

from .config import Settings, load_settings  # noqa: F401
