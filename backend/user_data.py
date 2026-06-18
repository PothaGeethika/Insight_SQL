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

_DB_PATH = os.getenv("USER_DATA_DB", "user_data.db")


@contextmanager
def _conn():
    con = sqlite3.connect(_DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


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
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                org_id      TEXT,
                title       TEXT NOT NULL,
                description TEXT,
                databases   TEXT NOT NULL DEFAULT '[]',
                is_favorite INTEGER NOT NULL DEFAULT 0,
                created_at  REAL NOT NULL
            );
        """)
        # Migrations
        for table in ["chat_sessions", "saved_queries", "projects"]:
            try:
                con.execute(f"ALTER TABLE {table} ADD COLUMN org_id TEXT")
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
            result.append(p)
        return result


def upsert_project(user_id: str, data: dict, org_id: str = None) -> dict:
    pid = data.get("id") or str(uuid.uuid4())
    org_id = data.get("org_id") or org_id
    with _conn() as con:
        con.execute(
            """INSERT OR REPLACE INTO projects
               (id, user_id, org_id, title, description, databases, is_favorite, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                pid,
                user_id,
                org_id,
                data.get("title", "Untitled"),
                data.get("description"),
                json.dumps(data.get("databases", [])),
                int(data.get("isFavorite", False)),
                data.get("created_at", 0),
            ),
        )
    data["id"] = pid
    data["org_id"] = org_id
    return data


def delete_project(user_id: str, project_id: str):
    with _conn() as con:
        con.execute(
            "DELETE FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        )
