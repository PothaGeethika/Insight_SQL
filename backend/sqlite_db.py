"""
Shared SQLite connection helper for InsightSQL metadata DBs.

Enables WAL mode, busy timeout, foreign keys, and check_same_thread=False
so FastAPI / multi-threaded access is safer under concurrent readers/writers.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

# Wait up to 5s when the DB is locked (concurrent writers).
DEFAULT_BUSY_TIMEOUT_MS = 5000
DEFAULT_TIMEOUT_SEC = 30.0


@contextmanager
def connect(db_path: str, *, busy_timeout_ms: int = DEFAULT_BUSY_TIMEOUT_MS) -> Iterator[sqlite3.Connection]:
    """Open a SQLite connection with concurrency-friendly pragmas."""
    con = sqlite3.connect(
        db_path,
        timeout=DEFAULT_TIMEOUT_SEC,
        check_same_thread=False,
    )
    con.row_factory = sqlite3.Row
    try:
        con.execute("PRAGMA journal_mode=WAL")
        con.execute(f"PRAGMA busy_timeout={int(busy_timeout_ms)}")
        con.execute("PRAGMA foreign_keys=ON")
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
