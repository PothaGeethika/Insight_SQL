from pydantic import BaseModel
from typing import Optional, List

class DatabaseConnection(BaseModel):
    id: Optional[str] = None
    name: str
    type: str  # postgresql, mysql, sqlite, etc.
    host: Optional[str] = None
    port: Optional[int] = None
    database: str
    username: Optional[str] = None
    password: Optional[str] = None
    status: str = "disconnected"
    is_default: bool = False

class ConnectionRequest(BaseModel):
    name: str
    type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: str
    username: Optional[str] = None
    password: Optional[str] = None

class QueryRequest(BaseModel):
    question: str
    provider: str = "gemini"
    model: Optional[str] = None
    connection_id: Optional[str] = None
    database: Optional[str] = None # New field for easy switching
