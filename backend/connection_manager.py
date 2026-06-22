import base64
import json
import os
import uuid
from typing import List, Optional
from models import DatabaseConnection
from logger_config import get_logger
import urllib.parse

log = get_logger("connection_manager")

# ---------------------------------------------------------------------------
# Encryption disabled per user request
# ---------------------------------------------------------------------------

def _encrypt_record(record: dict) -> dict:
    return dict(record)

def _decrypt_record(record: dict) -> dict:
    return dict(record)


# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self, storage_path="connections.json"):
        self.storage_path = storage_path
        log.info("[CONN_MGR] Initialising ConnectionManager – storage='%s'", storage_path)
        if not os.path.exists(self.storage_path):
            log.info("[CONN_MGR] Storage file not found – creating empty connections file.")
            with open(self.storage_path, 'w') as f:
                json.dump([], f)
        log.debug("[CONN_MGR] ConnectionManager ready.")

    def _load(self) -> List[dict]:
        log.debug("[CONN_MGR] Loading connections from disk.")
        with open(self.storage_path, 'r') as f:
            data = json.load(f)
        log.debug("[CONN_MGR] Loaded %d connection(s).", len(data))
        return data

    def _save(self, connections: List[dict]):
        log.debug("[CONN_MGR] Saving %d connection(s) to disk.", len(connections))
        with open(self.storage_path, 'w') as f:
            json.dump(connections, f, indent=4)
        log.debug("[CONN_MGR] Save complete.")

    def list_connections(self) -> List[DatabaseConnection]:
        raw = self._load()
        conns = [DatabaseConnection(**_decrypt_record(c)) for c in raw]
        log.info("[CONN_MGR] list_connections → %d connection(s) found.", len(conns))
        return conns

    def add_connection(self, conn_data: dict) -> DatabaseConnection:
        connections = self._load()
        conn_data['id'] = str(uuid.uuid4())
        log.info("[CONN_MGR] Adding new connection: name='%s'  type='%s'  id=%s",
                 conn_data.get('name'), conn_data.get('type'), conn_data['id'])

        if not connections:
            conn_data['is_default'] = True
            log.info("[CONN_MGR] First connection – marking as default.")

        connections.append(_encrypt_record(conn_data))
        self._save(connections)
        log.info("[CONN_MGR] Connection saved successfully (credentials encrypted).")
        return DatabaseConnection(**conn_data)

    def get_connection(self, conn_id: str) -> Optional[DatabaseConnection]:
        log.debug("[CONN_MGR] get_connection id='%s'", conn_id)
        for c in self._load():
            if c['id'] == conn_id:
                decrypted = _decrypt_record(c)
                log.debug("[CONN_MGR] Found connection: name='%s'  type='%s'", c.get('name'), c.get('type'))
                return DatabaseConnection(**decrypted)
        log.warning("[CONN_MGR] Connection id='%s' not found!", conn_id)
        return None

    def get_default_connection(self) -> Optional[DatabaseConnection]:
        log.debug("[CONN_MGR] Looking for default connection.")
        for c in self._load():
            if c.get('is_default'):
                decrypted = _decrypt_record(c)
                log.info("[CONN_MGR] Default connection: name='%s'  type='%s'", c.get('name'), c.get('type'))
                return DatabaseConnection(**decrypted)
        log.warning("[CONN_MGR] No default connection is configured.")
        return None

    def find_connection_by_name_or_type(self, identifier: str) -> Optional[DatabaseConnection]:
        log.debug("[CONN_MGR] find_connection_by_name_or_type identifier='%s'", identifier)
        raw = self._load()
        for c in raw:
            if c.get('name') == identifier:
                return DatabaseConnection(**_decrypt_record(c))
        for c in raw:
            if c.get('type') == identifier:
                return DatabaseConnection(**_decrypt_record(c))
        log.warning("[CONN_MGR] No connection matched identifier='%s'", identifier)
        return None

    def delete_connection(self, conn_id: str):
        log.info("[CONN_MGR] Deleting connection id='%s'", conn_id)
        connections = self._load()
        before = len(connections)
        connections = [c for c in connections if c['id'] != conn_id]
        self._save(connections)
        log.info("[CONN_MGR] Deleted %d connection(s). Remaining: %d", before - len(connections), len(connections))

    def update_connection(self, conn_id: str, new_data: dict) -> Optional[DatabaseConnection]:
        connections = self._load()
        for i, c in enumerate(connections):
            if c['id'] == conn_id:
                new_data['id'] = conn_id
                new_data['is_default'] = c.get('is_default', False)
                connections[i] = _encrypt_record(new_data)
                self._save(connections)
                log.info("[CONN_MGR] Updated connection id='%s'", conn_id)
                return DatabaseConnection(**new_data)
        return None

    def format_connection_url(self, conn: DatabaseConnection) -> str:
        log.debug("[CONN_MGR] Formatting connection URL for type='%s'  name='%s'", conn.type, conn.name)
        user = urllib.parse.quote_plus(conn.username) if conn.username else ""
        password = urllib.parse.quote_plus(conn.password) if conn.password else ""

        if conn.type == "sqlite":
            url = f"sqlite:///{conn.database}"
        elif conn.type == "postgresql":
            url = f"postgresql://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "mysql":
            url = f"mysql+pymysql://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "mongodb":
            if user and password:
                url = f"mongodb://{user}:{password}@{conn.host}:{conn.port}/{conn.database}?authSource=admin"
            else:
                url = f"mongodb://{conn.host}:{conn.port}/{conn.database}"
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
        elif conn.type == "neo4j":
            scheme = "neo4j+s" if conn.host and "databases.neo4j.io" in conn.host else "neo4j"
            host_part = conn.host or "localhost"
            port_part = f":{conn.port}" if conn.port else ""
            if user and password:
                url = f"{scheme}://{user}:{password}@{host_part}{port_part}"
            else:
                url = f"{scheme}://{host_part}{port_part}"
        else:
            log.error("[CONN_MGR] Unsupported database type: '%s'", conn.type)
            raise ValueError(f"Unsupported database type: {conn.type}")

        safe_url = url.replace(urllib.parse.quote_plus(conn.password), "****") if conn.password else url
        log.debug("[CONN_MGR] Built URL: %s", safe_url)
        return url
