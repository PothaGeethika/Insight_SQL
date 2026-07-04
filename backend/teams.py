"""
Team / workspace management.

Schema
──────
  orgs          — organisations (workspaces)
  org_members   — user ↔ org membership with role
  org_invites   — pending email invites (token-based)

Roles: owner | admin | member | viewer
"""

import json
import os
import secrets
import sqlite3
import time
import uuid
import smtplib
from email.mime.text import MIMEText
from contextlib import contextmanager
from typing import Optional

from logger_config import get_logger
from config import _require_env

log = get_logger("teams")
_DB_PATH = _require_env("USER_DATA_DB")


@contextmanager
def _conn():
    con = sqlite3.connect(_DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


ROLES = ("owner", "admin", "member", "viewer")


def init_tables():
    with _conn() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS orgs (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                slug        TEXT NOT NULL UNIQUE,
                owner_id    TEXT NOT NULL,
                created_at  REAL NOT NULL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS org_members (
                org_id     TEXT NOT NULL,
                user_id    TEXT NOT NULL,
                role       TEXT NOT NULL DEFAULT 'member',
                joined_at  REAL NOT NULL DEFAULT (unixepoch()),
                PRIMARY KEY (org_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS org_invites (
                id          TEXT PRIMARY KEY,
                org_id      TEXT NOT NULL,
                email       TEXT NOT NULL,
                role        TEXT NOT NULL DEFAULT 'member',
                token       TEXT NOT NULL UNIQUE,
                invited_by  TEXT NOT NULL,
                expires_at  REAL NOT NULL,
                accepted    INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS user_info_cache (
                user_id    TEXT PRIMARY KEY,
                email      TEXT,
                name       TEXT,
                updated_at REAL NOT NULL DEFAULT (unixepoch())
            );
        """)


init_tables()


def upsert_user_info(user_id: str, email: str, name: str = ""):
    """Cache user name/email for member display. Called at every authenticated request."""
    with _conn() as con:
        con.execute(
            """INSERT INTO user_info_cache (user_id, email, name, updated_at)
               VALUES (?,?,?, unixepoch())
               ON CONFLICT(user_id) DO UPDATE SET
                 email=excluded.email,
                 name=excluded.name,
                 updated_at=excluded.updated_at""",
            (user_id, email or "", name or ""),
        )


def get_user_info(user_id: str) -> dict:
    with _conn() as con:
        row = con.execute(
            "SELECT email, name FROM user_info_cache WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        if row:
            return {"email": row["email"], "name": row["name"]}
        return {"email": user_id, "name": ""}


# ── Org helpers ───────────────────────────────────────────────────────────

def list_user_orgs(user_id: str) -> list[dict]:
    with _conn() as con:
        rows = con.execute("""
            SELECT o.*, m.role
            FROM orgs o
            JOIN org_members m ON m.org_id = o.id
            WHERE m.user_id = ?
            ORDER BY o.created_at DESC
        """, (user_id,)).fetchall()
        return [dict(r) for r in rows]


def get_org(org_id: str) -> Optional[dict]:
    with _conn() as con:
        row = con.execute("SELECT * FROM orgs WHERE id = ?", (org_id,)).fetchone()
        return dict(row) if row else None


def create_org(name: str, owner_id: str) -> dict:
    org_id = str(uuid.uuid4())
    slug = name.lower().replace(" ", "-") + "-" + org_id[:6]
    with _conn() as con:
        con.execute(
            "INSERT INTO orgs (id, name, slug, owner_id) VALUES (?,?,?,?)",
            (org_id, name, slug, owner_id),
        )
        con.execute(
            "INSERT INTO org_members (org_id, user_id, role) VALUES (?,?,?)",
            (org_id, owner_id, "owner"),
        )
    log.info("[TEAMS] Org created: id=%s name=%s owner=%s", org_id, name, owner_id)
    return {"id": org_id, "name": name, "slug": slug, "owner_id": owner_id, "role": "owner"}


def update_org(org_id: str, name: str) -> Optional[dict]:
    with _conn() as con:
        con.execute("UPDATE orgs SET name = ? WHERE id = ?", (name, org_id))
    return get_org(org_id)


def delete_org(org_id: str, user_id: str):
    with _conn() as con:
        con.execute("DELETE FROM orgs WHERE id = ? AND owner_id = ?", (org_id, user_id))
        con.execute("DELETE FROM org_members WHERE org_id = ?", (org_id,))
        con.execute("DELETE FROM org_invites WHERE org_id = ?", (org_id,))


# ── Member helpers ────────────────────────────────────────────────────────

def list_members(org_id: str) -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM org_members WHERE org_id = ? ORDER BY joined_at",
            (org_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def list_members_enriched(org_id: str) -> list[dict]:
    """Returns members with email/name from the user_info_cache."""
    with _conn() as con:
        rows = con.execute("""
            SELECT m.*, COALESCE(u.email, m.user_id) AS email, COALESCE(u.name, '') AS name
            FROM org_members m
            LEFT JOIN user_info_cache u ON u.user_id = m.user_id
            WHERE m.org_id = ?
            ORDER BY m.joined_at
        """, (org_id,)).fetchall()
        return [dict(r) for r in rows]


def get_member_role(org_id: str, user_id: str) -> Optional[str]:
    with _conn() as con:
        row = con.execute(
            "SELECT role FROM org_members WHERE org_id = ? AND user_id = ?",
            (org_id, user_id),
        ).fetchone()
        return row["role"] if row else None


def update_member_role(org_id: str, user_id: str, role: str):
    if role not in ROLES:
        raise ValueError(f"Invalid role '{role}'. Must be one of: {', '.join(ROLES)}")
    with _conn() as con:
        con.execute(
            "UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?",
            (role, org_id, user_id),
        )


def remove_member(org_id: str, user_id: str):
    with _conn() as con:
        con.execute(
            "DELETE FROM org_members WHERE org_id = ? AND user_id = ? AND role != 'owner'",
            (org_id, user_id),
        )


# ── Invite helpers ────────────────────────────────────────────────────────

def create_invite(org_id: str, email: str, role: str, invited_by: str) -> dict:
    if role not in ROLES:
        raise ValueError(f"Invalid role '{role}'.")
    invite_id = str(uuid.uuid4())
    token = secrets.token_urlsafe(32)
    expires_at = time.time() + 60 * 60 * 48  # 48 hours
    with _conn() as con:
        con.execute(
            """INSERT OR REPLACE INTO org_invites
               (id, org_id, email, role, token, invited_by, expires_at, accepted)
               VALUES (?,?,?,?,?,?,?,0)""",
            (invite_id, org_id, email, role, token, invited_by, expires_at),
        )
    log.info("[TEAMS] Invite created for %s to org=%s role=%s", email, org_id, role)
    
    # Send email
    try:
        from email.mime.multipart import MIMEMultipart
        app_base_url = _require_env("FRONTEND_URL")
        invite_link = f"{app_base_url}/invite?token={token}"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0;">
          <div style="max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 12px;
                      box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                        padding: 36px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">InsightSQL</h1>
              <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Workspace Invitation</p>
            </div>
            <div style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #0f172a; font-size: 20px;">You have been invited!</h2>
              <p style="color: #475569; line-height: 1.6; margin: 0 0 12px;">
                You have been invited to join a workspace on <strong>InsightSQL</strong>
                as a <strong style="color: #4f46e5;">{role.capitalize()}</strong>.
              </p>
              <p style="color: #475569; line-height: 1.6; margin: 0 0 28px;">
                Click the button below to accept your invitation. This link will expire in <strong>48 hours</strong>.
              </p>
              <div style="text-align: center; margin-bottom: 28px;">
                <a href="{invite_link}"
                   style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed);
                          color: #ffffff; padding: 14px 32px; border-radius: 8px;
                          text-decoration: none; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0;">
                Or copy this link: <a href="{invite_link}" style="color: #4f46e5;">{invite_link}</a>
              </p>
            </div>
            <div style="background: #f1f5f9; padding: 20px 40px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
        """

        smtp_user = _require_env("SMTP_EMAIL")
        smtp_pass = _require_env("SMTP_PASSWORD")
        smtp_host = _require_env("SMTP_HOST")
        smtp_port = int(_require_env("SMTP_PORT"))

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "You've been invited to InsightSQL"
        msg["From"] = smtp_user
        msg["To"] = email
        plain = MIMEText(
            f"You have been invited to InsightSQL as a {role}.\n\nAccept here: {invite_link}\n\nThis link expires in 48 hours.",
            "plain"
        )
        html = MIMEText(html_body, "html")
        msg.attach(plain)
        msg.attach(html)
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        log.info(f"[TEAMS] Email sent successfully to {email}")
    except Exception as e:
        log.warning(f"[TEAMS] Could not send email: {e}")

    return {"id": invite_id, "token": token, "email": email, "role": role, "expires_at": expires_at}


def list_invites(org_id: str) -> list[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM org_invites WHERE org_id = ? AND accepted = 0 ORDER BY expires_at",
            (org_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def accept_invite(token: str, user_id: str) -> Optional[dict]:
    with _conn() as con:
        invite = con.execute(
            "SELECT * FROM org_invites WHERE token = ? AND accepted = 0 AND expires_at > ?",
            (token, time.time()),
        ).fetchone()
        if not invite:
            return None
        invite = dict(invite)
        # Add to org
        con.execute(
            "INSERT OR IGNORE INTO org_members (org_id, user_id, role) VALUES (?,?,?)",
            (invite["org_id"], user_id, invite["role"]),
        )
        # Mark accepted
        con.execute("UPDATE org_invites SET accepted = 1 WHERE token = ?", (token,))
    log.info("[TEAMS] Invite accepted: user=%s org=%s", user_id, invite["org_id"])
    return invite


def revoke_invite(invite_id: str, org_id: str):
    with _conn() as con:
        con.execute(
            "DELETE FROM org_invites WHERE id = ? AND org_id = ?",
            (invite_id, org_id),
        )
