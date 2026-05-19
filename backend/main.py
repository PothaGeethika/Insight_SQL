from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from models import QueryRequest, ConnectionRequest, DatabaseConnection
from typing import List, Optional

class SuggestionRequest(BaseModel):
    history: List[dict] = []
    connection_id: Optional[str] = None
    database: Optional[str] = None
    provider: str = "gemini"
    model: str = "gemini-2.0-flash"

load_dotenv()

app = FastAPI(title="InsightSQL API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    
    from agent import SQLAgent
    from connection_manager import ConnectionManager
    
    # Initialize Connection Manager (Always needed)
    try:
        connection_manager = ConnectionManager()
    except Exception as e:
        print(f"Error initializing ConnectionManager: {e}")

    # Initialize SQL Agent (Always needed)
    try:
        sql_agent = SQLAgent()
    except Exception as e:
        print(f"Error initializing SQLAgent: {e}")
    
    # Initialize default db_manager if a default connection exists
    try:
        default_conn = connection_manager.get_default_connection() if connection_manager else None
        if default_conn:
            db_url = connection_manager.format_connection_url(default_conn)
            if default_conn.type == "mongodb":
                from mongo_database import MongoDatabaseManager
                db_manager = MongoDatabaseManager(db_url)
            else:
                from database import DatabaseManager
                db_manager = DatabaseManager(db_url)
        else:
            # Fallback to .env if no connections saved yet
            db_url = os.getenv("DATABASE_URL")
            if db_url:
                if "mongodb" in db_url:
                    from mongo_database import MongoDatabaseManager
                    db_manager = MongoDatabaseManager(db_url)
                else:
                    from database import DatabaseManager
                    db_manager = DatabaseManager(db_url)
    except Exception as e:
        print(f"Warning: Default database manager not initialized: {e}")

init_components()

@app.get("/databases")
def get_databases():
    return connection_manager.list_connections()

@app.post("/databases/test")
def test_database_connection(request: ConnectionRequest):
    try:
        from connection_manager import ConnectionManager
        cm = ConnectionManager()
        
        # Validate required fields for non-sqlite
        if request.type not in ["sqlite", "mongodb"] and (not request.host or not request.database):
            return {"status": "error", "message": "Host and Database name are required for this database type."}

        # Create a temporary connection object
        dummy_conn = DatabaseConnection(**request.dict())
        db_url = cm.format_connection_url(dummy_conn)
        
        if request.type == "mongodb":
            from pymongo import MongoClient
            client = MongoClient(db_url, serverSelectionTimeoutMS=5000)
            client.admin.command('ping')
            return {"status": "success", "message": "Connection successful! MongoDB is reachable."}
        else:
            # SQL connection test
            from sqlalchemy import create_engine, text
            from sqlalchemy.exc import OperationalError, ProgrammingError
            
            engine = create_engine(db_url, connect_args={'connect_timeout': 5})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return {"status": "success", "message": "Connection successful! Database is reachable."}
    
    except Exception as e:
        return {"status": "error", "message": f"Connection Failed: {str(e)}"}

@app.post("/databases")
def add_database(request: ConnectionRequest):
    try:
        conn = connection_manager.add_connection(request.dict())
        return conn
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/databases/{conn_id}")
def delete_database(conn_id: str):
    connection_manager.delete_connection(conn_id)
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
    print(f"Received question: {request.question} for connection: {request.connection_id}")
    global db_manager
    
    try:
        # 1. Extract connection IDs
        selected_connection_ids = []
        if request.connection_ids:
            selected_connection_ids = request.connection_ids
        elif request.connection_id:
            selected_connection_ids = [cid.strip() for cid in request.connection_id.split(",") if cid.strip()]
            
        if not selected_connection_ids:
            # Fallback to default if no connection specified
            default_conn = connection_manager.get_default_connection() if connection_manager else None
            if default_conn:
                selected_connection_ids = [default_conn.id]

        if not selected_connection_ids:
            raise HTTPException(status_code=500, detail="No database connected. Please select or add a database first.")

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
                else:
                    from database import DatabaseManager
                    temp_manager = DatabaseManager(db_url)
                    
                # Get schema
                schema = temp_manager.get_schema()
                
                # Generate query
                generated_query = sql_agent.generate_query(
                    request.question, 
                    schema, 
                    db_type=db_type,
                    provider=request.provider,
                    model_name=request.model
                )
                
                if not generated_query.strip() or "NOT_APPLICABLE" in generated_query:
                    continue
                    
                # Execute query
                headers, rows = temp_manager.execute_query(generated_query)
                success_results.append((headers, rows, conn.name))
                
                if db_type == "mongodb":
                    mql_details.append(f"-- {conn.name} (MongoDB):\n{generated_query}")
                else:
                    query_details.append(f"-- {conn.name} ({db_type.upper()}):\n{generated_query}")
                    
            except Exception as e:
                # Log error and continue to query other databases
                print(f"Error querying database {conn.name} ({conn_id}): {e}")
                continue

        if not success_results:
            raise HTTPException(status_code=500, detail="No query returned valid results from any of the selected databases.")

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
        
        # 4. Determine content message
        db_names_str = ", ".join([r[2] for r in success_results])
        content_msg = f"I've generated and executed queries across database(s): {db_names_str} to answer your question: '{request.question}'"

        return {
            "id": os.urandom(8).hex(),
            "role": "assistant",
            "content": content_msg,
            "sql": combined_sql,
            "mql": combined_mql,
            "timestamp": timestamp,
            "tableData": {
                "headers": combined_headers,
                "rows": combined_rows
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/suggest")
def suggest_questions(request: SuggestionRequest):
    global db_manager
    current_db_manager = db_manager
    conn = None
    if request.connection_id:
        conn = connection_manager.get_connection(request.connection_id)
    elif request.database:
        conn = connection_manager.find_connection_by_name_or_type(request.database)

    if conn:
        db_url = connection_manager.format_connection_url(conn)
        if conn.type == "mongodb":
            from mongo_database import MongoDatabaseManager
            current_db_manager = MongoDatabaseManager(db_url)
        else:
            from database import DatabaseManager
            current_db_manager = DatabaseManager(db_url)
    
    if not current_db_manager or not sql_agent:
        return [] # Silent fail for suggestions
    
    try:
        schema = current_db_manager.get_schema()
        # Format history for the prompt
        history_text = ""
        for msg in request.history[-5:]: # Last 5 messages for context
            role = "User" if msg.get("role") == "user" else "Assistant"
            content = msg.get("content", "")
            history_text += f"{role}: {content}\n"
            
        suggestions = sql_agent.generate_suggestions(
            history_text, 
            schema,
            provider=request.provider,
            model_name=request.model
        )
        return suggestions
    except Exception as e:
        print(f"Suggestion generation error: {e}")
        return []

@app.post("/summarize")
def summarize_chat(request: dict):
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
        print(f"Summarization error: {e}")
        return {"title": question[:30] + "..." if len(question) > 30 else question}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
