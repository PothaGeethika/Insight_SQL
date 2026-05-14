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
    provider: str = "gemini"
    model: str = "gemini-1.5-pro"

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
    try:
        from database import DatabaseManager
        from agent import SQLAgent
        from connection_manager import ConnectionManager
        
        connection_manager = ConnectionManager()
        sql_agent = SQLAgent()
        
        # Initialize default db_manager if a default connection exists
        default_conn = connection_manager.get_default_connection()
        if default_conn:
            db_url = connection_manager.format_sqlalchemy_url(default_conn)
            db_manager = DatabaseManager(db_url)
        else:
            # Fallback to .env if no connections saved yet
            try:
                db_url = os.getenv("DATABASE_URL")
                if db_url:
                    db_manager = DatabaseManager(db_url)
            except:
                pass
    except Exception as e:
        print(f"Warning: Backend components not fully initialized: {e}")

init_components()

@app.get("/databases")
async def get_databases():
    return connection_manager.list_connections()

@app.post("/databases/test")
async def test_database_connection(request: ConnectionRequest):
    try:
        from database import DatabaseManager
        from connection_manager import ConnectionManager
        cm = ConnectionManager()
        
        # Validate required fields for non-sqlite
        if request.type != "sqlite" and (not request.host or not request.database):
            return {"status": "error", "message": "Host and Database name are required for this database type."}

        # Create a temporary connection object
        dummy_conn = DatabaseConnection(**request.dict())
        db_url = cm.format_sqlalchemy_url(dummy_conn)
        
        # Try to connect
        from sqlalchemy import create_engine, text
        from sqlalchemy.exc import OperationalError, ProgrammingError
        
        engine = create_engine(db_url, connect_args={'connect_timeout': 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "success", "message": "Connection successful! Database is reachable."}
    
    except OperationalError as e:
        error_str = str(e.orig) if hasattr(e, 'orig') else str(e)
        return {"status": "error", "message": f"Connection Failed: {error_str}"}
    except ProgrammingError as e:
        error_str = str(e.orig) if hasattr(e, 'orig') else str(e)
        return {"status": "error", "message": f"Configuration Error: {error_str}"}
    except Exception as e:
        return {"status": "error", "message": f"Unexpected Error: {str(e)}"}

@app.post("/databases")
async def add_database(request: ConnectionRequest):
    try:
        conn = connection_manager.add_connection(request.dict())
        return conn
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/databases/{conn_id}")
async def delete_database(conn_id: str):
    connection_manager.delete_connection(conn_id)
    return {"status": "deleted"}

@app.put("/databases/{conn_id}")
async def update_database(conn_id: str, request: ConnectionRequest):
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
async def set_default_database(conn_id: str):
    try:
        connections = connection_manager._load()
        for c in connections:
            if c['id'] == conn_id:
                # Toggle the current one
                c['is_default'] = not c.get('is_default', False)
            else:
                # Ensure all others are false if we turned one ON
                # But if we turned one OFF, others should stay false
                pass
        
        # If we just turned one ON, we MUST turn all others OFF
        current_status = next((c.get('is_default', False) for c in connections if c['id'] == conn_id), False)
        if current_status:
            for c in connections:
                if c['id'] != conn_id:
                    c['is_default'] = False
                    
        connection_manager._save(connections)
        return {"status": "success", "is_default": current_status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/ask")
async def ask_question(request: QueryRequest):
    print(f"Received question: {request.question} for connection: {request.connection_id}")
    global db_manager
    
    # 0. Set up database connection
    current_db_manager = db_manager
    if request.connection_id:
        conn = connection_manager.get_connection(request.connection_id)
        if conn:
            from database import DatabaseManager
            db_url = connection_manager.format_sqlalchemy_url(conn)
            current_db_manager = DatabaseManager(db_url)
    
    if not current_db_manager or not sql_agent:
        if not sql_agent:
            raise HTTPException(status_code=500, detail="SQL Agent not initialized. Check your AI API keys.")
        raise HTTPException(status_code=500, detail="No database connected. Please add a database first.")
    
    try:
        # 1. Get Schema
        try:
            schema = current_db_manager.get_schema()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database connection error: {str(e)}")
        
        # 2. Generate SQL with selected provider
        try:
            sql_query = sql_agent.generate_sql(
                request.question, 
                schema, 
                provider=request.provider,
                model_name=request.model
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM generation error ({request.provider}): {str(e)}")
        
        # 3. Execute Query
        try:
            headers, rows = current_db_manager.execute_query(sql_query)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"SQL execution error: {str(e)}\nGenerated SQL: {sql_query}")
        
        # 4. Format response
        from datetime import datetime
        timestamp = datetime.now().strftime("%I:%M %p")
        
        return {
            "id": os.urandom(8).hex(),
            "role": "assistant",
            "content": f"I've generated and executed a query to answer your question: '{request.question}'",
            "sql": sql_query,
            "timestamp": timestamp,
            "tableData": {
                "headers": headers,
                "rows": rows
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/suggest")
async def suggest_questions(request: SuggestionRequest):
    global db_manager
    current_db_manager = db_manager
    if request.connection_id:
        conn = connection_manager.get_connection(request.connection_id)
        if conn:
            from database import DatabaseManager
            db_url = connection_manager.format_sqlalchemy_url(conn)
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
async def summarize_chat(request: dict):
    question = request.get("question")
    response_text = request.get("response")
    provider = request.get("provider", "gemini")
    model = request.get("model", "gemini-1.5-pro")
    
    if not question or not response_text or not sql_agent:
        return {"title": "New Chat"}
    
    try:
        title = sql_agent.summarize_conversation(question, response_text, provider, model)
        return {"title": title}
    except Exception as e:
        print(f"Summarization error: {e}")
        return {"title": question[:30] + "..." if len(question) > 30 else question}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
