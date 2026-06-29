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
import user_data as ud
import billing
import teams as tm

log = get_logger("main")

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
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
log.info("[STARTUP] CORS allowed_origins: %s", allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
                            "UNION SELECT DISTINCT user_id FROM saved_queries WHERE org_id IS NULL").fetchall()
        
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

migrate_personal_workspaces()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_db_manager(conn):
    db_url = connection_manager.format_connection_url(conn)
    db_type = conn.type
    if db_type == "mongodb":
        from mongo_database import MongoDatabaseManager
        return MongoDatabaseManager(db_url)
    elif db_type == "snowflake":
        from snowflake_database import SnowflakeDatabaseManager
        return SnowflakeDatabaseManager(db_url)
    elif db_type == "elasticsearch":
        from elasticsearch_database import ElasticsearchDatabaseManager
        return ElasticsearchDatabaseManager(db_url)
    elif db_type == "neo4j":
        from neo4j_database import Neo4jDatabaseManager
        return Neo4jDatabaseManager(db_url)
    else:
        from database import DatabaseManager
        return DatabaseManager(db_url)


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
def get_databases(current_user: dict = Depends(get_current_user)):
    log.info("[API] GET /databases  user=%s", current_user["id"])
    connections = connection_manager.list_connections()
    # Filter to this user's connections only
    user_conns = [c for c in connections if c.user_id == str(current_user["id"]) or c.user_id is None]
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
        elif request.type not in ["sqlite", "mongodb", "neo4j"] and (not request.host or not request.database):
            return {"status": "error", "message": "Host and Database name are required for this database type."}

        dummy_conn = DatabaseConnection(**request.dict())
        db_url = cm.format_connection_url(dummy_conn)

        # Detect actual type from URL or request type
        is_mongodb = request.type == "mongodb" or db_url.startswith("mongodb://") or db_url.startswith("mongodb+srv://")
        is_snowflake = request.type == "snowflake" or db_url.startswith("snowflake://")
        is_neo4j = request.type == "neo4j" or db_url.startswith("neo4j://") or db_url.startswith("neo4j+s://") or db_url.startswith("bolt://") or db_url.startswith("bolt+s://")
        is_elasticsearch = request.type == "elasticsearch" or db_url.startswith("elasticsearch://")

        if is_mongodb:
            from pymongo import MongoClient
            client = MongoClient(db_url, serverSelectionTimeoutMS=5000)
            client.admin.command('ping')
            return {"status": "success", "message": "Connection successful! MongoDB is reachable."}
        elif is_snowflake:
            from sqlalchemy import create_engine, text as sa_text
            engine = create_engine(db_url)
            with engine.connect() as conn:
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
            neo_mgr = Neo4jDatabaseManager(db_url)
            neo_mgr.driver.verify_connectivity()
            return {"status": "success", "message": "Connection successful! Neo4j is reachable."}
        else:
            from sqlalchemy import create_engine, text as sa_text
            engine = create_engine(db_url, connect_args={'connect_timeout': 5})
            with engine.connect() as conn:
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
        data = request.dict()
        data["user_id"] = str(current_user["id"])
        conn = connection_manager.add_connection(data)
        log.info("[API] Database added successfully – id='%s'", conn.id)
        return conn
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
    if conn and conn.user_id and conn.user_id != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not your database connection.")
    connection_manager.delete_connection(conn_id)
    return {"status": "deleted"}


@app.put("/databases/{conn_id}")
def update_database(
    conn_id: str,
    request: ConnectionRequest,
    current_user: dict = Depends(get_current_user),
):
    conn = connection_manager.get_connection(conn_id)
    if conn and conn.user_id and conn.user_id != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not your database connection.")
    updated = connection_manager.update_connection(conn_id, request.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Connection not found")
    return updated


@app.put("/databases/{conn_id}/default")
def set_default_database(
    conn_id: str,
    current_user: dict = Depends(get_current_user),
):
    try:
        connections = connection_manager._load()
        current_status = False
        for c in connections:
            if c['id'] == conn_id:
                c['is_default'] = not c.get('is_default', False)
                current_status = c['is_default']
                break
        connection_manager._save(connections)
        return {"status": "success", "is_default": current_status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Core AI endpoints
# ---------------------------------------------------------------------------

class SuggestionRequest(BaseModel):
    history: List[dict] = []
    connection_id: Optional[str] = None
    database: Optional[str] = None
    provider: str = "gemini"
    model: str = "gemini-2.0-flash"


@app.post("/ask")
@limiter.limit(os.getenv("ASK_RATE_LIMIT", "30/minute"))
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

        success_results = []
        query_details = []
        mql_details = []

        for conn_id in selected_connection_ids:
            conn = connection_manager.get_connection(conn_id)
            if not conn:
                continue

            db_type = conn.type
            try:
                temp_manager = _build_db_manager(conn)
                schema = temp_manager.get_schema()

                generated_query = sql_agent.generate_query(
                    request.question,
                    schema,
                    db_type=db_type,
                    provider=request.provider,
                    model_name=request.model,
                )

                if not generated_query.strip() or "NOT_APPLICABLE" in generated_query:
                    continue

                max_retries = 2
                attempt = 0
                while attempt <= max_retries:
                    try:
                        headers, rows = temp_manager.execute_query(generated_query)
                        success_results.append((headers, rows, conn.name))
                        break
                    except ValueError as ve:
                        raise ve
                    except Exception as e:
                        if attempt < max_retries:
                            log.warning("[API] DB query failed. Retrying with self-heal (attempt %d). Error: %s", attempt + 1, e)
                            generated_query = sql_agent.fix_query(
                                request.question, schema, generated_query, str(e),
                                db_type=db_type, provider=request.provider, model_name=request.model
                            )
                            attempt += 1
                        else:
                            raise e

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
                continue

        if not success_results:
            raise HTTPException(status_code=500, detail="No query returned valid results from any selected database.")

        # Combine results from multiple databases
        all_headers: list = []
        seen: set = set()
        for headers, rows, _ in success_results:
            for h in headers:
                if h not in seen:
                    seen.add(h)
                    all_headers.append(h)

        combined_headers = ["SOURCE_DATABASE"] + all_headers
        combined_rows = []
        for headers, rows, db_name in success_results:
            h_to_idx = {h: idx for idx, h in enumerate(headers)}
            for row in rows:
                combined_row = [db_name] + [row[h_to_idx[h]] if h in h_to_idx else None for h in all_headers]
                combined_rows.append(combined_row)

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
        ) if success_results else None

        if not content_msg:
            db_names_str = ", ".join(r[2] for r in success_results)
            content_msg = f"Results from database(s): {db_names_str}"

        primary_db_type = "postgresql"
        if selected_connection_ids:
            c = connection_manager.get_connection(selected_connection_ids[0])
            if c:
                primary_db_type = c.type

        elapsed_total = time.perf_counter() - t_start
        log.info("[API] /ask completed in %.2fs – %d row(s) × %d col(s).",
                 elapsed_total, len(combined_rows), len(combined_headers))

        question_lower = request.question.lower()
        visualization = None
        if "bar chart" in question_lower or "bar graph" in question_lower:
            visualization = "bar"
        elif "pie chart" in question_lower or "pie graph" in question_lower:
            visualization = "pie"
        elif "line chart" in question_lower or "line graph" in question_lower:
            visualization = "line"
        elif "area chart" in question_lower or "area graph" in question_lower:
            visualization = "area"
        elif any(w in question_lower for w in ("chart", "graph", "dashboard", "plot")):
            visualization = "auto"

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
            "tableData": {"headers": combined_headers, "rows": combined_rows},
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        log.error("[API] Unexpected error in /ask: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/ask/stream")
@limiter.limit(os.getenv("ASK_RATE_LIMIT", "30/minute"))
async def ask_question_stream(
    request: Request,
    payload: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    request = payload
    """SSE streaming version of /ask — sends SQL + table data first, then streams the synthesis token by token."""

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
            success_results = []
            query_details = []

            for conn_id in selected_connection_ids:
                conn = connection_manager.get_connection(conn_id)
                if not conn:
                    continue
                try:
                    temp_manager = _build_db_manager(conn)
                    schema = temp_manager.get_schema()

                    generated_query = sql_agent.generate_query(
                        request.question, schema,
                        db_type=conn.type,
                        provider=request.provider,
                        model_name=request.model,
                    )

                    if not generated_query.strip() or "NOT_APPLICABLE" in generated_query:
                        continue

                    max_retries = 2
                    attempt = 0
                    while attempt <= max_retries:
                        try:
                            headers, rows = temp_manager.execute_query(generated_query)
                            success_results.append((headers, rows, conn.name))
                            query_details.append(f"-- {conn.name} ({conn.type.upper()}):\n{generated_query}")
                            break
                        except ValueError as ve:
                            raise ve
                        except Exception as e:
                            if attempt < max_retries:
                                log.warning("[STREAM] DB query failed. Retrying with self-heal (attempt %d). Error: %s", attempt + 1, e)
                                generated_query = sql_agent.fix_query(
                                    request.question, schema, generated_query, str(e),
                                    db_type=conn.type, provider=request.provider, model_name=request.model
                                )
                                attempt += 1
                            else:
                                raise e

                except ValueError as ve:
                    yield f"data: {json.dumps({'type': 'error', 'data': str(ve)})}\n\n"
                    return
                except Exception as e:
                    log.error("[STREAM] DB error on '%s': %s", conn_id, e)
                    continue

            if not success_results:
                yield f"data: {json.dumps({'type': 'error', 'data': 'No results from any database.'})}\n\n"
                return

            # ── 3. Combine multi-DB results ───────────────────────────
            all_headers: list = []
            seen: set = set()
            for h, _, _ in success_results:
                for col in h:
                    if col not in seen:
                        seen.add(col)
                        all_headers.append(col)

            combined_headers = ["SOURCE_DATABASE"] + all_headers
            combined_rows = []
            for h, rows, db_name in success_results:
                h_to_idx = {col: i for i, col in enumerate(h)}
                for row in rows:
                    combined_rows.append(
                        [db_name] + [row[h_to_idx[col]] if col in h_to_idx else None for col in all_headers]
                    )

            combined_sql = "\n\n".join(query_details) if query_details else None

            question_lower = request.question.lower()
            visualization = None
            if "bar chart" in question_lower or "bar graph" in question_lower:
                visualization = "bar"
            elif "pie chart" in question_lower or "pie graph" in question_lower:
                visualization = "pie"
            elif "line chart" in question_lower or "line graph" in question_lower:
                visualization = "line"
            elif any(w in question_lower for w in ("chart", "graph", "plot")):
                visualization = "auto"

            from datetime import datetime
            timestamp = datetime.now().strftime("%I:%M %p")

            # ── 4. Send SQL immediately ───────────────────────────────
            yield f"data: {json.dumps({'type': 'sql', 'sql': combined_sql, 'timestamp': timestamp, 'visualization': visualization})}\n\n"

            # ── 5. Send table data immediately ────────────────────────
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
@limiter.limit(os.getenv("DASHBOARD_RATE_LIMIT", "10/minute"))
def generate_dashboard(
    request: Request,
    payload: QueryRequest,
    current_user: dict = Depends(get_current_user),
):
    request = payload
    log.info("[API] POST /dashboard-generate  user=%s", current_user["id"])

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
        schema = temp_manager.get_schema()
        queries = sql_agent.generate_dashboard_queries(schema, provider=request.provider, model_name=request.model)
        if not queries:
            raise HTTPException(status_code=500, detail="Failed to generate dashboard queries")

        widgets = []
        for q in queries:
            try:
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
@limiter.limit("10/minute")
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
@limiter.limit("10/minute")
def optimize_query_api(
    request: Request,
    payload: OptimizeRequest,
    current_user: dict = Depends(get_current_user),
):
    log.info("[API] POST /optimize user=%s", current_user["id"])
    if not payload.connection_id:
        raise HTTPException(status_code=400, detail="connection_id is required")
        
    conn = connection_manager.get_connection(payload.connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Database connection not found")
        
    try:
        db_manager = _build_db_manager(conn)
        schema = db_manager.get_schema()
        
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
@limiter.limit(os.getenv("SUGGEST_RATE_LIMIT", "60/minute"))
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
        schema = current_db_manager.get_schema()
        history_text = ""
        for msg in request.history[-6:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "").strip()
            if role == "Assistant" and len(content) > 300:
                content = content[:300] + "..."
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
    provider = request.get("provider", "gemini")
    model = request.get("model", "gemini-2.0-flash")

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
    return ud.list_sessions(str(current_user["id"]), org_id=org_id)


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
        # In production: send invite email here
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


# ---------------------------------------------------------------------------
# Billing (Stripe)
# ---------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    plan: str  # "pro" | "enterprise"


@app.get("/billing/subscription")
def get_subscription(current_user: dict = Depends(get_current_user)):
    return billing.get_subscription(str(current_user["id"]))


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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
