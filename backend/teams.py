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
import time
import uuid
import smtplib
from email.mime.text import MIMEText
from contextlib import contextmanager
from typing import Optional

from logger_config import get_logger
from config import _require_env
from sqlite_db import connect as sqlite_connect

log = get_logger("teams")
_DB_PATH = _require_env("USER_DATA_DB")


@contextmanager
def _conn():
    with sqlite_connect(_DB_PATH) as con:
        yield con


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

def _resolve_smtp_settings(smtp_user: str) -> tuple[str, int]:
    """
    Pick SMTP host/port from env, or infer from the sender email domain.

    Recipient mailbox (Gmail, Outlook, etc.) does not matter — only the
    *sending* account's provider does.
    """
    explicit_host = os.getenv("SMTP_HOST", "").strip()
    explicit_port = os.getenv("SMTP_PORT", "").strip()

    domain = (smtp_user.split("@")[-1] if "@" in smtp_user else "").lower()

    # Common provider presets (host, port)
    presets: dict[str, tuple[str, int]] = {
        "gmail.com": ("smtp.gmail.com", 587),
        "googlemail.com": ("smtp.gmail.com", 587),
        "outlook.com": ("smtp.office365.com", 587),
        "hotmail.com": ("smtp.office365.com", 587),
        "live.com": ("smtp.office365.com", 587),
        "msn.com": ("smtp.office365.com", 587),
        "office365.com": ("smtp.office365.com", 587),
        "yahoo.com": ("smtp.mail.yahoo.com", 587),
        "yahoo.co.in": ("smtp.mail.yahoo.com", 587),
        "icloud.com": ("smtp.mail.me.com", 587),
        "me.com": ("smtp.mail.me.com", 587),
    }

    inferred_host, inferred_port = presets.get(domain, ("smtp.gmail.com", 587))

    # Explicit env wins when set (and not leftover placeholders)
    host = explicit_host if explicit_host and explicit_host not in ("smtp.example.com",) else inferred_host
    if explicit_port:
        try:
            port = int(explicit_port)
        except ValueError:
            port = inferred_port
    else:
        port = inferred_port

    # If user set Gmail host but email is Outlook (or vice versa) and HOST was
    # left as the old default, prefer domain inference when it conflicts with
    # a clearly wrong default for that domain.
    if explicit_host == "smtp.gmail.com" and domain in (
        "outlook.com", "hotmail.com", "live.com", "msn.com", "office365.com"
    ):
        host, port = inferred_host, inferred_port
        log.info(
            "[TEAMS] SMTP_HOST was smtp.gmail.com but sender is %s — using %s",
            domain,
            host,
        )
    # Reverse mismatch: Office365 host with a Gmail sender → use Gmail SMTP.
    if explicit_host in ("smtp.office365.com", "smtp-mail.outlook.com") and domain in (
        "gmail.com", "googlemail.com"
    ):
        host, port = inferred_host, inferred_port
        log.info(
            "[TEAMS] SMTP_HOST was %s but sender is Gmail — using %s",
            explicit_host,
            host,
        )

    return host, port


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
        from email.utils import formataddr, make_msgid
        app_base_url = _require_env("FRONTEND_URL").rstrip("/")
        invite_link = f"{app_base_url}/invite?token={token}"
        role_label = role.capitalize()

        # Table-based HTML: Outlook strips gradients / many CSS properties.
        html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InsightSQL invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;">
          <tr>
            <td align="center" bgcolor="#4f46e5" style="background-color:#4f46e5;padding:28px 24px;">
              <p style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">InsightSQL</p>
              <p style="margin:8px 0 0;font-size:14px;color:#e0e7ff;">Workspace Invitation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;color:#0f172a;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">You have been invited</h1>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#334155;">
                You have been invited to join a workspace on <strong>InsightSQL</strong>
                as a <strong>{role_label}</strong>.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#334155;">
                Click the button below to accept. This link expires in <strong>48 hours</strong>.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" bgcolor="#4f46e5" style="background-color:#4f46e5;border-radius:6px;">
                    <a href="{invite_link}"
                       style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;background-color:#4f46e5;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">
                If the button does not work, copy and paste this link into your browser:<br />
                <a href="{invite_link}" style="color:#4f46e5;word-break:break-all;">{invite_link}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        smtp_user = _require_env("SMTP_EMAIL").strip()
        # App passwords are often copied with spaces — strip them.
        smtp_pass = _require_env("SMTP_PASSWORD").replace(" ", "").strip()
        smtp_host, smtp_port = _resolve_smtp_settings(smtp_user)

        if not smtp_user or smtp_user.endswith("@example.com") or smtp_pass in ("", "your_app_password"):
            raise RuntimeError(
                "SMTP is not configured. Set SMTP_EMAIL and SMTP_PASSWORD in backend/.env "
                "(Gmail App Password, or Outlook/Microsoft 365 password / app password)."
            )

        log.info(
            "[TEAMS] Sending invite via SMTP %s:%s as %s → %s",
            smtp_host,
            smtp_port,
            smtp_user,
            email,
        )

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "InsightSQL workspace invitation"
        msg["From"] = formataddr(("InsightSQL", smtp_user))
        msg["To"] = email
        msg["Reply-To"] = smtp_user
        msg["Message-ID"] = make_msgid(domain=smtp_user.split("@")[-1] if "@" in smtp_user else "insightsql.local")
        msg["X-Auto-Response-Suppress"] = "OOF, AutoReply"
        plain = MIMEText(
            f"You have been invited to InsightSQL as a {role}.\n\n"
            f"Accept here: {invite_link}\n\n"
            f"This link expires in 48 hours.\n\n"
            f"If you did not expect this, ignore this email.",
            "plain",
            "utf-8",
        )
        html = MIMEText(html_body, "html", "utf-8")
        msg.attach(plain)
        msg.attach(html)
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        log.info("[TEAMS] Email sent successfully to %s", email)
        email_sent = True
        email_error = None
    except Exception as e:
        email_sent = False
        email_error = str(e)
        log.warning("[TEAMS] Could not send email to %s: %s", email, e)

    return {
        "id": invite_id,
        "token": token,
        "email": email,
        "role": role,
        "expires_at": expires_at,
        "email_sent": email_sent,
        "email_error": email_error,
    }


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
            "SELECT * FROM org_invites WHERE token = ? AND expires_at > ?",
            (token, time.time()),
        ).fetchone()
        if not invite:
            return None
        invite = dict(invite)
        if invite["accepted"]:
            # Idempotent: if this user already joined via this invite (e.g. the
            # link was clicked twice, or React fired the request twice in dev),
            # treat it as success instead of "already used".
            member = con.execute(
                "SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?",
                (invite["org_id"], user_id),
            ).fetchone()
            return invite if member else None
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
