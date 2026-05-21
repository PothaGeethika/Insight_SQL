import json
import os
import uuid
from typing import List, Optional
from models import DatabaseConnection
import urllib.parse

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

    def find_connection_by_name_or_type(self, identifier: str) -> Optional[DatabaseConnection]:
        connections = self._load()
        # First try exact name match
        for c in connections:
            if c.get('name') == identifier:
                return DatabaseConnection(**c)
        # Then try type match
        for c in connections:
            if c.get('type') == identifier:
                return DatabaseConnection(**c)
        return None

    def delete_connection(self, conn_id: str):
        connections = self._load()
        connections = [c for c in connections if c['id'] != conn_id]
        self._save(connections)

    def format_connection_url(self, conn: DatabaseConnection) -> str:
        user = urllib.parse.quote_plus(conn.username) if conn.username else ""
        password = urllib.parse.quote_plus(conn.password) if conn.password else ""
        
        if conn.type == "sqlite":
            return f"sqlite:///{conn.database}"
        elif conn.type == "postgresql":
            return f"postgresql://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "mysql":
            return f"mysql+pymysql://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "mongodb":
            if user and password:
                return f"mongodb://{user}:{password}@{conn.host}:{conn.port}/{conn.database}?authSource=admin"
            return f"mongodb://{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "snowflake":
            schema = conn.schema_name or "PUBLIC"
            url = f"snowflake://{user}:{password}@{conn.account}/{conn.database}/{schema}"
            params = []
            if conn.warehouse:
                params.append(f"warehouse={conn.warehouse}")
            if conn.role:
                params.append(f"role={conn.role}")
            if params:
                url += "?" + "&".join(params)
            return url
        elif conn.type == "elasticsearch":
            params = []
            if conn.api_key:
                params.append(f"api_key={conn.api_key}")
            if conn.cloud_id:
                params.append(f"cloud_id={conn.cloud_id}")
            
            host_part = conn.host or ""
            port_part = f":{conn.port}" if conn.port else ""
            
            if user and password:
                url = f"elasticsearch://{user}:{password}@{host_part}{port_part}/{conn.database}"
            else:
                url = f"elasticsearch://{host_part}{port_part}/{conn.database}"
                
            if params:
                url += "?" + "&".join(params)
            return url
        elif conn.type == "neo4j":
            scheme = "neo4j+s" if conn.host and "databases.neo4j.io" in conn.host else "neo4j"
            host_part = conn.host or "localhost"
            port_part = f":{conn.port}" if conn.port else ""
            if user and password:
                return f"{scheme}://{user}:{password}@{host_part}{port_part}"
            return f"{scheme}://{host_part}{port_part}"
        else:
            raise ValueError(f"Unsupported database type: {conn.type}")

