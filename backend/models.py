from pydantic import BaseModel
from typing import Optional, List, Any

class DatabaseConnection(BaseModel):
    id: Optional[str] = None
    name: str
    type: str  # postgresql, mysql, sqlite, mongodb, snowflake, etc.
    host: Optional[str] = None
    port: Optional[int] = None
    database: str
    username: Optional[str] = None
    password: Optional[str] = None
    status: str = "disconnected"
    is_default: bool = False
    user_id: Optional[str] = None  # owner – used for multi-user isolation
    # Snowflake-specific fields
    account: Optional[str] = None
    warehouse: Optional[str] = None
    schema_name: Optional[str] = None
    role: Optional[str] = None
    # Elasticsearch-specific fields
    api_key: Optional[str] = None
    cloud_id: Optional[str] = None
    custom_url: Optional[str] = None

class ConnectionRequest(BaseModel):
    name: str
    type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database: str
    username: Optional[str] = None
    password: Optional[str] = None
    # Snowflake-specific fields
    account: Optional[str] = None
    warehouse: Optional[str] = None
    schema_name: Optional[str] = None
    role: Optional[str] = None
    # Elasticsearch-specific fields
    api_key: Optional[str] = None
    cloud_id: Optional[str] = None
    custom_url: Optional[str] = None

class QueryRequest(BaseModel):
    question: str
    provider: str = "gemini"
    model: Optional[str] = None
    connection_id: Optional[str] = None
    connection_ids: Optional[List[str]] = None
    database: Optional[str] = None # New field for easy switching

class ExplainRequest(BaseModel):
    query: str
    connection_id: Optional[str] = None

class OptimizeRequest(BaseModel):
    query: str
    explain_json: Any
    connection_id: Optional[str] = None
    provider: str = "gemini"
    model: Optional[str] = None
