from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from models import QueryRequest, ConnectionRequest, DatabaseConnection, ExplainRequest, OptimizeRequest
from typing import Any, Dict, List, Optional
from agent import SQLAgent
from connection_manager import ConnectionManager
from logger_config import get_logger
from auth import get_current_user
from config import (
    ALLOWED_ORIGINS,
    ASK_RATE_LIMIT,
    DASHBOARD_RATE_LIMIT,
    DB_QUERY_MAX_RETRIES,
    EXPLAIN_RATE_LIMIT,
    OPTIMIZE_RATE_LIMIT,
    SUGGEST_ASSISTANT_MAX_CHARS,
    SUGGEST_HISTORY_LIMIT,
    SUGGEST_RATE_LIMIT,
    LLM_PROVIDER,
    LLM_MODEL,
    UVICORN_HOST,
    UVICORN_PORT,
    SCHEMA_CACHE_TTL_SECONDS,
    DB_CONNECT_TIMEOUT,
)
import user_data as ud
import billing
import teams as tm
from schema_cache import SchemaCache, format_structured_schema
from sql_validator import validate_query_for_dialect
from adapters.factory import AdapterFactory
import adapters.registry  # noqa: F401
from adapters.base import OperationKind
from adapters.classifier import OperationClassifier
from approval.repository import ApprovalRepository
from approval.policy_engine import PolicyEngine
from approval.models import PolicyContext
from approval.execution import ExecutionEngine
from approval.approval_engine import ApprovalEngine
from approval.notifications import NotificationHub

log = get_logger("main")


def _enforce_query_quota(user_id: str, *, org_id: Optional[str] = None) -> None:
    """Consume one monthly query credit or raise HTTP 402."""
    try:
        billing.consume_query_quota(str(user_id), org_id=org_id)
    except billing.PlanLimitExceeded as e:
        raise HTTPException(status_code=402, detail=e.message) from e


def _enforce_connection_quota(user_id: str) -> None:
    """Raise HTTP 402 if the user is at their plan's connection limit."""
    if not connection_manager:
        raise HTTPException(status_code=500, detail="Connection manager not initialized")
    uid = str(user_id)
    owned = [c for c in connection_manager.list_connections() if c.user_id == uid]
    try:
        billing.assert_can_add_connection(uid, len(owned))
    except billing.PlanLimitExceeded as e:
        raise HTTPException(status_code=402, detail=e.message) from e

load_dotenv()

# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="InsightSQL API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

log.info("[STARTUP] InsightSQL FastAPI application initialising...")

# ---------------------------------------------------------------------------
# CORS – restrict to frontend origin via env var
# ---------------------------------------------------------------------------
log.info("[STARTUP] CORS allowed_origins: %s", ALLOWED_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add the current directory to sys.path
current_dir = str(Path(__file__).parent.resolve())
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# ---------------------------------------------------------------------------
# Component initialisation
# ---------------------------------------------------------------------------
sql_agent: Optional[SQLAgent] = None
connection_manager: Optional[ConnectionManager] = None
schema_cache = SchemaCache(ttl_seconds=SCHEMA_CACHE_TTL_SECONDS)
approval_repo = ApprovalRepository()
policy_engine = PolicyEngine(approval_repo)
execution_engine = ExecutionEngine()
approval_engine = ApprovalEngine(approval_repo, execution_engine)
notification_hub = NotificationHub()


def init_components():
    global sql_agent, connection_manager

    log.info("[STARTUP] ── Initialising backend components ──────────────")

    try:
        connection_manager = ConnectionManager()
        log.info("[STARTUP] ConnectionManager ready.")
    except Exception as e:
        log.error("[STARTUP] Failed to initialise ConnectionManager: %s", e, exc_info=True)

    try:
        sql_agent = SQLAgent()
        log.info("[STARTUP] SQLAgent ready.")
    except Exception as e:
        log.error("[STARTUP] Failed to initialise SQLAgent: %s", e, exc_info=True)

    log.info("[STARTUP] ── All components initialised. Server ready. ──────")


init_components()

def migrate_personal_workspaces():
    import user_data as ud
    import teams as tm
    
    with ud._conn() as con:
        # Find all distinct user_ids that have unassigned items
        users = con.execute("SELECT DISTINCT user_id FROM projects WHERE org_id IS NULL "
                            "UNION SELECT DISTINCT user_id FROM chat_sessions WHERE org_id IS NULL "
                            "UNION SELECT DISTINCT user_id FROM saved_queries WHERE org_id IS NULL "
                            "UNION SELECT DISTINCT user_id FROM dashboards WHERE org_id IS NULL").fetchall()
        
        for row in users:
            uid = row["user_id"]
            # Find a "Personal" workspace for this user, or create one
            orgs = tm.list_user_orgs(uid)
            personal_org = next((o for o in orgs if o["name"] == "Personal Workspace"), None)
            if not personal_org:
                personal_org = tm.create_org("Personal Workspace", uid)
            
            org_id = personal_org["id"]
            con.execute("UPDATE projects SET org_id = ? WHERE user_id = ? AND org_id IS NULL", (org_id, uid))
            con.execute("UPDATE chat_sessions SET org_id = ? WHERE user_id = ? AND org_id IS NULL", (org_id, uid))
            con.execute("UPDATE saved_queries SET org_id = ? WHERE user_id = ? AND org_id IS NULL", (org_id, uid))
            con.execute("UPDATE dashboards SET org_id = ? WHERE user_id = ? AND org_id IS NULL", (org_id, uid))

migrate_personal_workspaces()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_db_manager(conn):
    db_url = connection_manager.format_connection_url(conn)
    db_type = conn.type
    connect_timeout = getattr(conn, "connect_timeout", None) or DB_CONNECT_TIMEOUT
    pool_size = getattr(conn, "pool_size", None)
    if db_type == "mongodb":
        from mongo_database import MongoDatabaseManager
        return MongoDatabaseManager(db_url, connect_timeout_ms=int(connect_timeout) * 1000)
    elif db_type == "snowflake":
        from snowflake_database import SnowflakeDatabaseManager
        return SnowflakeDatabaseManager(db_url, connect_timeout=connect_timeout, pool_size=pool_size)
    elif db_type == "elasticsearch":
        from elasticsearch_database import ElasticsearchDatabaseManager
        return ElasticsearchDatabaseManager(db_url)
    elif db_type == "neo4j":
        from neo4j_database import Neo4jDatabaseManager
        return Neo4jDatabaseManager(db_url, connect_timeout=connect_timeout)
    else:
        from database import DatabaseManager
        return DatabaseManager(db_url, connect_timeout=connect_timeout, pool_size=pool_size)


def _assert_conn_owner(conn, current_user: dict):
    if conn and conn.user_id and conn.user_id != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not your database connection.")


def _get_role_for_connection(conn, current_user: dict) -> str:
    uid = str(current_user["id"])
    if conn.org_id:
        role = tm.get_member_role(conn.org_id, uid)
        return role or "member"
    return "owner"


def _approval_workspace_role(workspace_id: Optional[str], user_id: str) -> Optional[str]:
    ws = str(workspace_id or "")
    if not ws or ws.startswith("user:"):
        return "owner"
    try:
        return tm.get_member_role(ws, user_id)
    except Exception as ex:
        log.warning("[APPROVAL] Failed to resolve role for workspace=%s user=%s: %s", ws, user_id, ex)
        return None


def _can_view_approval(row: dict[str, Any], user_id: str) -> bool:
    if str(row.get("requester_id") or "") == user_id:
        return True
    role = _approval_workspace_role(row.get("workspace_id"), user_id)
    return role in ("owner", "admin")


def _short_db_error(exc: Exception) -> str:
    """Return a concise, user-facing database error message."""
    msg = str(exc).strip()
    if "FATAL:" in msg:
        return msg.split("FATAL:", 1)[1].strip().split("\n")[0]
    if "OperationalError" in msg and ")" in msg:
        tail = msg.split(")", 1)[-1].strip()
        if tail:
            return tail.split("\n")[0]
    return msg.split("\n")[0][:400]


def _execute_generated_query(
    *,
    conn,
    generated_query: str,
    current_user: dict,
    temp_manager,
    original_prompt: Optional[str] = None,
):
    """Classify + policy gate, then execute via adapter or legacy manager."""
    plan = OperationClassifier.classify(generated_query, conn.type)
    allow_mutating = plan.operation != OperationKind.READ
    validate_query_for_dialect(generated_query, conn.type, allow_mutating=allow_mutating)
    policy_run = _run_query_with_policy(
        conn=conn,
        generated_query=generated_query,
        current_user=current_user,
        original_prompt=original_prompt,
    )
    if policy_run.get("pending"):
        return {
            "pending": True,
            "request": policy_run["request"],
            "plan": policy_run["plan"],
            "preview": policy_run["preview"],
            "policy_run": policy_run,
        }
    if policy_run.get("fallback_execute_query"):
        headers, rows = temp_manager.execute_query(generated_query, enforce_readonly=False)
    else:
        headers = policy_run["result"]["headers"]
        rows = policy_run["result"]["rows"]
    return {"pending": False, "headers": headers, "rows": rows, "policy_run": policy_run}


def _approval_reason(operation: str, decision_reason: str) -> str:
    op = (operation or "").upper()
    if op in ("SCHEMA", "ADMIN"):
        return decision_reason or "This query modifies the database schema and requires approval."
    if op == "WRITE":
        return decision_reason or "This query writes or deletes data and requires approval."
    return decision_reason or "This query requires workspace approval before it can run."


def _run_query_with_policy(*, conn, generated_query: str, current_user: dict, original_prompt: Optional[str] = None):
    try:
        adapter = AdapterFactory.create(conn)
        plan = adapter.classify_operation(generated_query)
        estimated_rows = adapter.estimate_affected_rows(generated_query)
        workspace_id = conn.org_id or f"user:{current_user['id']}"
        requester_role = _get_role_for_connection(conn, current_user)
        ctx = PolicyContext(
            workspace_id=workspace_id,
            connection_id=conn.id,
            connection_owner_id=conn.user_id,
            requester_id=str(current_user["id"]),
            requester_role=requester_role,
            db_type=conn.type,
            operation=plan.operation.value,
            estimated_rows=estimated_rows,
        )
        decision = policy_engine.evaluate(ctx)
        preview = adapter.generate_preview(plan)
    except Exception as ex:
        # Never block read-path UX because approval framework internals failed.
        log.warning("[APPROVAL] Policy path failed for conn=%s type=%s: %s", conn.id, conn.type, ex)
        return {"pending": False, "fallback_execute_query": True}

    if decision.action == "deny":
        raise HTTPException(status_code=403, detail="Operation denied by workspace policy")

    if decision.action == "require_approval" and plan.operation != OperationKind.READ:
        reason = _approval_reason(plan.operation.value, getattr(decision, "reason", "") or "")
        created = approval_engine.create_request(
            {
                "workspace_id": workspace_id,
                "connection_id": conn.id,
                "db_type": conn.type,
                "operation": plan.operation.value,
                "requester_id": str(current_user["id"]),
                "requester_role": requester_role,
                "query": generated_query,
                "preview_json": json.dumps(preview.__dict__),
                "original_prompt": original_prompt,
                "risk_level": plan.risk,
                "reason": reason,
            }
        )
        notification_hub.emit(
            workspace_id,
            "approval_created",
            {
                "request_id": created["id"],
                "connection_id": conn.id,
                "operation": created.get("operation"),
                "original_prompt": original_prompt,
            },
        )
        return {"pending": True, "request": created, "plan": plan, "preview": preview.__dict__}

    exec_result = execution_engine.run(adapter, plan)
    return {"pending": False, "plan": plan, "result": exec_result}


def _infer_visualization(question: str) -> Optional[str]:
    question_lower = (question or "").lower()
    if "bar chart" in question_lower or "bar graph" in question_lower:
        return "bar"
    if "pie chart" in question_lower or "pie graph" in question_lower:
        return "pie"
    if "line chart" in question_lower or "line graph" in question_lower:
        return "line"
    if "area chart" in question_lower or "area graph" in question_lower:
        return "area"
    if any(w in question_lower for w in ("chart", "graph", "dashboard", "plot")):
        return "auto"
    return None


def _get_schema_for_connection(conn, *, refresh: bool = False) -> tuple[str, Any]:
    """Return (schema_text, structured) using the in-memory TTL cache."""
    conn_id = conn.id
    if not refresh:
        cached = schema_cache.get(conn_id)
        if cached:
            return cached["text"], cached["structured"]

    manager = _build_db_manager(conn)
    structured = None
    if hasattr(manager, "get_schema_structured"):
        try:
            structured = manager.get_schema_structured()
        except Exception as ex:
            log.warning("[SCHEMA] structured fetch failed for %s: %s", conn_id, ex)
    if structured:
        text = format_structured_schema(structured) or manager.get_schema()
    else:
        text = manager.get_schema()
        structured = {"dialect": conn.type, "raw_text": True, "text": text}
    schema_cache.set(conn_id, structured, text)
    return text, structured


def _combine_legacy_table(per_source: list[dict]) -> dict:
    """Deprecated combined view with SOURCE_DATABASE column for older clients."""
    all_headers: list = []
    seen: set = set()
    for item in per_source:
        for h in item.get("headers") or []:
            if h not in seen:
                seen.add(h)
                all_headers.append(h)
    combined_headers = ["SOURCE_DATABASE"] + all_headers
    combined_rows = []
    for item in per_source:
        headers = item.get("headers") or []
        h_to_idx = {h: idx for idx, h in enumerate(headers)}
        db_name = item.get("database") or item.get("connection_id") or ""
        for row in item.get("rows") or []:
            combined_rows.append(
                [db_name] + [row[h_to_idx[h]] if h in h_to_idx else None for h in all_headers]
            )
    return {"headers": combined_headers, "rows": combined_rows}


# ---------------------------------------------------------------------------
# Database catalog – loaded dynamically from db_types_config.json.
# To add / remove / edit a database type, just edit that JSON file and
# restart the server.  No Python code changes required.
# ---------------------------------------------------------------------------

_CATALOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db_types_config.json")

def _load_db_types_catalog() -> list:
    """Load the DB-types catalog from the JSON config file.
    Returns an empty list (not an error) if the file is missing or malformed,
    so the frontend can fall back to its own built-in catalog."""
    try:
        with open(_CATALOG_PATH, "r", encoding="utf-8") as f:
            catalog = json.load(f)
        log.info("[CATALOG] Loaded %d database type(s) from %s", len(catalog), _CATALOG_PATH)
        return catalog
    except FileNotFoundError:
        log.warning("[CATALOG] db_types_config.json not found at '%s'.", _CATALOG_PATH)
        return []
    except Exception as exc:
        log.error("[CATALOG] Failed to parse db_types_config.json: %s", exc)
        return []


@app.get("/databases/types")
def get_database_types(current_user: dict = Depends(get_current_user)):
    log.info("[API] GET /databases/types  user=%s", current_user["id"])
    return _load_db_types_catalog()


@app.get("/databases")
def get_databases(org_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    log.info("[API] GET /databases  user=%s  org_id=%s", current_user["id"], org_id)
    if not connection_manager:
        log.warning("[API] Connection manager unavailable; returning empty list.")
        return []
    try:
        connections = connection_manager.list_connections()
    except Exception as ex:
        log.error("[API] Failed to list connections: %s", ex, exc_info=True)
        return []
    # Filter to this user's connections only (legacy rows may have user_id=None)
    uid = str(current_user["id"])
    user_conns = [c for c in connections if c.user_id == uid or c.user_id is None]
    if org_id:
        # Include workspace-scoped DBs AND legacy rows with no org_id yet
        # (otherwise existing connections disappear after workspace switcher landed).
        user_conns = [
            c for c in user_conns
            if c.org_id == org_id or c.org_id is None
        ]
    log.info("[API] Returning %d database connection(s) for user=%s.", len(user_conns), current_user["id"])
    return user_conns


@app.post("/databases/test")
def test_database_connection(
    request: ConnectionRequest,
    current_user: dict = Depends(get_current_user),
):
    log.info("[API] POST /databases/test  type='%s'  host='%s'  db='%s'",
             request.type, request.host, request.database)
    try:
        cm = ConnectionManager()
        if request.custom_url:
            # Skip field validations since full connection URI is provided
            pass
        elif request.type == "snowflake":
            if not request.account or not request.database:
                return {"status": "error", "message": "Account Identifier and Database name are required for Snowflake."}
        elif request.type == "bigquery":
            if not request.custom_url and not request.database:
                return {"status": "error", "message": "Project/dataset (database) or custom_url is required for BigQuery."}
        elif request.type in ("redshift", "clickhouse", "oracle"):
            if not request.custom_url and (not request.host or not request.database):
                return {"status": "error", "message": f"Host and Database (or custom_url) are required for {request.type}."}
        elif request.type not in ["sqlite", "mongodb", "neo4j"] and (not request.host or not request.database):
            return {"status": "error", "message": "Host and Database name are required for this database type."}

        timeout = request.connect_timeout or DB_CONNECT_TIMEOUT
        dummy_conn = DatabaseConnection(**request.dict())
        db_url = cm.format_connection_url(dummy_conn)

        # Detect actual type from URL or request type
        is_mongodb = request.type == "mongodb" or db_url.startswith("mongodb://") or db_url.startswith("mongodb+srv://")
        is_snowflake = request.type == "snowflake" or db_url.startswith("snowflake://")
        is_neo4j = request.type == "neo4j" or db_url.startswith("neo4j://") or db_url.startswith("neo4j+s://") or db_url.startswith("bolt://") or db_url.startswith("bolt+s://")
        is_elasticsearch = request.type == "elasticsearch" or db_url.startswith("elasticsearch://")

        if is_mongodb:
            from pymongo import MongoClient
            client = MongoClient(db_url, serverSelectionTimeoutMS=int(timeout) * 1000, connectTimeoutMS=int(timeout) * 1000)
            client.admin.command('ping')
            return {"status": "success", "message": "Connection successful! MongoDB is reachable."}
        elif is_snowflake:
            from snowflake_database import SnowflakeDatabaseManager
            mgr = SnowflakeDatabaseManager(db_url, connect_timeout=timeout)
            with mgr.engine.connect() as conn:
                from sqlalchemy import text as sa_text
                conn.execute(sa_text("SELECT 1"))
            return {"status": "success", "message": "Connection successful! Snowflake is reachable."}
        elif is_elasticsearch:
            from elasticsearch_database import ElasticsearchDatabaseManager
            es_mgr = ElasticsearchDatabaseManager(db_url)
            if es_mgr.client.ping():
                return {"status": "success", "message": "Connection successful! Elasticsearch is reachable."}
            raise Exception("Elasticsearch ping failed.")
        elif is_neo4j:
            from neo4j_database import Neo4jDatabaseManager
            neo_mgr = Neo4jDatabaseManager(db_url, connect_timeout=timeout)
            neo_mgr.driver.verify_connectivity()
            return {"status": "success", "message": "Connection successful! Neo4j is reachable."}
        else:
            from database import DatabaseManager
            mgr = DatabaseManager(db_url, connect_timeout=timeout, pool_size=request.pool_size)
            from sqlalchemy import text as sa_text
            with mgr.engine.connect() as conn:
                conn.execute(sa_text("SELECT 1"))
            return {"status": "success", "message": "Connection successful! Database is reachable."}

    except Exception as e:
        log.error("[API] /databases/test FAILED for type='%s': %s", request.type, e)
        return {"status": "error", "message": f"Connection Failed: {str(e)}"}


@app.post("/databases")
def add_database(
    request: ConnectionRequest,
    current_user: dict = Depends(get_current_user),
):
    log.info("[API] POST /databases  name='%s'  type='%s'  user=%s", request.name, request.type, current_user["id"])
    try:
        _enforce_connection_quota(current_user["id"])
        data = request.dict()
        data["user_id"] = str(current_user["id"])
        # org_id comes from request body when provided
        conn = connection_manager.add_connection(data)
        log.info("[API] Database added successfully – id='%s' org_id='%s'", conn.id, conn.org_id)
        return conn
    except HTTPException:
        raise
    except Exception as e:
        log.error("[API] Failed to add database: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/databases/{conn_id}")
def delete_database(
    conn_id: str,
    current_user: dict = Depends(get_current_user),
):
    log.info("[API] DELETE /databases/%s  user=%s", conn_id, current_user["id"])
    conn = connection_manager.get_connection(conn_id)
    _assert_conn_owner(conn, current_user)
    connection_manager.delete_connection(conn_id)
    schema_cache.invalidate(conn_id)
    return {"status": "deleted"}


@app.put("/databases/{conn_id}")
def update_database(
    conn_id: str,
    request: ConnectionRequest,
    current_user: dict = Depends(get_current_user),
):
    conn = connection_manager.get_connection(conn_id)
    _assert_conn_owner(conn, current_user)
    updated = connection_manager.update_connection(conn_id, request.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Connection not found")
    schema_cache.invalidate(conn_id)
    return updated


@app.put("/databases/{conn_id}/default")
def set_default_database(
    conn_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        conn = connection_manager.get_connection(conn_id)
        _assert_conn_owner(conn, current_user)
        connections = connection_manager._load()
        current_status = False
        for c in connections:
            if c['id'] == conn_id:
                c['is_default'] = not c.get('is_default', False)
                current_status = c['is_default']
                break
        connection_manager._save(connections)
        return {"status": "success", "is_default": current_status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/databases/{conn_id}/schema")
def get_database_schema(
    conn_id: str,
    refresh: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Return structured schema JSON for the schema explorer / agent prompts."""
    log.info("[API] GET /databases/%s/schema refresh=%s user=%s", conn_id, refresh, current_user["id"])
    conn = connection_manager.get_connection(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    _assert_conn_owner(conn, current_user)
    try:
        was_cached = (not refresh) and schema_cache.get(conn_id) is not None
        if refresh:
            schema_cache.invalidate(conn_id)
        text, structured = _get_schema_for_connection(conn, refresh=refresh)
        return {
            "connection_id": conn_id,
            "database": conn.name,
            "dialect": conn.type,
            "schema": structured,
            "schema_text": text,
            "cached": was_cached,
        }
    except HTTPException:
        raise
    except Exception as e:
        log.error("[API] Schema fetch failed for %s: %s", conn_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch schema: {e}")


@app.post("/databases/{conn_id}/schema/invalidate")
def invalidate_database_schema(
    conn_id: str,
    current_user: dict = Depends(get_current_user),
):
    conn = connection_manager.get_connection(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    _assert_conn_owner(conn, current_user)
    schema_cache.invalidate(conn_id)
    return {"status": "invalidated", "connection_id": conn_id}


# ---------------------------------------------------------------------------
# Core AI endpoints
# ---------------------------------------------------------------------------

class SuggestionRequest(BaseModel):
    history: List[dict] = []
    connection_id: Optional[str] = None
    database: Optional[str] = None
    provider: str = LLM_PROVIDER
    model: str = LLM_MODEL


@app.post("/ask")
@limiter.limit(ASK_RATE_LIMIT)
def ask_question(
    request: Request,
    payload: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    request = payload
    t_start = time.perf_counter()
    log.info("[API] ════ POST /ask  user=%s ════", current_user["id"])
    log.info("[API] Question  : %s", request.question)
    log.info("[API] Provider  : %s  Model: %s", request.provider, request.model)
    _enforce_query_quota(current_user["id"])

    try:
        selected_connection_ids = []
        if request.connection_ids:
            selected_connection_ids = request.connection_ids
        elif request.connection_id:
            selected_connection_ids = [cid.strip() for cid in request.connection_id.split(",") if cid.strip()]

        if not selected_connection_ids:
            default_conn = connection_manager.get_default_connection() if connection_manager else None
            if default_conn:
                selected_connection_ids = [default_conn.id]

        if not selected_connection_ids:
            raise HTTPException(status_code=400, detail="No database connected. Please select or add a database first.")

        per_source_results = []
        query_details = []
        mql_details = []
        query_errors: list[str] = []

        for conn_id in selected_connection_ids:
            conn = connection_manager.get_connection(conn_id)
            if not conn:
                continue
            _assert_conn_owner(conn, current_user)

            db_type = conn.type
            try:
                temp_manager = _build_db_manager(conn)
                schema, _structured = _get_schema_for_connection(conn)

                generated_query = sql_agent.generate_query(
                    request.question,
                    schema,
                    db_type=db_type,
                    provider=request.provider,
                    model_name=request.model,
                )

                if not generated_query.strip() or "NOT_APPLICABLE" in generated_query:
                    continue

                exec_out = _execute_generated_query(
                    conn=conn,
                    generated_query=generated_query,
                    current_user=current_user,
                    temp_manager=temp_manager,
                    original_prompt=request.question,
                )
                if exec_out.get("pending"):
                    pending = exec_out["request"]
                    return {
                        "id": os.urandom(8).hex(),
                        "role": "assistant",
                        "status": "pending_approval",
                        "pending_approval": True,
                        "approval_id": pending["id"],
                        "request_id": pending["id"],
                        "query": generated_query,
                        "original_prompt": request.question,
                        "operation": pending["operation"],
                        "risk_level": exec_out["plan"].risk,
                        "reason": pending.get("reason"),
                        "preview": exec_out["preview"],
                        "connection_id": conn.id,
                        "database": conn.name,
                        "content": "This action requires approval before execution.",
                    }
                headers = exec_out["headers"]
                rows = exec_out["rows"]
                per_source_results.append({
                    "connection_id": conn_id,
                    "database": conn.name,
                    "headers": headers,
                    "rows": rows,
                    "query": generated_query,
                    "dialect": db_type,
                })

                if db_type == "mongodb":
                    mql_details.append(f"-- {conn.name} (MongoDB):\n{generated_query}")
                elif db_type == "elasticsearch":
                    mql_details.append(f"-- {conn.name} (Elasticsearch DSL):\n{generated_query}")
                elif db_type == "neo4j":
                    query_details.append(f"-- {conn.name} (Neo4j Cypher):\n{generated_query}")
                else:
                    query_details.append(f"-- {conn.name} ({db_type.upper()}):\n{generated_query}")

            except ValueError as ve:
                # Read-only enforcement triggered
                log.warning("[API] Read-only violation for connection '%s': %s", conn.name, ve)
                raise HTTPException(status_code=400, detail=str(ve))
            except Exception as e:
                log.error("[API] Error querying '%s': %s", conn.name, e, exc_info=True)
                query_errors.append(f"{conn.name}: {_short_db_error(e)}")
                continue

        if not per_source_results:
            if query_errors:
                detail = query_errors[0] if len(query_errors) == 1 else "; ".join(query_errors[:3])
            else:
                detail = "No query returned valid results from any selected database."
            raise HTTPException(status_code=500, detail=detail)

        legacy_table = _combine_legacy_table(per_source_results)
        combined_headers = legacy_table["headers"]
        combined_rows = legacy_table["rows"]

        combined_sql = "\n\n".join(query_details) if query_details else None
        combined_mql = "\n\n".join(mql_details) if mql_details else None

        from datetime import datetime
        timestamp = datetime.now().strftime("%I:%M %p")

        content_msg = sql_agent.synthesize_answer(
            request.question,
            combined_headers,
            combined_rows,
            provider=request.provider,
            model_name=request.model,
        ) if per_source_results else None

        if not content_msg:
            db_names_str = ", ".join(r["database"] for r in per_source_results)
            content_msg = f"Results from database(s): {db_names_str}"

        primary_db_type = per_source_results[0]["dialect"] if per_source_results else "postgresql"

        elapsed_total = time.perf_counter() - t_start
        log.info("[API] /ask completed in %.2fs – %d source(s), %d combined row(s).",
                 elapsed_total, len(per_source_results), len(combined_rows))

        visualization = _infer_visualization(request.question)

        return {
            "id": os.urandom(8).hex(),
            "role": "assistant",
            "content": content_msg,
            "sql": combined_sql,
            "mql": combined_mql,
            "generated_query": combined_sql or combined_mql or "",
            "query_type": primary_db_type,
            "timestamp": timestamp,
            "visualization": visualization,
            "results": per_source_results,
            # Legacy combined view (SOURCE_DATABASE column) for older clients
            "tableData": {"headers": combined_headers, "rows": combined_rows},
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        log.error("[API] Unexpected error in /ask: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/ask/stream")
@limiter.limit(ASK_RATE_LIMIT)
async def ask_question_stream(
    request: Request,
    payload: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    request = payload
    """SSE streaming version of /ask — sends SQL + table data first, then streams the synthesis token by token."""
    # Enforce before opening the SSE stream so clients get a clean HTTP 402.
    _enforce_query_quota(current_user["id"])

    async def event_generator():
        try:
            # ── 1. Resolve connection IDs ──────────────────────────────
            selected_connection_ids = []
            if request.connection_ids:
                selected_connection_ids = request.connection_ids
            elif request.connection_id:
                selected_connection_ids = [c.strip() for c in request.connection_id.split(",") if c.strip()]

            if not selected_connection_ids:
                default_conn = connection_manager.get_default_connection()
                if default_conn:
                    selected_connection_ids = [default_conn.id]

            if not selected_connection_ids:
                yield f"data: {json.dumps({'type': 'error', 'data': 'No database connected.'})}\n\n"
                return

            # ── 2. Generate SQL + execute for each DB ─────────────────
            per_source_results = []
            query_details = []
            mql_details = []
            query_errors: list[str] = []

            for conn_id in selected_connection_ids:
                conn = connection_manager.get_connection(conn_id)
                if not conn:
                    continue
                try:
                    _assert_conn_owner(conn, current_user)
                except HTTPException as he:
                    yield f"data: {json.dumps({'type': 'error', 'data': he.detail})}\n\n"
                    return
                try:
                    temp_manager = _build_db_manager(conn)
                    schema, _structured = _get_schema_for_connection(conn)

                    generated_query = sql_agent.generate_query(
                        request.question, schema,
                        db_type=conn.type,
                        provider=request.provider,
                        model_name=request.model,
                    )

                    if not generated_query.strip() or "NOT_APPLICABLE" in generated_query:
                        continue

                    exec_out = _execute_generated_query(
                        conn=conn,
                        generated_query=generated_query,
                        current_user=current_user,
                        temp_manager=temp_manager,
                        original_prompt=request.question,
                    )
                    if exec_out.get("pending"):
                        pending = exec_out["request"]
                        from datetime import datetime
                        ts = datetime.now().strftime("%I:%M %p")
                        label = conn.type.upper()
                        if conn.type == "mongodb":
                            pending_mql = f"-- {conn.name} (MongoDB):\n{generated_query}"
                            pending_sql = None
                        elif conn.type == "elasticsearch":
                            pending_mql = f"-- {conn.name} (Elasticsearch DSL):\n{generated_query}"
                            pending_sql = None
                        elif conn.type == "neo4j":
                            pending_sql = f"-- {conn.name} (Neo4j Cypher):\n{generated_query}"
                            pending_mql = None
                        else:
                            pending_sql = f"-- {conn.name} ({label}):\n{generated_query}"
                            pending_mql = None
                        yield f"data: {json.dumps({'type': 'sql', 'sql': pending_sql, 'mql': pending_mql, 'timestamp': ts})}\n\n"
                        evt = {
                            "type": "pending_approval",
                            "pending_approval": True,
                            "approval_id": pending["id"],
                            "operation": pending["operation"],
                            "risk_level": exec_out["plan"].risk,
                            "reason": pending.get("reason"),
                            "original_prompt": request.question,
                            "preview": exec_out["preview"],
                            "query": generated_query,
                            "connection_id": conn.id,
                            "database": conn.name,
                            "timestamp": ts,
                        }
                        yield f"data: {json.dumps(evt)}\n\n"
                        yield f"data: {json.dumps({'type': 'done', 'id': os.urandom(8).hex()})}\n\n"
                        return
                    headers = exec_out["headers"]
                    rows = exec_out["rows"]
                    per_source_results.append({
                        "connection_id": conn_id,
                        "database": conn.name,
                        "headers": headers,
                        "rows": rows,
                        "query": generated_query,
                        "dialect": conn.type,
                    })
                    label = conn.type.upper()
                    if conn.type == "mongodb":
                        mql_details.append(f"-- {conn.name} (MongoDB):\n{generated_query}")
                    elif conn.type == "elasticsearch":
                        mql_details.append(f"-- {conn.name} (Elasticsearch DSL):\n{generated_query}")
                    elif conn.type == "neo4j":
                        query_details.append(f"-- {conn.name} (Neo4j Cypher):\n{generated_query}")
                    else:
                        query_details.append(f"-- {conn.name} ({label}):\n{generated_query}")

                except ValueError as ve:
                    yield f"data: {json.dumps({'type': 'error', 'data': str(ve)})}\n\n"
                    return
                except Exception as e:
                    log.error("[STREAM] DB error on '%s': %s", conn_id, e)
                    query_errors.append(f"{conn.name}: {_short_db_error(e)}")
                    continue

            if not per_source_results:
                if query_errors:
                    err_msg = query_errors[0] if len(query_errors) == 1 else "; ".join(query_errors[:3])
                else:
                    err_msg = "No results from any database."
                yield f"data: {json.dumps({'type': 'error', 'data': err_msg})}\n\n"
                return

            # ── 3. Legacy combined + primary results ───────────────────
            legacy_table = _combine_legacy_table(per_source_results)
            combined_headers = legacy_table["headers"]
            combined_rows = legacy_table["rows"]

            combined_sql = "\n\n".join(query_details) if query_details else None
            combined_mql = "\n\n".join(mql_details) if mql_details else None

            visualization = _infer_visualization(request.question)

            from datetime import datetime
            timestamp = datetime.now().strftime("%I:%M %p")

            # ── 4. Send SQL / MQL immediately ─────────────────────────
            yield f"data: {json.dumps({'type': 'sql', 'sql': combined_sql, 'mql': combined_mql, 'timestamp': timestamp, 'visualization': visualization})}\n\n"

            # ── 5. Per-source results (primary) + legacy combined table ─
            yield f"data: {json.dumps({'type': 'results', 'results': per_source_results})}\n\n"
            yield f"data: {json.dumps({'type': 'table', 'headers': combined_headers, 'rows': combined_rows})}\n\n"

            # ── 6. Stream synthesis token by token ────────────────────
            async for token in sql_agent.synthesize_answer_stream(
                request.question,
                combined_headers,
                combined_rows,
                provider=request.provider,
                model_name=request.model,
            ):
                yield f"data: {json.dumps({'type': 'content', 'data': token})}\n\n"
                await asyncio.sleep(0)  # yield control to event loop

            yield f"data: {json.dumps({'type': 'done', 'id': os.urandom(8).hex()})}\n\n"

        except Exception as e:
            log.error("[STREAM] Unexpected error: %s", e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'data': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/dashboard-generate")
@limiter.limit(DASHBOARD_RATE_LIMIT)
def generate_dashboard(
    request: Request,
    payload: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    request = payload
    log.info("[API] POST /dashboard-generate  user=%s", current_user["id"])
    _enforce_query_quota(current_user["id"])

    if not sql_agent or not connection_manager:
        raise HTTPException(status_code=500, detail="Backend not fully initialized")

    conn_id = request.connection_id or (request.connection_ids[0] if request.connection_ids else None)
    if not conn_id:
        raise HTTPException(status_code=400, detail="No database connection specified")

    conn = connection_manager.get_connection(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Database connection not found")

    try:
        temp_manager = _build_db_manager(conn)
        schema, _structured = _get_schema_for_connection(conn)
        queries = sql_agent.generate_dashboard_queries(schema, provider=request.provider, model_name=request.model)
        if not queries:
            raise HTTPException(status_code=500, detail="Failed to generate dashboard queries")

        widgets = []
        for q in queries:
            try:
                validate_query_for_dialect(q["query"], conn.type)
                headers, rows = temp_manager.execute_query(q["query"])
                if rows:
                    widgets.append({
                        "title": q.get("title", "Widget"),
                        "chartType": q.get("chartType", "bar"),
                        "tableData": {"headers": headers, "rows": rows},
                    })
            except Exception as ex:
                log.warning("[API] Dashboard query failed: %s", ex)

        if not widgets:
            raise HTTPException(status_code=500, detail="All dashboard queries failed to return data.")

        return {"widgets": widgets}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        log.error("[API] Error in /dashboard-generate: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explain")
@limiter.limit(EXPLAIN_RATE_LIMIT)
def explain_query_api(
    request: Request,
    payload: ExplainRequest,
    current_user: dict = Depends(get_current_user),
):
    log.info("[API] POST /explain user=%s", current_user["id"])
    if not payload.connection_id:
        raise HTTPException(status_code=400, detail="connection_id is required")
        
    conn = connection_manager.get_connection(payload.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Database connection not found")
        
    try:
        db_manager = _build_db_manager(conn)
        if not hasattr(db_manager, "explain_query"):
            raise HTTPException(status_code=400, detail="EXPLAIN is not supported for this database type.")
            
        plan_json = db_manager.explain_query(payload.query)
        return {"plan": plan_json}
    except Exception as e:
        log.error("[API] Error in /explain: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/optimize")
@limiter.limit(OPTIMIZE_RATE_LIMIT)
def optimize_query_api(
    request: Request,
    payload: OptimizeRequest,
    current_user: dict = Depends(get_current_user),
):
    log.info("[API] POST /optimize user=%s", current_user["id"])
    _enforce_query_quota(current_user["id"])
    if not payload.connection_id:
        raise HTTPException(status_code=400, detail="connection_id is required")
        
    conn = connection_manager.get_connection(payload.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Database connection not found")
        
    try:
        db_manager = _build_db_manager(conn)
        schema, _structured = _get_schema_for_connection(conn)
        
        optimization = sql_agent.optimize_query(
            query=payload.query,
            explain_json=payload.explain_json,
            schema=schema,
            provider=payload.provider,
            model_name=payload.model
        )
        return optimization
    except Exception as e:
        log.error("[API] Error in /optimize: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/suggest")
@limiter.limit(SUGGEST_RATE_LIMIT)
def suggest_questions(
    request: Request,
    payload: SuggestionRequest,
    current_user: dict = Depends(get_current_user),
):
    request = payload
    log.info("[API] POST /suggest  user=%s  connection_id='%s'", current_user["id"], request.connection_id)
    conn = None
    current_db_manager = None

    if request.connection_id:
        conn = connection_manager.get_connection(request.connection_id)
    elif request.database:
        conn = connection_manager.find_connection_by_name_or_type(request.database)

    if conn:
        current_db_manager = _build_db_manager(conn)

    if not current_db_manager or not sql_agent:
        return []

    try:
        schema, _structured = _get_schema_for_connection(conn)
        history_text = ""
        for msg in request.history[-SUGGEST_HISTORY_LIMIT:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "").strip()
            if role == "Assistant" and len(content) > SUGGEST_ASSISTANT_MAX_CHARS:
                content = content[:SUGGEST_ASSISTANT_MAX_CHARS] + "..."
            if content:
                history_text += f"{role}: {content}\n"

        suggestions = sql_agent.generate_suggestions(
            history_text,
            schema,
            provider=request.provider,
            model_name=request.model,
        )
        return suggestions
    except Exception as e:
        log.error("[API] /suggest error: %s", e, exc_info=True)
        return []


@app.post("/summarize")
def summarize_chat(
    request: dict,
    current_user: dict = Depends(get_current_user),
):
    question = request.get("question")
    response_text = request.get("response")
    provider = request.get("provider", LLM_PROVIDER)
    model = request.get("model", LLM_MODEL)

    if not question or not response_text or not sql_agent:
        return {"title": "New Chat"}

    try:
        title = sql_agent.summarize_conversation(question, response_text, provider, model)
        return {"title": title}
    except Exception as e:
        log.error("[API] /summarize error: %s", e, exc_info=True)
        return {"title": question[:30] + "..." if len(question) > 30 else question}


# ---------------------------------------------------------------------------
# User data persistence – chat history, saved queries, projects
# ---------------------------------------------------------------------------

# ── Chat sessions ──────────────────────────────────────────────────────────

@app.get("/history")
def get_history(org_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    try:
        return ud.list_sessions(str(current_user["id"]), org_id=org_id)
    except Exception as ex:
        log.error("[API] /history failed for user=%s org=%s: %s", current_user["id"], org_id, ex, exc_info=True)
        return []


@app.put("/history/{session_id}")
def upsert_session(
    session_id: str,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    session = ud.upsert_session(
        user_id=str(current_user["id"]),
        session_id=session_id,
        title=body.get("title", "Untitled"),
        is_favorite=body.get("isFavorite", False),
        updated_at=body.get("updatedAt", 0),
        org_id=body.get("org_id"),
    )
    if body.get("messages") is not None:
        ud.save_messages(session_id, body["messages"])
    return session


@app.delete("/history/{session_id}")
def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
):
    ud.delete_session(str(current_user["id"]), session_id)
    return {"status": "deleted"}


# ── Saved queries ──────────────────────────────────────────────────────────

@app.get("/saved-queries")
def get_saved_queries(org_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    return ud.list_saved_queries(str(current_user["id"]), org_id=org_id)


@app.post("/saved-queries")
def save_query(
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    return ud.upsert_saved_query(str(current_user["id"]), body)


@app.delete("/saved-queries/{query_id}")
def delete_saved_query(
    query_id: str,
    current_user: dict = Depends(get_current_user),
):
    ud.delete_saved_query(str(current_user["id"]), query_id)
    return {"status": "deleted"}


# ── Projects ──────────────────────────────────────────────────────────────

@app.get("/projects")
def get_projects(org_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    return ud.list_projects(str(current_user["id"]), org_id=org_id)


@app.post("/projects")
def create_project(
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    return ud.upsert_project(str(current_user["id"]), body, org_id=body.get("org_id"))


@app.put("/projects/{project_id}")
def update_project(
    project_id: str,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    body["id"] = project_id
    return ud.upsert_project(str(current_user["id"]), body, org_id=body.get("org_id"))


@app.delete("/projects/{project_id}")
def delete_project(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    ud.delete_project(str(current_user["id"]), project_id)
    return {"status": "deleted"}


# ── Dashboards ─────────────────────────────────────────────────────────────

@app.get("/dashboards")
def get_dashboards(org_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    return ud.list_dashboards(str(current_user["id"]), org_id=org_id)


@app.post("/dashboards")
def create_dashboard(
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    return ud.upsert_dashboard(str(current_user["id"]), body, org_id=body.get("org_id"))


@app.put("/dashboards/{dashboard_id}")
def update_dashboard(
    dashboard_id: str,
    body: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
):
    body["id"] = dashboard_id
    return ud.upsert_dashboard(str(current_user["id"]), body, org_id=body.get("org_id"))


@app.delete("/dashboards/{dashboard_id}")
def delete_dashboard(
    dashboard_id: str,
    current_user: dict = Depends(get_current_user),
):
    ud.delete_dashboard(str(current_user["id"]), dashboard_id)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Teams / workspaces
# ---------------------------------------------------------------------------

class OrgCreateRequest(BaseModel):
    name: str

class OrgUpdateRequest(BaseModel):
    name: str

class InviteRequest(BaseModel):
    email: str
    role: str = "member"

class RoleUpdateRequest(BaseModel):
    role: str

class AcceptInviteRequest(BaseModel):
    token: str


class ApprovalActionRequest(BaseModel):
    comment: Optional[str] = None


class ApprovalBulkDeleteRequest(BaseModel):
    ids: Optional[List[str]] = None
    status: Optional[str] = None
    org_id: Optional[str] = None


@app.get("/orgs")
def get_my_orgs(current_user: dict = Depends(get_current_user)):
    # Cache user info for member display
    tm.upsert_user_info(str(current_user["id"]), current_user.get("email", ""), current_user.get("name", ""))
    return tm.list_user_orgs(str(current_user["id"]))


@app.post("/orgs")
def create_org(body: OrgCreateRequest, current_user: dict = Depends(get_current_user)):
    return tm.create_org(body.name, str(current_user["id"]))


@app.patch("/orgs/{org_id}")
def update_org(org_id: str, body: OrgUpdateRequest, current_user: dict = Depends(get_current_user)):
    org = tm.get_org(org_id)
    if not org or org["owner_id"] != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Only the owner can update the org.")
    return tm.update_org(org_id, body.name)


@app.delete("/orgs/{org_id}")
def delete_org(org_id: str, current_user: dict = Depends(get_current_user)):
    org = tm.get_org(org_id)
    if not org or org["owner_id"] != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Only the owner can delete the org.")
    tm.delete_org(org_id, str(current_user["id"]))
    return {"status": "deleted"}


@app.get("/orgs/{org_id}/members")
def get_members(org_id: str, current_user: dict = Depends(get_current_user)):
    # Cache current user's info
    tm.upsert_user_info(str(current_user["id"]), current_user.get("email", ""), current_user.get("name", ""))
    role = tm.get_member_role(org_id, str(current_user["id"]))
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this org.")
    return tm.list_members_enriched(org_id)


@app.patch("/orgs/{org_id}/members/{target_user_id}")
def update_member(
    org_id: str,
    target_user_id: str,
    body: RoleUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    role = tm.get_member_role(org_id, str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can change roles.")
    try:
        tm.update_member_role(org_id, target_user_id, body.role)
        return {"status": "updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/orgs/{org_id}/members/{target_user_id}")
def remove_member(
    org_id: str,
    target_user_id: str,
    current_user: dict = Depends(get_current_user),
):
    my_role = tm.get_member_role(org_id, str(current_user["id"]))
    # Allow self-removal (leave) or admin/owner removal
    if str(current_user["id"]) != target_user_id and my_role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can remove members.")
    tm.remove_member(org_id, target_user_id)
    return {"status": "removed"}


@app.get("/orgs/{org_id}/invites")
def get_invites(org_id: str, current_user: dict = Depends(get_current_user)):
    role = tm.get_member_role(org_id, str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can view invites.")
    return tm.list_invites(org_id)


@app.post("/orgs/{org_id}/invites")
def invite_member(
    org_id: str,
    body: InviteRequest,
    current_user: dict = Depends(get_current_user),
):
    role = tm.get_member_role(org_id, str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can invite members.")
    try:
        invite = tm.create_invite(org_id, body.email, body.role, str(current_user["id"]))
        return invite
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/orgs/{org_id}/invites/{invite_id}")
def revoke_invite(
    org_id: str,
    invite_id: str,
    current_user: dict = Depends(get_current_user),
):
    role = tm.get_member_role(org_id, str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only admins can revoke invites.")
    tm.revoke_invite(invite_id, org_id)
    return {"status": "revoked"}


@app.post("/invites/accept")
def accept_invite(body: AcceptInviteRequest, current_user: dict = Depends(get_current_user)):
    result = tm.accept_invite(body.token, str(current_user["id"]))
    if not result:
        raise HTTPException(status_code=400, detail="Invite not found, expired, or already used.")
    return {"status": "accepted", "org_id": result["org_id"]}


@app.get("/orgs/{org_id}/approval-policies")
def get_approval_policies(org_id: str, current_user: dict = Depends(get_current_user)):
    role = tm.get_member_role(org_id, str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owner/admin can read policies.")
    approval_repo.seed_default_policies(org_id)
    return approval_repo.list_policies(org_id)


@app.put("/orgs/{org_id}/approval-policies")
def put_approval_policies(org_id: str, body: List[Dict[str, Any]], current_user: dict = Depends(get_current_user)):
    role = tm.get_member_role(org_id, str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owner/admin can update policies.")
    return approval_repo.replace_policies(org_id, body)


@app.get("/approvals")
def list_approvals(org_id: Optional[str] = None, status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    uid = str(current_user["id"])
    try:
        rows = approval_repo.list_requests(org_id, status)
        return [row for row in rows if _can_view_approval(row, uid)]
    except Exception as ex:
        log.error("[API] /approvals failed for user=%s org=%s status=%s: %s", uid, org_id, status, ex, exc_info=True)
        return []


@app.get("/approvals/mine")
def list_my_approvals(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    uid = str(current_user["id"])
    try:
        rows = approval_repo.list_requests(None, status)
        return [row for row in rows if str(row.get("requester_id") or "") == uid]
    except Exception as ex:
        log.error("[API] /approvals/mine failed for user=%s status=%s: %s", uid, status, ex, exc_info=True)
        return []


@app.post("/approvals/{approval_id}/approve")
def approve_request(approval_id: str, body: ApprovalActionRequest, current_user: dict = Depends(get_current_user)):
    req = approval_repo.get_request(approval_id)
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")
    role = _approval_workspace_role(req.get("workspace_id"), str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owner/admin can approve.")
    conn = connection_manager.get_connection(req["connection_id"])
    if not conn:
        raise HTTPException(status_code=404, detail="Connection for this approval request was not found")
    try:
        adapter = AdapterFactory.create(conn)
        plan = adapter.classify_operation(req["query"])
        resolved = approval_engine.approve(approval_id, str(current_user["id"]), adapter, plan, body.comment)
    except HTTPException:
        raise
    except Exception as ex:
        log.error("[API] Approve/execute failed id=%s: %s", approval_id, ex, exc_info=True)
        approval_repo.resolve_request(
            approval_id, "failed", str(current_user["id"]), body.comment, None, str(ex)
        )
        notification_hub.emit(
            req["workspace_id"],
            "approval_resolved",
            {"request_id": approval_id, "status": "failed", "error": str(ex)},
        )
        raise HTTPException(status_code=500, detail=f"Approved but execution failed: {ex}") from ex

    try:
        schema_cache.invalidate(req["connection_id"])
    except Exception:
        pass

    summary = {
        "request_id": approval_id,
        "status": "approved",
        "operation": req.get("operation"),
        "connection_id": req.get("connection_id"),
        "query": req.get("query"),
        "message": f"{req.get('operation', 'Query')} executed successfully after approval.",
        "execution": resolved.get("execution") if isinstance(resolved, dict) else None,
    }
    notification_hub.emit(req["workspace_id"], "approval_resolved", summary)
    notification_hub.emit(req["workspace_id"], "execution_complete", summary)
    return {**resolved, "message": summary["message"]}


@app.post("/approvals/{approval_id}/reject")
def reject_request(approval_id: str, body: ApprovalActionRequest, current_user: dict = Depends(get_current_user)):
    req = approval_repo.get_request(approval_id)
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")
    role = _approval_workspace_role(req.get("workspace_id"), str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owner/admin can reject.")
    resolved = approval_engine.reject(approval_id, str(current_user["id"]), body.comment)
    notification_hub.emit(
        req["workspace_id"],
        "approval_resolved",
        {"request_id": approval_id, "status": "rejected", "message": "Query rejected — not executed."},
    )
    return {**resolved, "message": "Query rejected — the SQL was not executed."}


@app.delete("/approvals/{approval_id}")
def delete_approval(approval_id: str, current_user: dict = Depends(get_current_user)):
    req = approval_repo.get_request(approval_id)
    if not req:
        raise HTTPException(status_code=404, detail="Approval request not found")
    role = _approval_workspace_role(req.get("workspace_id"), str(current_user["id"]))
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owner/admin can delete approvals.")
    ok = approval_repo.delete_request(approval_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Approval request not found")
    return {"deleted": True, "id": approval_id}


@app.post("/approvals/bulk-delete")
def bulk_delete_approvals(body: ApprovalBulkDeleteRequest, current_user: dict = Depends(get_current_user)):
    uid = str(current_user["id"])
    workspace_id = body.org_id
    if workspace_id:
        role = _approval_workspace_role(workspace_id, uid)
        if role not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Only owner/admin can delete approvals.")
    elif body.ids:
        # Verify each id belongs to a workspace the user can manage
        for rid in body.ids:
            req = approval_repo.get_request(rid)
            if not req:
                continue
            role = _approval_workspace_role(req.get("workspace_id"), uid)
            if role not in ("owner", "admin"):
                raise HTTPException(status_code=403, detail=f"Not allowed to delete approval {rid}")
    else:
        raise HTTPException(status_code=400, detail="Provide ids and/or org_id+status")

    if body.status and body.status not in ("pending", "approved", "rejected", "expired", "failed"):
        raise HTTPException(status_code=400, detail="Invalid status filter")

    deleted = approval_repo.delete_requests(
        workspace_id=workspace_id,
        ids=body.ids,
        status=body.status,
    )
    return {"deleted": deleted}


@app.get("/approvals/stream")
async def approvals_stream(org_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    uid = str(current_user["id"])
    workspace_id = org_id or f"user:{uid}"
    role = _approval_workspace_role(workspace_id, uid) if org_id else "owner"
    if role is None:
        raise HTTPException(status_code=403, detail="Not a member of this workspace.")
    q = notification_hub.subscribe(workspace_id)

    async def events():
        # Never call blocking queue.Queue.get() on the event loop — that freezes
        # the whole uvicorn worker (all /orgs, /approvals, /databases hang).
        import queue as _queue

        try:
            while True:
                try:
                    item = await asyncio.to_thread(q.get, True, 15.0)
                    yield item
                except _queue.Empty:
                    yield "event: ping\ndata: {}\n\n"
        finally:
            notification_hub.unsubscribe(workspace_id, q)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Billing (Stripe)
# ---------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    plan: str  # "pro" | "enterprise"


@app.get("/billing/subscription")
def get_subscription(current_user: dict = Depends(get_current_user)):
    uid = str(current_user["id"])
    sub = billing.get_subscription(uid)
    if connection_manager and isinstance(sub.get("usage"), dict):
        owned = [c for c in connection_manager.list_connections() if c.user_id == uid]
        sub["usage"]["connections_this_month"] = len(owned)
        sub["usage"]["connections_used"] = len(owned)
    return sub


@app.post("/billing/checkout")
def create_checkout(
    body: CheckoutRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        url = billing.create_checkout_session(
            str(current_user["id"]),
            current_user.get("email", ""),
            body.plan,
        )
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/billing/portal")
def billing_portal(current_user: dict = Depends(get_current_user)):
    try:
        url = billing.create_portal_session(str(current_user["id"]))
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/billing/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        result = billing.handle_webhook(payload, sig)
        return result
    except Exception as e:
        log.error("[BILLING] Webhook error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Health check (public – no auth required)
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "components": {
            "connection_manager": connection_manager is not None,
            "sql_agent": sql_agent is not None,
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=UVICORN_HOST, port=UVICORN_PORT, reload=True)
