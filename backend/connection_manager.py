import json
import os
import uuid
from typing import List, Optional
from models import DatabaseConnection

class ConnectionManager:
    def __init__(self, storage_path="connections.json"):
        self.storage_path = storage_path
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, 'w') as f:
                json.dump([], f)

    def _load(self) -> List[dict]:
        with open(self.storage_path, 'r') as f:
            return json.load(f)

    def _save(self, connections: List[dict]):
        with open(self.storage_path, 'w') as f:
            json.dump(connections, f, indent=4)

    def list_connections(self) -> List[DatabaseConnection]:
        return [DatabaseConnection(**c) for c in self._load()]

    def add_connection(self, conn_data: dict) -> DatabaseConnection:
        connections = self._load()
        conn_data['id'] = str(uuid.uuid4())
        
        # If it's the first connection, make it default
        if not connections:
            conn_data['is_default'] = True
        
        connections.append(conn_data)
        self._save(connections)
        return DatabaseConnection(**conn_data)

    def get_connection(self, conn_id: str) -> Optional[DatabaseConnection]:
        connections = self._load()
        for c in connections:
            if c['id'] == conn_id:
                return DatabaseConnection(**c)
        return None

    def get_default_connection(self) -> Optional[DatabaseConnection]:
        connections = self._load()
        for c in connections:
            if c.get('is_default'):
                return DatabaseConnection(**c)
        return None

    def delete_connection(self, conn_id: str):
        connections = self._load()
        connections = [c for c in connections if c['id'] != conn_id]
        self._save(connections)

    def format_sqlalchemy_url(self, conn: DatabaseConnection) -> str:
        import urllib.parse
        user = urllib.parse.quote_plus(conn.username) if conn.username else ""
        password = urllib.parse.quote_plus(conn.password) if conn.password else ""
        
        if conn.type == "sqlite":
            return f"sqlite:///{conn.database}"
        elif conn.type == "postgresql":
            return f"postgresql://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "mysql":
            return f"mysql+pymysql://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        else:
            raise ValueError(f"Unsupported database type: {conn.type}")
