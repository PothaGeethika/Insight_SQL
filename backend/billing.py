"""
Stripe billing integration.

Plans:
  free       — always available, no Stripe required
  pro        — $29/month  (price ID: STRIPE_PRICE_PRO)
  enterprise — custom     (price ID: STRIPE_PRICE_ENTERPRISE)

Required env vars:
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PRICE_PRO
  STRIPE_PRICE_ENTERPRISE   (optional)
  FRONTEND_URL              (e.g. http://localhost:3000)
"""

import os
import json
import sqlite3
from contextlib import contextmanager
from logger_config import get_logger

log = get_logger("billing")

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
        """)


init_billing_tables()


# ── Subscription helpers ──────────────────────────────────────────────────

def get_subscription(user_id: str) -> dict:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM subscriptions WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row:
        return dict(row)
    return {"user_id": user_id, "plan": "free", "status": "active"}


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


# ── Stripe helpers ────────────────────────────────────────────────────────

def _stripe():
    import stripe as _s
    _s.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    return _s


PLAN_PRICE_MAP = {
    "pro": os.getenv("STRIPE_PRICE_PRO", ""),
    "enterprise": os.getenv("STRIPE_PRICE_ENTERPRISE", ""),
}

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def create_checkout_session(user_id: str, user_email: str, plan: str) -> str:
    """Returns the Stripe Checkout URL for the given plan."""
    stripe = _stripe()
    if not stripe.api_key:
        raise ValueError("STRIPE_SECRET_KEY is not configured.")

    price_id = PLAN_PRICE_MAP.get(plan)
    if not price_id:
        raise ValueError(f"No Stripe price configured for plan '{plan}'.")

    sub = get_subscription(user_id)
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
    sub = get_subscription(user_id)
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
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if not webhook_secret:
        log.warning("[BILLING] STRIPE_WEBHOOK_SECRET not set — skipping signature verification.")
        event = json.loads(payload)
    else:
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
