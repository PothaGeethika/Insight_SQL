from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from models import QueryRequest, ConnectionRequest, DatabaseConnection
from typing import List, Optional
from agent import SQLAgent
from connection_manager import ConnectionManager
from logger_config import get_logger

log = get_logger("main")

class SuggestionRequest(BaseModel):
    history: List[dict] = []
    connection_id: Optional[str] = None
    database: Optional[str] = None
    provider: str = "gemini"
    model: str = "gemini-2.0-flash"

load_dotenv()

app = FastAPI(title="InsightSQL API")
log.info("[STARTUP] InsightSQL FastAPI application initialising...")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
log.info("[STARTUP] CORS middleware registered (allow_origins=*).")

# Add the current directory to sys.path
current_dir = str(Path(__file__).parent.resolve())
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Initialize components
db_manager = None
sql_agent = None
connection_manager = None

def init_components():
    global db_manager, sql_agent, connection_manager

    log.info("[STARTUP] ── Initialising backend components ──────────────")

    # Initialize Connection Manager
    try:
        log.info("[STARTUP] Loading ConnectionManager...")
        connection_manager = ConnectionManager()
        log.info("[STARTUP] ConnectionManager ready.")
    except Exception as e:
        log.error("[STARTUP] Failed to initialise ConnectionManager: %s", e, exc_info=True)

    # Initialize SQL Agent
    try:
        log.info("[STARTUP] Loading SQLAgent (LangChain prompts)...")
        sql_agent = SQLAgent()
        log.info("[STARTUP] SQLAgent ready.")
    except Exception as e:
        log.error("[STARTUP] Failed to initialise SQLAgent: %s", e, exc_info=True)

    # Initialize default db_manager if a default connection exists
    try:
        default_conn = connection_manager.get_default_connection() if connection_manager else None
        if default_conn:
            log.info("[STARTUP] Default connection found: name='%s'  type='%s'", default_conn.name, default_conn.type)
            db_url = connection_manager.format_connection_url(default_conn)
            if default_conn.type == "mongodb":
                from mongo_database import MongoDatabaseManager
                db_manager = MongoDatabaseManager(db_url)
            elif default_conn.type == "snowflake":
                from snowflake_database import SnowflakeDatabaseManager
                db_manager = SnowflakeDatabaseManager(db_url)
            elif default_conn.type == "elasticsearch":
                from elasticsearch_database import ElasticsearchDatabaseManager
                db_manager = ElasticsearchDatabaseManager(db_url)
            elif default_conn.type == "neo4j":
                from neo4j_database import Neo4jDatabaseManager
                db_manager = Neo4jDatabaseManager(db_url)
            else:
                from database import DatabaseManager
                db_manager = DatabaseManager(db_url)
            log.info("[STARTUP] Default db_manager initialised for type='%s'.", default_conn.type)
        else:
            log.info("[STARTUP] No default connection found – trying DATABASE_URL from .env...")
            db_url = os.getenv("DATABASE_URL")
            if db_url:
                if "mongodb" in db_url:
                    from mongo_database import MongoDatabaseManager
                    db_manager = MongoDatabaseManager(db_url)
                elif "snowflake" in db_url:
                    from snowflake_database import SnowflakeDatabaseManager
                    db_manager = SnowflakeDatabaseManager(db_url)
                elif "elasticsearch" in db_url:
                    from elasticsearch_database import ElasticsearchDatabaseManager
                    db_manager = ElasticsearchDatabaseManager(db_url)
                elif "neo4j" in db_url:
                    from neo4j_database import Neo4jDatabaseManager
                    db_manager = Neo4jDatabaseManager(db_url)
                else:
                    from database import DatabaseManager
                    db_manager = DatabaseManager(db_url)
                log.info("[STARTUP] db_manager initialised from DATABASE_URL env var.")
            else:
                log.warning("[STARTUP] No DATABASE_URL in .env and no default connection – db_manager not initialised.")
    except Exception as e:
        log.error("[STARTUP] Failed to initialise default db_manager: %s", e, exc_info=True)

    log.info("[STARTUP] ── All components initialised. Server ready. ──────")

init_components()

@app.get("/databases")
def get_databases():
    log.info("[API] GET /databases")
    connections = connection_manager.list_connections()
    log.info("[API] Returning %d database connection(s).", len(connections))
    return connections

@app.post("/databases/test")
def test_database_connection(request: ConnectionRequest):
    log.info("[API] POST /databases/test  type='%s'  host='%s'  db='%s'",
             request.type, request.host, request.database)
    try:
        from connection_manager import ConnectionManager
        cm = ConnectionManager()
        
        # Validate required fields for non-sqlite
        if request.type == "snowflake":
            if not request.account or not request.database:
                return {"status": "error", "message": "Account Identifier and Database name are required for Snowflake."}
        elif request.type not in ["sqlite", "mongodb", "neo4j"] and (not request.host or not request.database):
            return {"status": "error", "message": "Host and Database name are required for this database type."}

        # Create a temporary connection object
        dummy_conn = DatabaseConnection(**request.dict())
        db_url = cm.format_connection_url(dummy_conn)
        
        if request.type == "mongodb":
            from pymongo import MongoClient
            client = MongoClient(db_url, serverSelectionTimeoutMS=5000)
            client.admin.command('ping')
            log.info("[API] /databases/test SUCCESS for type='%s'", request.type)
            return {"status": "success", "message": "Connection successful! MongoDB is reachable."}
        elif request.type == "snowflake":
            from sqlalchemy import create_engine, text
            engine = create_engine(db_url)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            log.info("[API] /databases/test SUCCESS for type='%s'", request.type)
            return {"status": "success", "message": "Connection successful! Snowflake is reachable."}
        elif request.type == "elasticsearch":
            from elasticsearch_database import ElasticsearchDatabaseManager
            es_mgr = ElasticsearchDatabaseManager(db_url)
            if es_mgr.client.ping():
                return {"status": "success", "message": "Connection successful! Elasticsearch is reachable."}
            else:
                raise Exception("Elasticsearch ping failed.")
        elif request.type == "neo4j":
            from neo4j_database import Neo4jDatabaseManager
            try:
                neo_mgr = Neo4jDatabaseManager(db_url)
                neo_mgr.driver.verify_connectivity()
                return {"status": "success", "message": "Connection successful! Neo4j is reachable."}
            except Exception as e:
                raise Exception(f"Neo4j connection failed: {str(e)}")
        else:
            # SQL connection test
            from sqlalchemy import create_engine, text
            engine = create_engine(db_url, connect_args={'connect_timeout': 5})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            log.info("[API] /databases/test SUCCESS for type='%s'", request.type)
            return {"status": "success", "message": "Connection successful! Database is reachable."}

    except Exception as e:
        log.error("[API] /databases/test FAILED for type='%s': %s", request.type, e)
        return {"status": "error", "message": f"Connection Failed: {str(e)}"}

@app.post("/databases")
def add_database(request: ConnectionRequest):
    log.info("[API] POST /databases  name='%s'  type='%s'", request.name, request.type)
    try:
        conn = connection_manager.add_connection(request.dict())
        log.info("[API] Database added successfully – id='%s'", conn.id)
        return conn
    except Exception as e:
        log.error("[API] Failed to add database: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/databases/{conn_id}")
def delete_database(conn_id: str):
    log.info("[API] DELETE /databases/%s", conn_id)
    connection_manager.delete_connection(conn_id)
    log.info("[API] Connection '%s' deleted.", conn_id)
    return {"status": "deleted"}

@app.put("/databases/{conn_id}")
def update_database(conn_id: str, request: ConnectionRequest):
    try:
        connections = connection_manager._load()
        updated = False
        for i, c in enumerate(connections):
            if c['id'] == conn_id:
                new_data = request.dict()
                new_data['id'] = conn_id
                new_data['is_default'] = c.get('is_default', False)
                connections[i] = new_data
                updated = True
                break
        if not updated:
            raise HTTPException(status_code=404, detail="Connection not found")
        connection_manager._save(connections)
        return connections[i]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/databases/{conn_id}/default")
def set_default_database(conn_id: str):
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

@app.post("/ask")
def ask_question(request: QueryRequest):
    t_start = time.perf_counter()
    log.info("[API] ════ POST /ask ════════════════════════════════════════")
    log.info("[API] Question  : %s", request.question)
    log.info("[API] Provider  : %s  Model: %s", request.provider, request.model)
    log.info("[API] Connection IDs: %s", request.connection_ids or request.connection_id)
    global db_manager

    try:
        # 1. Extract connection IDs
        selected_connection_ids = []
        if request.connection_ids:
            selected_connection_ids = request.connection_ids
        elif request.connection_id:
            selected_connection_ids = [cid.strip() for cid in request.connection_id.split(",") if cid.strip()]

        if not selected_connection_ids:
            log.info("[API] No connection specified – falling back to default.")
            default_conn = connection_manager.get_default_connection() if connection_manager else None
            if default_conn:
                selected_connection_ids = [default_conn.id]

        if not selected_connection_ids:
            log.error("[API] No database connection available – aborting.")
            raise HTTPException(status_code=500, detail="No database connected. Please select or add a database first.")

        log.info("[API] Querying %d database(s): %s", len(selected_connection_ids), selected_connection_ids)

        success_results = []
        query_details = []
        mql_details = []
        
        # 2. Query each database
        for conn_id in selected_connection_ids:
            conn = connection_manager.get_connection(conn_id)
            if not conn:
                continue
                
            db_type = conn.type
            db_url = connection_manager.format_connection_url(conn)
            
            try:
                # Initialize temporary manager for this connection
                if db_type == "mongodb":
                    from mongo_database import MongoDatabaseManager
                    temp_manager = MongoDatabaseManager(db_url)
                elif db_type == "snowflake":
                    from snowflake_database import SnowflakeDatabaseManager
                    temp_manager = SnowflakeDatabaseManager(db_url)
                elif db_type == "elasticsearch":
                    from elasticsearch_database import ElasticsearchDatabaseManager
                    temp_manager = ElasticsearchDatabaseManager(db_url)
                elif db_type == "neo4j":
                    from neo4j_database import Neo4jDatabaseManager
                    temp_manager = Neo4jDatabaseManager(db_url)
                else:
                    from database import DatabaseManager
                    temp_manager = DatabaseManager(db_url)
                    
                # Get schema
                log.info("[API] [%s] Fetching schema for connection '%s'...", db_type.upper(), conn.name)
                schema = temp_manager.get_schema()

                # Generate query
                log.info("[API] [%s] Sending question to LLM for query generation...", db_type.upper())
                generated_query = sql_agent.generate_query(
                    request.question,
                    schema,
                    db_type=db_type,
                    provider=request.provider,
                    model_name=request.model
                )
                log.info("[API] [%s] Generated query:\n%s", db_type.upper(), generated_query)

                if not generated_query.strip() or "NOT_APPLICABLE" in generated_query:
                    log.warning("[API] [%s] Query marked NOT_APPLICABLE or empty – skipping.", db_type.upper())
                    continue

                # Execute query
                log.info("[API] [%s] Executing generated query...", db_type.upper())
                headers, rows = temp_manager.execute_query(generated_query)
                log.info("[API] [%s] Execution returned %d row(s) with headers: %s", db_type.upper(), len(rows), headers)
                success_results.append((headers, rows, conn.name))
                
                if db_type == "mongodb":
                    mql_details.append(f"-- {conn.name} (MongoDB):\n{generated_query}")
                elif db_type == "elasticsearch":
                    mql_details.append(f"-- {conn.name} (Elasticsearch DSL):\n{generated_query}")
                elif db_type == "neo4j":
                    query_details.append(f"-- {conn.name} (Neo4j Cypher):\n{generated_query}")
                else:
                    query_details.append(f"-- {conn.name} ({db_type.upper()}):\n{generated_query}")
                    
            except Exception as e:
                log.error("[API] Error querying database '%s' (id=%s): %s", conn.name, conn_id, e, exc_info=True)
                continue

        if not success_results:
            log.error("[API] All %d database(s) failed or returned no valid results.", len(selected_connection_ids))
            raise HTTPException(status_code=500, detail="No query returned valid results from any of the selected databases.")

        log.info("[API] %d/%d database(s) returned results.", len(success_results), len(selected_connection_ids))

        # 3. Combine results using outer union logic
        all_headers = []
        seen_headers = set()
        for headers, rows, db_name in success_results:
            for h in headers:
                if h not in seen_headers:
                    seen_headers.add(h)
                    all_headers.append(h)
                    
        combined_headers = ["SOURCE_DATABASE"] + all_headers
        combined_rows = []
        for headers, rows, db_name in success_results:
            h_to_idx = {h: idx for idx, h in enumerate(headers)}
            for row in rows:
                combined_row = [db_name]
                for h in all_headers:
                    if h in h_to_idx:
                        combined_row.append(row[h_to_idx[h]])
                    else:
                        combined_row.append(None)
                combined_rows.append(combined_row)

        # Format query details into strings
        combined_sql = "\n\n".join(query_details) if query_details else None
        combined_mql = "\n\n".join(mql_details) if mql_details else None

        from datetime import datetime
        timestamp = datetime.now().strftime("%I:%M %p")
        
        # 4. Synthesize answer
        db_names_str = ", ".join([r[2] for r in success_results])
        content_msg = None
        if success_results:
            log.info("[API] Synthesising natural language answer...")
            content_msg = sql_agent.synthesize_answer(
                request.question,
                combined_headers,
                combined_rows,
                provider=request.provider,
                model_name=request.model
            )
        if not content_msg:
            content_msg = f"I've generated and executed queries across database(s): {db_names_str} to answer your question: '{request.question}'"

        # Determine primary db type
        primary_db_type = "postgresql"
        if selected_connection_ids:
            conn = connection_manager.get_connection(selected_connection_ids[0])
            if conn:
                primary_db_type = conn.type

        elapsed_total = time.perf_counter() - t_start
        log.info("[API] /ask completed in %.2fs – combined %d row(s) × %d col(s).",
                 elapsed_total, len(combined_rows), len(combined_headers))
        log.info("[API] ════ END /ask ════════════════════════════════════════")

        # Detect visualization intent
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
        elif "chart" in question_lower or "graph" in question_lower or "dashboard" in question_lower or "plot" in question_lower:
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
            "tableData": {
                "headers": combined_headers,
                "rows": combined_rows
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        log.error("[API] Unexpected error in /ask: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/dashboard-generate")
def generate_dashboard(request: QueryRequest):
    log.info("[API] POST /dashboard-generate connection_id='%s'", request.connection_id)
    
    if not sql_agent or not connection_manager:
        raise HTTPException(status_code=500, detail="Backend not fully initialized")
        
    conn_id = request.connection_id or (request.connection_ids[0] if request.connection_ids else None)
    if not conn_id:
        raise HTTPException(status_code=400, detail="No database connection specified")
        
    conn = connection_manager.get_connection(conn_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Database connection not found")
        
    db_url = connection_manager.format_connection_url(conn)
    db_type = conn.type
    
    try:
        if db_type == "mongodb":
            from mongo_database import MongoDatabaseManager
            temp_manager = MongoDatabaseManager(db_url)
        elif db_type == "snowflake":
            from snowflake_database import SnowflakeDatabaseManager
            temp_manager = SnowflakeDatabaseManager(db_url)
        elif db_type == "elasticsearch":
            from elasticsearch_database import ElasticsearchDatabaseManager
            temp_manager = ElasticsearchDatabaseManager(db_url)
        elif db_type == "neo4j":
            from neo4j_database import Neo4jDatabaseManager
            temp_manager = Neo4jDatabaseManager(db_url)
        else:
            from database import DatabaseManager
            temp_manager = DatabaseManager(db_url)
            
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
                        "tableData": {
                            "headers": headers,
                            "rows": rows
                        }
                    })
            except Exception as ex:
                log.warning("[API] Failed to execute dashboard query: %s\nError: %s", q["query"], ex)
                
        if not widgets:
            raise HTTPException(status_code=500, detail="All dashboard queries failed to return data.")
            
        return {"widgets": widgets}
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        log.error("[API] Error in /dashboard-generate: %s\n%s", e, traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/suggest")
def suggest_questions(request: SuggestionRequest):
    log.info("[API] POST /suggest  connection_id='%s'", request.connection_id)
    global db_manager
    current_db_manager = db_manager
    conn = None
    if request.connection_id:
        conn = connection_manager.get_connection(request.connection_id)
    elif request.database:
        conn = connection_manager.find_connection_by_name_or_type(request.database)

    if conn:
        db_url = connection_manager.format_connection_url(conn)
        log.debug("[API] /suggest using connection type='%s'", conn.type)
        if conn.type == "mongodb":
            from mongo_database import MongoDatabaseManager
            current_db_manager = MongoDatabaseManager(db_url)
        elif conn.type == "snowflake":
            from snowflake_database import SnowflakeDatabaseManager
            current_db_manager = SnowflakeDatabaseManager(db_url)
        elif conn.type == "elasticsearch":
            from elasticsearch_database import ElasticsearchDatabaseManager
            current_db_manager = ElasticsearchDatabaseManager(db_url)
        elif conn.type == "neo4j":
            from neo4j_database import Neo4jDatabaseManager
            current_db_manager = Neo4jDatabaseManager(db_url)
        else:
            from database import DatabaseManager
            current_db_manager = DatabaseManager(db_url)

    if not current_db_manager or not sql_agent:
        log.warning("[API] /suggest: db_manager or sql_agent not ready – returning empty list.")
        return []

    try:
        schema = current_db_manager.get_schema()
        history_text = ""
        # Use the last 6 messages for context; trim long AI responses to avoid noise
        for msg in request.history[-6:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "").strip()
            # Truncate very long assistant messages (likely raw data dumps) to 300 chars
            if role == "Assistant" and len(content) > 300:
                content = content[:300] + "..."
            if content:
                history_text += f"{role}: {content}\n"
        
        log.info("[API] /suggest history_text (first 500 chars): %s", history_text[:500])
        
        suggestions = sql_agent.generate_suggestions(
            history_text,
            schema,
            provider=request.provider,
            model_name=request.model
        )
        log.info("[API] /suggest returning %d suggestions.", len(suggestions))
        return suggestions
    except Exception as e:
        log.error("[API] /suggest error: %s", e, exc_info=True)
        return []

@app.post("/summarize")
def summarize_chat(request: dict):
    question = request.get("question")
    response_text = request.get("response")
    provider = request.get("provider", "gemini")
    model = request.get("model", "gemini-2.0-flash")
    log.info("[API] POST /summarize  provider='%s'", provider)

    if not question or not response_text or not sql_agent:
        log.warning("[API] /summarize: missing fields or sql_agent not ready.")
        return {"title": "New Chat"}

    try:
        title = sql_agent.summarize_conversation(question, response_text, provider, model)
        log.info("[API] /summarize title='%s'", title)
        return {"title": title}
    except Exception as e:
        log.error("[API] /summarize error: %s", e, exc_info=True)
        return {"title": question[:30] + "..." if len(question) > 30 else question}

@app.get("/health")
def health_check():
    log.debug("[API] GET /health")
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
