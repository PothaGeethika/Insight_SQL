import base64
import json
import os
import uuid
import urllib.parse
from typing import List, Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from models import DatabaseConnection
from logger_config import get_logger
from config import _require_env, JWT_SECRET

log = get_logger("connection_manager")

# Fields that must never appear as plaintext in connections.json
_SECRET_FIELDS = ("password", "api_key", "custom_url")
_ENC_PREFIX = "enc:v1:"


def _fernet() -> Fernet:
    """
    Build a Fernet cipher.

    Prefer CONNECTIONS_ENCRYPTION_KEY (url-safe base64 Fernet key from
    ``Fernet.generate_key()``). If unset, derive a stable key from JWT_SECRET
    via HKDF so existing installs work without a new required env var.
    """
    raw = os.getenv("CONNECTIONS_ENCRYPTION_KEY", "").strip()
    if raw:
        key = raw.encode("utf-8") if isinstance(raw, str) else raw
        try:
            return Fernet(key)
        except Exception as exc:
            raise RuntimeError(
                "CONNECTIONS_ENCRYPTION_KEY must be a Fernet key "
                "(python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")."
            ) from exc

    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"insightsql-connections-v1",
        info=b"connections-at-rest",
    ).derive(JWT_SECRET.encode("utf-8"))
    return Fernet(base64.urlsafe_b64encode(derived))


def _is_encrypted_value(value: object) -> bool:
    return isinstance(value, str) and value.startswith(_ENC_PREFIX)


def _encrypt_value(value: str) -> str:
    token = _fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{_ENC_PREFIX}{token}"


def _decrypt_value(value: str) -> str:
    if not _is_encrypted_value(value):
        return value
    token = value[len(_ENC_PREFIX) :].encode("utf-8")
    return _fernet().decrypt(token).decode("utf-8")


def _has_plaintext_secrets(record: dict) -> bool:
    for field in _SECRET_FIELDS:
        val = record.get(field)
        if isinstance(val, str) and val and not _is_encrypted_value(val):
            return True
    return False


def _encrypt_record(record: dict) -> dict:
    out = dict(record)
    for field in _SECRET_FIELDS:
        val = out.get(field)
        if isinstance(val, str) and val and not _is_encrypted_value(val):
            out[field] = _encrypt_value(val)
    return out


def _decrypt_record(record: dict) -> dict:
    out = dict(record)
    for field in _SECRET_FIELDS:
        val = out.get(field)
        if isinstance(val, str) and val:
            try:
                out[field] = _decrypt_value(val)
            except InvalidToken:
                log.error(
                    "[CONN_MGR] Failed to decrypt field '%s' for connection id=%s – "
                    "check CONNECTIONS_ENCRYPTION_KEY / JWT_SECRET.",
                    field,
                    record.get("id"),
                )
                raise
    return out


class ConnectionManager:
    def __init__(self, storage_path=None):
        if storage_path is None:
            storage_path = _require_env("CONNECTIONS_STORAGE_PATH")
        self.storage_path = storage_path
        log.info("[CONN_MGR] Initialising ConnectionManager – storage='%s'", storage_path)
        if not os.path.exists(self.storage_path):
            log.info("[CONN_MGR] Storage file not found – creating empty connections file.")
            with open(self.storage_path, "w") as f:
                json.dump([], f)
        # Migrate any plaintext secrets on startup
        self._load()
        log.debug("[CONN_MGR] ConnectionManager ready.")

    def _load(self) -> List[dict]:
        log.debug("[CONN_MGR] Loading connections from disk.")
        with open(self.storage_path, "r") as f:
            data = json.load(f)
        if not isinstance(data, list):
            data = []

        migrated = False
        out: List[dict] = []
        for record in data:
            if _has_plaintext_secrets(record):
                out.append(_encrypt_record(record))
                migrated = True
            else:
                out.append(record)

        if migrated:
            log.info(
                "[CONN_MGR] Migrated plaintext connection secrets → encrypted at rest (%d record(s)).",
                len(out),
            )
            self._save(out)

        log.debug("[CONN_MGR] Loaded %d connection(s).", len(out))
        return out

    def _save(self, connections: List[dict]):
        log.debug("[CONN_MGR] Saving %d connection(s) to disk.", len(connections))
        with open(self.storage_path, "w") as f:
            json.dump(connections, f, indent=4)
        log.debug("[CONN_MGR] Save complete.")

    def list_connections(self) -> List[DatabaseConnection]:
        raw = self._load()
        conns = [DatabaseConnection(**_decrypt_record(c)) for c in raw]
        log.info("[CONN_MGR] list_connections → %d connection(s) found.", len(conns))
        return conns

    def add_connection(self, conn_data: dict) -> DatabaseConnection:
        connections = self._load()
        conn_data["id"] = str(uuid.uuid4())
        log.info(
            "[CONN_MGR] Adding new connection: name='%s'  type='%s'  id=%s",
            conn_data.get("name"),
            conn_data.get("type"),
            conn_data["id"],
        )

        if not connections:
            conn_data["is_default"] = True
            log.info("[CONN_MGR] First connection – marking as default.")

        connections.append(_encrypt_record(conn_data))
        self._save(connections)
        log.info("[CONN_MGR] Connection saved successfully (credentials encrypted).")
        return DatabaseConnection(**conn_data)

    def get_connection(self, conn_id: str) -> Optional[DatabaseConnection]:
        log.debug("[CONN_MGR] get_connection id='%s'", conn_id)
        for c in self._load():
            if c["id"] == conn_id:
                decrypted = _decrypt_record(c)
                log.debug(
                    "[CONN_MGR] Found connection: name='%s'  type='%s'",
                    c.get("name"),
                    c.get("type"),
                )
                return DatabaseConnection(**decrypted)
        log.warning("[CONN_MGR] Connection id='%s' not found!", conn_id)
        return None

    def get_default_connection(self) -> Optional[DatabaseConnection]:
        log.debug("[CONN_MGR] Looking for default connection.")
        for c in self._load():
            if c.get("is_default"):
                decrypted = _decrypt_record(c)
                log.info(
                    "[CONN_MGR] Default connection: name='%s'  type='%s'",
                    c.get("name"),
                    c.get("type"),
                )
                return DatabaseConnection(**decrypted)
        log.warning("[CONN_MGR] No default connection is configured.")
        return None

    def find_connection_by_name_or_type(self, identifier: str) -> Optional[DatabaseConnection]:
        log.debug("[CONN_MGR] find_connection_by_name_or_type identifier='%s'", identifier)
        raw = self._load()
        for c in raw:
            if c.get("name") == identifier:
                return DatabaseConnection(**_decrypt_record(c))
        for c in raw:
            if c.get("type") == identifier:
                return DatabaseConnection(**_decrypt_record(c))
        log.warning("[CONN_MGR] No connection matched identifier='%s'", identifier)
        return None

    def delete_connection(self, conn_id: str):
        log.info("[CONN_MGR] Deleting connection id='%s'", conn_id)
        connections = self._load()
        before = len(connections)
        connections = [c for c in connections if c["id"] != conn_id]
        self._save(connections)
        log.info(
            "[CONN_MGR] Deleted %d connection(s). Remaining: %d",
            before - len(connections),
            len(connections),
        )

    def update_connection(self, conn_id: str, new_data: dict) -> Optional[DatabaseConnection]:
        connections = self._load()
        for i, c in enumerate(connections):
            if c["id"] == conn_id:
                new_data["id"] = conn_id
                new_data["is_default"] = c.get("is_default", False)
                # Preserve ownership / workspace fields unless explicitly provided
                if new_data.get("user_id") is None and c.get("user_id") is not None:
                    new_data["user_id"] = c.get("user_id")
                if new_data.get("org_id") is None and c.get("org_id") is not None:
                    new_data["org_id"] = c.get("org_id")
                # If caller omitted a secret, keep the existing (encrypted) value
                existing = _decrypt_record(c)
                structured_update = self._can_build_structured_url(DatabaseConnection(**new_data))
                for field in _SECRET_FIELDS:
                    if field == "custom_url" and structured_update and not new_data.get("custom_url"):
                        # Params-mode save: drop stale connection string.
                        new_data[field] = None
                        continue
                    if not new_data.get(field) and existing.get(field):
                        new_data[field] = existing.get(field)
                connections[i] = _encrypt_record(new_data)
                self._save(connections)
                log.info("[CONN_MGR] Updated connection id='%s'", conn_id)
                return DatabaseConnection(**new_data)
        return None

    @staticmethod
    def _can_build_structured_url(conn: DatabaseConnection) -> bool:
        """True when host/account fields are enough to build a URL (UI param mode)."""
        db_type = (conn.type or "").lower()
        if db_type == "sqlite":
            return bool(conn.database)
        if db_type == "snowflake":
            return bool(conn.account and conn.database)
        if db_type == "neo4j":
            return bool(conn.host)
        if db_type in ("mongodb", "elasticsearch", "postgresql", "mysql", "mariadb",
                       "supabase", "redshift", "oracle", "sqlserver", "clickhouse", "redis"):
            return bool(conn.host and conn.database)
        return bool(conn.host or conn.database)

    def format_connection_url(self, conn: DatabaseConnection) -> str:
        log.debug(
            "[CONN_MGR] Formatting connection URL for type='%s'  name='%s'",
            conn.type,
            conn.name,
        )
        # Prefer structured fields when present — stale custom_url must not override
        # edits made via host/database form fields (common after DB rename).
        if conn.custom_url and not self._can_build_structured_url(conn):
            log.debug("[CONN_MGR] Using custom_url directly.")
            return conn.custom_url

        user = urllib.parse.quote_plus(conn.username) if conn.username else ""
        password = urllib.parse.quote_plus(conn.password) if conn.password else ""

        if conn.type == "sqlite":
            url = f"sqlite:///{conn.database}"
        elif conn.type in ["postgresql", "supabase", "redshift"]:
            url = f"postgresql://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type in ["mysql", "mariadb"]:
            url = f"mysql+pymysql://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "oracle":
            url = f"oracle+cx_oracle://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "sqlserver":
            url = f"mssql+pyodbc://{user}:{password}@{conn.host}:{conn.port}/{conn.database}?driver=ODBC+Driver+17+for+SQL+Server"
        elif conn.type == "redis":
            url = f"redis://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
        elif conn.type == "clickhouse":
            url = f"clickhouse+native://{user}:{password}@{conn.host}:{conn.port}/{conn.database}"
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
            host_part = conn.host or _require_env("DB_DEFAULT_HOST")
            port_part = f":{conn.port}" if conn.port else ""
            if user and password:
                url = f"{scheme}://{user}:{password}@{host_part}{port_part}"
            else:
                url = f"{scheme}://{host_part}{port_part}"
        else:
            # Fallback for any other custom SQL databases
            host_part = conn.host or _require_env("DB_DEFAULT_HOST")
            port_part = f":{conn.port}" if conn.port else ""
            db_part = f"/{conn.database}" if conn.database else ""
            if user and password:
                url = f"{conn.type}://{user}:{password}@{host_part}{port_part}{db_part}"
            else:
                url = f"{conn.type}://{host_part}{port_part}{db_part}"

        safe_url = url.replace(urllib.parse.quote_plus(conn.password), "****") if conn.password else url
        log.debug("[CONN_MGR] Built URL: %s", safe_url)
        return url
