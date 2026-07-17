from __future__ import annotations

import os
import time
import uuid
from typing import Any, Optional

from sqlite_db import connect as sqlite_connect
from config import _require_env

_DB_PATH = _require_env("USER_DATA_DB")

# Retention (hours/days) — overridable via env without requiring .env changes.
PENDING_EXPIRE_HOURS = int(os.getenv("APPROVAL_PENDING_EXPIRE_HOURS", "24"))
APPROVED_RETAIN_DAYS = int(os.getenv("APPROVAL_APPROVED_RETAIN_DAYS", "30"))
REJECTED_RETAIN_DAYS = int(os.getenv("APPROVAL_REJECTED_RETAIN_DAYS", "30"))
EXPIRED_RETAIN_DAYS = int(os.getenv("APPROVAL_EXPIRED_RETAIN_DAYS", "7"))


def _row_to_dict(row) -> dict[str, Any]:
    """Convert sqlite3.Row to a JSON-serializable dict."""
    return {key: row[key] for key in row.keys()}


class ApprovalRepository:
    def __init__(self) -> None:
        self._init_tables()

    def _init_tables(self) -> None:
        with sqlite_connect(_DB_PATH) as con:
            con.executescript(
                """
                CREATE TABLE IF NOT EXISTS approval_policies (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    connection_id TEXT,
                    db_type TEXT,
                    role TEXT,
                    operation TEXT,
                    max_affected_rows INTEGER,
                    action TEXT NOT NULL,
                    allow_connection_owner_auto INTEGER NOT NULL DEFAULT 0,
                    priority INTEGER NOT NULL DEFAULT 100
                );
                CREATE TABLE IF NOT EXISTS approval_requests (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    connection_id TEXT NOT NULL,
                    db_type TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    requester_id TEXT NOT NULL,
                    requester_role TEXT NOT NULL,
                    query TEXT NOT NULL,
                    preview_json TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    approver_id TEXT,
                    comment TEXT,
                    result_json TEXT,
                    error TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS approval_audit (
                    id TEXT PRIMARY KEY,
                    request_id TEXT,
                    workspace_id TEXT,
                    connection_id TEXT,
                    db_type TEXT,
                    operation TEXT,
                    requester_id TEXT,
                    approver_id TEXT,
                    query TEXT,
                    status TEXT,
                    result_json TEXT,
                    error TEXT,
                    duration_ms INTEGER,
                    created_at REAL NOT NULL
                );
                """
            )
            for col, col_type in (
                ("original_prompt", "TEXT"),
                ("risk_level", "TEXT"),
                ("reason", "TEXT"),
                ("executed_at", "REAL"),
                ("expires_at", "REAL"),
            ):
                try:
                    con.execute(f"ALTER TABLE approval_requests ADD COLUMN {col} {col_type}")
                except Exception:
                    pass

    def seed_default_policies(self, workspace_id: str) -> None:
        with sqlite_connect(_DB_PATH) as con:
            row = con.execute(
                "SELECT COUNT(1) AS c FROM approval_policies WHERE workspace_id=?",
                (workspace_id,),
            ).fetchone()
            if (row["c"] or 0) > 0:
                return
            defaults = [
                ("viewer", "WRITE", "deny", 0, 5),
                ("viewer", "SCHEMA", "deny", 0, 6),
                (None, "READ", "auto_run", 0, 10),
                (None, "SCHEMA", "require_approval", 0, 20),
                (None, "ADMIN", "require_approval", 0, 21),
                (None, "WRITE", "require_approval", 1, 30),
            ]
            for role, operation, action, owner_auto, priority in defaults:
                con.execute(
                    """INSERT INTO approval_policies
                       (id, workspace_id, role, operation, action, allow_connection_owner_auto, priority)
                       VALUES (?,?,?,?,?,?,?)""",
                    (str(uuid.uuid4()), workspace_id, role, operation, action, owner_auto, priority),
                )

    def cleanup(self, workspace_id: Optional[str] = None) -> dict[str, int]:
        """Lazy retention: expire stale pending, delete old resolved/expired rows."""
        now = time.time()
        pending_cutoff = now - (PENDING_EXPIRE_HOURS * 3600)
        approved_cutoff = now - (APPROVED_RETAIN_DAYS * 86400)
        rejected_cutoff = now - (REJECTED_RETAIN_DAYS * 86400)
        expired_cutoff = now - (EXPIRED_RETAIN_DAYS * 86400)
        ws_clause = " AND workspace_id=?" if workspace_id else ""
        ws_params: tuple[Any, ...] = (workspace_id,) if workspace_id else ()

        with sqlite_connect(_DB_PATH) as con:
            expired = con.execute(
                f"""UPDATE approval_requests
                    SET status='expired', updated_at=?
                    WHERE status='pending' AND created_at < ?{ws_clause}""",
                (now, pending_cutoff, *ws_params),
            ).rowcount
            deleted_approved = con.execute(
                f"""DELETE FROM approval_requests
                    WHERE status='approved' AND updated_at < ?{ws_clause}""",
                (approved_cutoff, *ws_params),
            ).rowcount
            deleted_rejected = con.execute(
                f"""DELETE FROM approval_requests
                    WHERE status='rejected' AND updated_at < ?{ws_clause}""",
                (rejected_cutoff, *ws_params),
            ).rowcount
            deleted_expired = con.execute(
                f"""DELETE FROM approval_requests
                    WHERE status='expired' AND updated_at < ?{ws_clause}""",
                (expired_cutoff, *ws_params),
            ).rowcount
            deleted_failed = con.execute(
                f"""DELETE FROM approval_requests
                    WHERE status='failed' AND updated_at < ?{ws_clause}""",
                (approved_cutoff, *ws_params),
            ).rowcount

        return {
            "expired_pending": expired or 0,
            "deleted_approved": deleted_approved or 0,
            "deleted_rejected": deleted_rejected or 0,
            "deleted_expired": deleted_expired or 0,
            "deleted_failed": deleted_failed or 0,
        }

    def list_policies(self, workspace_id: str) -> list[dict[str, Any]]:
        with sqlite_connect(_DB_PATH) as con:
            rows = con.execute(
                "SELECT * FROM approval_policies WHERE workspace_id=? ORDER BY priority ASC",
                (workspace_id,),
            ).fetchall()
            return [_row_to_dict(r) for r in rows]

    def replace_policies(self, workspace_id: str, rules: list[dict[str, Any]]) -> list[dict[str, Any]]:
        with sqlite_connect(_DB_PATH) as con:
            con.execute("DELETE FROM approval_policies WHERE workspace_id=?", (workspace_id,))
            for rule in rules:
                con.execute(
                    """INSERT INTO approval_policies
                       (id, workspace_id, connection_id, db_type, role, operation, max_affected_rows, action, allow_connection_owner_auto, priority)
                       VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (
                        str(uuid.uuid4()),
                        workspace_id,
                        rule.get("connection_id"),
                        rule.get("db_type"),
                        rule.get("role"),
                        rule.get("operation"),
                        rule.get("max_affected_rows"),
                        rule.get("action", "require_approval"),
                        1 if rule.get("allow_connection_owner_auto") else 0,
                        int(rule.get("priority", 100)),
                    ),
                )
        return self.list_policies(workspace_id)

    def create_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = time.time()
        req_id = str(uuid.uuid4())
        expires_at = now + (PENDING_EXPIRE_HOURS * 3600)
        with sqlite_connect(_DB_PATH) as con:
            con.execute(
                """INSERT INTO approval_requests
                   (id, workspace_id, connection_id, db_type, operation, requester_id, requester_role,
                    query, preview_json, status, created_at, updated_at,
                    original_prompt, risk_level, reason, expires_at)
                   VALUES (?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?)""",
                (
                    req_id,
                    payload["workspace_id"],
                    payload["connection_id"],
                    payload["db_type"],
                    payload["operation"],
                    payload["requester_id"],
                    payload["requester_role"],
                    payload["query"],
                    payload.get("preview_json"),
                    now,
                    now,
                    payload.get("original_prompt"),
                    payload.get("risk_level"),
                    payload.get("reason"),
                    expires_at,
                ),
            )
        return self.get_request(req_id)

    def get_request(self, request_id: str) -> Optional[dict[str, Any]]:
        with sqlite_connect(_DB_PATH) as con:
            row = con.execute("SELECT * FROM approval_requests WHERE id=?", (request_id,)).fetchone()
            return _row_to_dict(row) if row else None

    def list_requests(self, workspace_id: Optional[str], status: Optional[str]) -> list[dict[str, Any]]:
        self.cleanup(workspace_id)
        with sqlite_connect(_DB_PATH) as con:
            sql = "SELECT * FROM approval_requests WHERE 1=1"
            params: list[Any] = []
            if workspace_id:
                sql += " AND workspace_id=?"
                params.append(workspace_id)
            if status:
                sql += " AND status=?"
                params.append(status)
            sql += " ORDER BY created_at DESC"
            rows = con.execute(sql, tuple(params)).fetchall()
            return [_row_to_dict(r) for r in rows]

    def resolve_request(
        self,
        request_id: str,
        status: str,
        approver_id: str,
        comment: Optional[str],
        result_json: Optional[str],
        error: Optional[str],
        *,
        executed_at: Optional[float] = None,
    ) -> Optional[dict[str, Any]]:
        now = time.time()
        with sqlite_connect(_DB_PATH) as con:
            con.execute(
                """UPDATE approval_requests
                   SET status=?, approver_id=?, comment=?, result_json=?, error=?, updated_at=?, executed_at=COALESCE(?, executed_at)
                   WHERE id=?""",
                (status, approver_id, comment, result_json, error, now, executed_at, request_id),
            )
        return self.get_request(request_id)

    def delete_request(self, request_id: str) -> bool:
        with sqlite_connect(_DB_PATH) as con:
            cur = con.execute("DELETE FROM approval_requests WHERE id=?", (request_id,))
            return (cur.rowcount or 0) > 0

    def delete_requests(
        self,
        *,
        workspace_id: Optional[str] = None,
        ids: Optional[list[str]] = None,
        status: Optional[str] = None,
    ) -> int:
        with sqlite_connect(_DB_PATH) as con:
            sql = "DELETE FROM approval_requests WHERE 1=1"
            params: list[Any] = []
            if workspace_id:
                sql += " AND workspace_id=?"
                params.append(workspace_id)
            if status:
                sql += " AND status=?"
                params.append(status)
            if ids:
                placeholders = ",".join("?" for _ in ids)
                sql += f" AND id IN ({placeholders})"
                params.extend(ids)
            if not workspace_id and not ids and not status:
                return 0
            cur = con.execute(sql, tuple(params))
            return cur.rowcount or 0

    def add_audit(self, payload: dict[str, Any]) -> None:
        with sqlite_connect(_DB_PATH) as con:
            con.execute(
                """INSERT INTO approval_audit
                   (id, request_id, workspace_id, connection_id, db_type, operation, requester_id, approver_id, query, status, result_json, error, duration_ms, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    str(uuid.uuid4()),
                    payload.get("request_id"),
                    payload.get("workspace_id"),
                    payload.get("connection_id"),
                    payload.get("db_type"),
                    payload.get("operation"),
                    payload.get("requester_id"),
                    payload.get("approver_id"),
                    payload.get("query"),
                    payload.get("status"),
                    payload.get("result_json"),
                    payload.get("error"),
                    payload.get("duration_ms"),
                    time.time(),
                ),
            )
