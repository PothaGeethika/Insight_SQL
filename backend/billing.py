"""
Stripe billing integration + plan limits / usage tracking.

Plans (aligned with Billing UI):
  free       — 1 connection, 100 queries/month
  pro        — 10 connections, 5,000 queries/month  ($29/mo)
  enterprise — unlimited connections & queries

Required env vars (Stripe optional for free-tier gating):
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_PRO
  STRIPE_PRICE_ENTERPRISE   (optional)
  FRONTEND_URL              (e.g. http://127.0.0.1:3000)
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from logger_config import get_logger
from config import _require_env
from sqlite_db import connect as sqlite_connect

log = get_logger("billing")

_DB_PATH = _require_env("USER_DATA_DB")

# None means unlimited
PLAN_LIMITS: dict[str, dict[str, Optional[int]]] = {
    "free": {"max_connections": 1, "max_queries_per_month": 100},
    "pro": {"max_connections": 10, "max_queries_per_month": 5000},
    "enterprise": {"max_connections": None, "max_queries_per_month": None},
}


class PlanLimitExceeded(Exception):
    """Raised when a plan quota is exceeded. Map to HTTP 402 in the API layer."""

    def __init__(self, message: str, *, code: str = "plan_limit"):
        super().__init__(message)
        self.message = message
        self.code = code


def _conn():
    return sqlite_connect(_DB_PATH)


def _year_month(now: Optional[datetime] = None) -> str:
    dt = now or datetime.now(timezone.utc)
    return dt.strftime("%Y-%m")


def init_billing_tables():
    with _conn() as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS subscriptions (
                user_id          TEXT PRIMARY KEY,
                plan             TEXT NOT NULL DEFAULT 'free',
                stripe_customer  TEXT,
                stripe_sub_id    TEXT,
                status           TEXT NOT NULL DEFAULT 'active',
                current_period_end INTEGER,
                updated_at       REAL NOT NULL DEFAULT (unixepoch())
            );

            CREATE TABLE IF NOT EXISTS usage_monthly (
                user_id      TEXT NOT NULL,
                year_month   TEXT NOT NULL,
                query_count  INTEGER NOT NULL DEFAULT 0,
                org_id       TEXT,
                updated_at   REAL NOT NULL DEFAULT (unixepoch()),
                PRIMARY KEY (user_id, year_month)
            );

            CREATE INDEX IF NOT EXISTS idx_usage_monthly_org
                ON usage_monthly(org_id, year_month);
        """)


init_billing_tables()


# ── Subscription helpers ──────────────────────────────────────────────────

def get_plan(user_id: str) -> str:
    sub = get_subscription(user_id, include_usage=False)
    plan = (sub.get("plan") or "free").lower()
    if plan not in PLAN_LIMITS:
        return "free"
    # Treat non-active paid subs as free for limits
    status = (sub.get("status") or "active").lower()
    if plan != "free" and status not in ("active", "trialing"):
        return "free"
    return plan


def get_limits(plan: str) -> dict[str, Optional[int]]:
    return dict(PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]))


def get_monthly_query_count(user_id: str, year_month: Optional[str] = None) -> int:
    ym = year_month or _year_month()
    with _conn() as con:
        row = con.execute(
            "SELECT query_count FROM usage_monthly WHERE user_id = ? AND year_month = ?",
            (user_id, ym),
        ).fetchone()
    return int(row["query_count"]) if row else 0


def get_subscription(user_id: str, *, include_usage: bool = True) -> dict:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM subscriptions WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row:
        sub: dict[str, Any] = dict(row)
    else:
        sub = {"user_id": user_id, "plan": "free", "status": "active"}

    plan = (sub.get("plan") or "free").lower()
    if plan not in PLAN_LIMITS:
        plan = "free"
    limits = get_limits(plan)

    if include_usage:
        ym = _year_month()
        queries = get_monthly_query_count(user_id, ym)
        sub["limits"] = limits
        sub["usage"] = {
            "year_month": ym,
            "queries_this_month": queries,
            "queries_limit": limits["max_queries_per_month"],
            "connections_limit": limits["max_connections"],
        }
    return sub


def upsert_subscription(user_id: str, data: dict):
    with _conn() as con:
        con.execute("""
            INSERT INTO subscriptions (user_id, plan, stripe_customer, stripe_sub_id, status, current_period_end, updated_at)
            VALUES (:user_id, :plan, :stripe_customer, :stripe_sub_id, :status, :current_period_end, unixepoch())
            ON CONFLICT(user_id) DO UPDATE SET
                plan = excluded.plan,
                stripe_customer = excluded.stripe_customer,
                stripe_sub_id = excluded.stripe_sub_id,
                status = excluded.status,
                current_period_end = excluded.current_period_end,
                updated_at = unixepoch()
        """, {
            "user_id": user_id,
            "plan": data.get("plan", "free"),
            "stripe_customer": data.get("stripe_customer"),
            "stripe_sub_id": data.get("stripe_sub_id"),
            "status": data.get("status", "active"),
            "current_period_end": data.get("current_period_end"),
        })


# ── Plan gating ───────────────────────────────────────────────────────────

def assert_can_add_connection(user_id: str, current_connection_count: int) -> None:
    plan = get_plan(user_id)
    limit = get_limits(plan)["max_connections"]
    if limit is None:
        return
    if current_connection_count >= limit:
        raise PlanLimitExceeded(
            f"Your {plan} plan allows {limit} database connection(s). "
            f"Upgrade to add more.",
            code="connection_limit",
        )


def consume_query_quota(user_id: str, *, org_id: Optional[str] = None, amount: int = 1) -> int:
    """
    Atomically increment monthly query usage if under the plan limit.
    Returns the new count. Raises PlanLimitExceeded when over quota.
    """
    if amount < 1:
        amount = 1
    plan = get_plan(user_id)
    limit = get_limits(plan)["max_queries_per_month"]
    ym = _year_month()

    with _conn() as con:
        row = con.execute(
            "SELECT query_count FROM usage_monthly WHERE user_id = ? AND year_month = ?",
            (user_id, ym),
        ).fetchone()
        current = int(row["query_count"]) if row else 0

        if limit is not None and current + amount > limit:
            raise PlanLimitExceeded(
                f"Monthly query limit reached ({limit} on the {plan} plan). "
                f"Upgrade your plan or wait until next month.",
                code="query_limit",
            )

        new_count = current + amount
        con.execute("""
            INSERT INTO usage_monthly (user_id, year_month, query_count, org_id, updated_at)
            VALUES (?, ?, ?, ?, unixepoch())
            ON CONFLICT(user_id, year_month) DO UPDATE SET
                query_count = excluded.query_count,
                org_id = COALESCE(excluded.org_id, usage_monthly.org_id),
                updated_at = unixepoch()
        """, (user_id, ym, new_count, org_id))

    log.debug("[BILLING] usage user=%s ym=%s count=%d", user_id, ym, new_count)
    return new_count


# ── Stripe helpers ────────────────────────────────────────────────────────

def _stripe():
    import stripe as _s
    _s.api_key = _require_env("STRIPE_SECRET_KEY")
    return _s


PLAN_PRICE_MAP = {
    "pro": _require_env("STRIPE_PRICE_PRO"),
    "enterprise": _require_env("STRIPE_PRICE_ENTERPRISE"),
}

FRONTEND_URL = _require_env("FRONTEND_URL")


def create_checkout_session(user_id: str, user_email: str, plan: str) -> str:
    """Returns the Stripe Checkout URL for the given plan."""
    stripe = _stripe()
    if not stripe.api_key:
        raise ValueError("STRIPE_SECRET_KEY is not configured.")

    price_id = PLAN_PRICE_MAP.get(plan)
    if not price_id:
        raise ValueError(f"No Stripe price configured for plan '{plan}'.")

    sub = get_subscription(user_id, include_usage=False)
    customer_id = sub.get("stripe_customer")

    # Create or retrieve Stripe customer
    if not customer_id:
        customer = stripe.Customer.create(email=user_email, metadata={"user_id": user_id})
        customer_id = customer.id
        upsert_subscription(user_id, {**sub, "stripe_customer": customer_id})

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/dashboard/billing?success=1",
        cancel_url=f"{FRONTEND_URL}/dashboard/billing?canceled=1",
        metadata={"user_id": user_id, "plan": plan},
    )
    log.info("[BILLING] Checkout session created for user=%s plan=%s", user_id, plan)
    return session.url


def create_portal_session(user_id: str) -> str:
    """Returns the Stripe Customer Portal URL."""
    stripe = _stripe()
    sub = get_subscription(user_id, include_usage=False)
    customer_id = sub.get("stripe_customer")
    if not customer_id:
        raise ValueError("No Stripe customer found. Please subscribe first.")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{FRONTEND_URL}/dashboard/billing",
    )
    log.info("[BILLING] Portal session created for user=%s", user_id)
    return session.url


def handle_webhook(payload: bytes, sig_header: str) -> dict:
    """Verifies and processes a Stripe webhook event."""
    stripe = _stripe()
    webhook_secret = _require_env("STRIPE_WEBHOOK_SECRET")
    event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)

    etype = event["type"]
    log.info("[BILLING] Webhook event: %s", etype)

    if etype in ("customer.subscription.created", "customer.subscription.updated"):
        sub_obj = event["data"]["object"]
        user_id = sub_obj.get("metadata", {}).get("user_id")
        if not user_id:
            # Look up via customer id
            customer_id = sub_obj["customer"]
            with _conn() as con:
                row = con.execute(
                    "SELECT user_id FROM subscriptions WHERE stripe_customer = ?", (customer_id,)
                ).fetchone()
                if row:
                    user_id = row["user_id"]

        if user_id:
            plan = "free"
            price_id = sub_obj["items"]["data"][0]["price"]["id"] if sub_obj.get("items") else None
            for p, pid in PLAN_PRICE_MAP.items():
                if pid and pid == price_id:
                    plan = p
                    break

            upsert_subscription(user_id, {
                "plan": plan if sub_obj["status"] == "active" else "free",
                "stripe_customer": sub_obj["customer"],
                "stripe_sub_id": sub_obj["id"],
                "status": sub_obj["status"],
                "current_period_end": sub_obj.get("current_period_end"),
            })
            log.info("[BILLING] Subscription updated: user=%s plan=%s status=%s", user_id, plan, sub_obj["status"])

    elif etype == "customer.subscription.deleted":
        sub_obj = event["data"]["object"]
        customer_id = sub_obj["customer"]
        with _conn() as con:
            con.execute(
                "UPDATE subscriptions SET plan='free', status='canceled' WHERE stripe_customer=?",
                (customer_id,),
            )
        log.info("[BILLING] Subscription canceled for customer=%s", customer_id)

    return {"received": True}
