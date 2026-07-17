"""
Lightweight SQLite store for per-user data:
  - Chat history (sessions + messages)
  - Saved / favorite queries
  - Projects

This replaces the previous localStorage-only approach, giving users
persistent data across devices and browsers.
"""

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from typing import Any
from config import _require_env
from sqlite_db import connect as sqlite_connect

_DB_PATH = _require_env("USER_DATA_DB")


@contextmanager
def _conn():
    with sqlite_connect(_DB_PATH) as con:
        yield con


def init_db():
    with _conn() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                org_id      TEXT,
                title       TEXT NOT NULL,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                updated_at  REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id          TEXT PRIMARY KEY,
                session_id  TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                role        TEXT NOT NULL,
                content     TEXT NOT NULL,
                sql_query   TEXT,
                table_data  TEXT,
                created_at  REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS saved_queries (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                org_id      TEXT,
                question    TEXT NOT NULL,
                answer      TEXT,
                sql_query   TEXT,
                table_data  TEXT,
                database    TEXT,
                saved_at    REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id              TEXT PRIMARY KEY,
                user_id         TEXT NOT NULL,
                org_id          TEXT,
                title           TEXT NOT NULL,
                description     TEXT,
                databases       TEXT NOT NULL DEFAULT '[]',
                is_favorite     INTEGER NOT NULL DEFAULT 0,
                project_type    TEXT NOT NULL DEFAULT 'Analytics',
                status          TEXT NOT NULL DEFAULT 'Active',
                project_members TEXT NOT NULL DEFAULT '[]',
                created_at      REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dashboards (
                id              TEXT PRIMARY KEY,
                user_id         TEXT NOT NULL,
                org_id          TEXT,
                title           TEXT NOT NULL,
                description     TEXT,
                connection_id   TEXT,
                widgets         TEXT NOT NULL DEFAULT '[]',
                created_at      REAL NOT NULL,
                updated_at      REAL
            );
        """)
        # Migrations
        for table in ["chat_sessions", "saved_queries", "projects", "dashboards"]:
            try:
                con.execute(f"ALTER TABLE {table} ADD COLUMN org_id TEXT")
            except sqlite3.OperationalError:
                pass
        
        # Projects columns migrations
        for col, col_type in [("project_type", "TEXT DEFAULT 'Analytics'"), ("status", "TEXT DEFAULT 'Active'"), ("project_members", "TEXT DEFAULT '[]'")]:
            try:
                con.execute(f"ALTER TABLE projects ADD COLUMN {col} {col_type}")
            except sqlite3.OperationalError:
                pass


init_db()


# ──────────────────────────────────────────────────────────────────────────────
# Chat sessions
# ──────────────────────────────────────────────────────────────────────────────

def list_sessions(user_id: str, org_id: str = None) -> list[dict]:
    with _conn() as con:
        if org_id:
            rows = con.execute(
                "SELECT * FROM chat_sessions WHERE user_id = ? AND org_id = ? ORDER BY updated_at DESC",
                (user_id, org_id),
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
                (user_id,),
            ).fetchall()
        result = []
        for row in rows:
            s = dict(row)
            s["messages"] = _get_messages(con, s["id"])
            result.append(s)
        return result


def _get_messages(con, session_id: str) -> list[dict]:
    rows = con.execute(
        "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at",
        (session_id,),
    ).fetchall()
    msgs = []
    for row in rows:
        m = dict(row)
        if m.get("table_data"):
            try:
                m["tableData"] = json.loads(m["table_data"])
            except Exception:
                pass
            del m["table_data"]
        msgs.append(m)
    return msgs


def upsert_session(user_id: str, session_id: str, title: str, is_favorite: bool, updated_at: float, org_id: str = None) -> dict:
    with _conn() as con:
        con.execute(
            """INSERT INTO chat_sessions (id, user_id, org_id, title, is_favorite, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                   title = excluded.title,
                   is_favorite = excluded.is_favorite,
                   updated_at = excluded.updated_at""",
            (session_id, user_id, org_id, title, int(is_favorite), updated_at),
        )
        return {"id": session_id, "title": title, "is_favorite": is_favorite, "updated_at": updated_at, "org_id": org_id}


def save_messages(session_id: str, messages: list[dict]):
    with _conn() as con:
        con.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        for msg in messages:
            table_data = json.dumps(msg.get("tableData")) if msg.get("tableData") else None
            con.execute(
                """INSERT OR REPLACE INTO chat_messages
                   (id, session_id, role, content, sql_query, table_data, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    msg.get("id", str(uuid.uuid4())),
                    session_id,
                    msg.get("role", "user"),
                    msg.get("content", ""),
                    msg.get("sql") or msg.get("generated_query"),
                    table_data,
                    msg.get("created_at", 0),
                ),
            )


def delete_session(user_id: str, session_id: str):
    with _conn() as con:
        con.execute(
            "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, user_id),
        )


# ──────────────────────────────────────────────────────────────────────────────
# Saved queries
# ──────────────────────────────────────────────────────────────────────────────

def list_saved_queries(user_id: str, org_id: str = None) -> list[dict]:
    with _conn() as con:
        if org_id:
            rows = con.execute(
                "SELECT * FROM saved_queries WHERE user_id = ? AND org_id = ? ORDER BY saved_at DESC",
                (user_id, org_id),
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM saved_queries WHERE user_id = ? ORDER BY saved_at DESC",
                (user_id,),
            ).fetchall()
        result = []
        for row in rows:
            q = dict(row)
            if q.get("table_data"):
                try:
                    q["tableData"] = json.loads(q["table_data"])
                except Exception:
                    pass
                del q["table_data"]
            result.append(q)
        return result


def upsert_saved_query(user_id: str, data: dict, org_id: str = None) -> dict:
    qid = data.get("id") or str(uuid.uuid4())
    org_id = data.get("org_id") or org_id
    with _conn() as con:
        con.execute(
            """INSERT OR REPLACE INTO saved_queries
               (id, user_id, org_id, question, answer, sql_query, table_data, database, saved_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                qid,
                user_id,
                org_id,
                data.get("question", ""),
                data.get("answer"),
                data.get("sql"),
                json.dumps(data["tableData"]) if data.get("tableData") else None,
                data.get("database"),
                data.get("saved_at", 0),
            ),
        )
    data["id"] = qid
    data["org_id"] = org_id
    return data


def delete_saved_query(user_id: str, query_id: str):
    with _conn() as con:
        con.execute(
            "DELETE FROM saved_queries WHERE id = ? AND user_id = ?",
            (query_id, user_id),
        )


# ──────────────────────────────────────────────────────────────────────────────
# Projects
# ──────────────────────────────────────────────────────────────────────────────

def list_projects(user_id: str, org_id: str = None) -> list[dict]:
    with _conn() as con:
        if org_id:
            rows = con.execute(
                "SELECT * FROM projects WHERE user_id = ? AND org_id = ? ORDER BY created_at DESC",
                (user_id, org_id),
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
        result = []
        for row in rows:
            p = dict(row)
            try:
                p["databases"] = json.loads(p["databases"])
            except Exception:
                p["databases"] = []
            
            try:
                p["projectMembers"] = json.loads(p.get("project_members", "[]"))
            except Exception:
                p["projectMembers"] = []
            p["project_members"] = p["projectMembers"]

            p["isFavorite"] = bool(p.get("is_favorite", False))
            p["is_favorite"] = p["isFavorite"]
            p["projectType"] = p.get("project_type", "Analytics")
            p["project_type"] = p["projectType"]
            p["status"] = p.get("status", "Active")
            result.append(p)
        return result


def upsert_project(user_id: str, data: dict, org_id: str = None) -> dict:
    import time
    pid = data.get("id") or str(uuid.uuid4())
    org_id = data.get("org_id") or org_id
    created_at = data.get("created_at") or time.time()
    
    is_fav = data.get("isFavorite")
    if is_fav is None:
        is_fav = data.get("is_favorite", False)
        
    project_type = data.get("projectType") or data.get("project_type", "Analytics")
    status = data.get("status", "Active")
    
    project_members = data.get("projectMembers")
    if project_members is None:
        project_members = data.get("project_members", [])

    with _conn() as con:
        con.execute(
            """INSERT OR REPLACE INTO projects
               (id, user_id, org_id, title, description, databases, is_favorite, project_type, status, project_members, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                pid,
                user_id,
                org_id,
                data.get("title", "Untitled"),
                data.get("description"),
                json.dumps(data.get("databases", [])),
                int(is_fav),
                project_type,
                status,
                json.dumps(project_members),
                created_at,
            ),
        )
    data["id"] = pid
    data["org_id"] = org_id
    data["isFavorite"] = bool(is_fav)
    data["is_favorite"] = bool(is_fav)
    data["projectType"] = project_type
    data["project_type"] = project_type
    data["status"] = status
    data["projectMembers"] = project_members
    data["project_members"] = project_members
    data["created_at"] = created_at
    return data


def delete_project(user_id: str, project_id: str):
    with _conn() as con:
        con.execute(
            "DELETE FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        )


# ──────────────────────────────────────────────────────────────────────────────
# Dashboards
# ──────────────────────────────────────────────────────────────────────────────

def list_dashboards(user_id: str, org_id: str = None) -> list[dict]:
    with _conn() as con:
        if org_id:
            # Include workspace boards and legacy rows with no org_id
            rows = con.execute(
                """SELECT * FROM dashboards
                   WHERE user_id = ? AND (org_id = ? OR org_id IS NULL)
                   ORDER BY updated_at DESC, created_at DESC""",
                (user_id, org_id),
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM dashboards WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC",
                (user_id,),
            ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            try:
                d["widgets"] = json.loads(d.get("widgets") or "[]")
            except Exception:
                d["widgets"] = []
            result.append(d)
        return result


def upsert_dashboard(user_id: str, data: dict, org_id: str = None) -> dict:
    import time
    did = data.get("id") or str(uuid.uuid4())
    org_id = data.get("org_id") or org_id
    now = time.time()
    created_at = data.get("created_at") or now
    updated_at = data.get("updated_at") or now
    widgets = data.get("widgets", [])
    with _conn() as con:
        con.execute(
            """INSERT OR REPLACE INTO dashboards
               (id, user_id, org_id, title, description, connection_id, widgets, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                did,
                user_id,
                org_id,
                data.get("title", "Untitled Dashboard"),
                data.get("description"),
                data.get("connection_id"),
                json.dumps(widgets),
                created_at,
                updated_at,
            ),
        )
    data["id"] = did
    data["org_id"] = org_id
    data["widgets"] = widgets
    data["created_at"] = created_at
    data["updated_at"] = updated_at
    return data


def delete_dashboard(user_id: str, dashboard_id: str):
    with _conn() as con:
        con.execute(
            "DELETE FROM dashboards WHERE id = ? AND user_id = ?",
            (dashboard_id, user_id),
        )
