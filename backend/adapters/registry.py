from __future__ import annotations

from adapters.base import DatabaseAdapter, CapabilityFlags, AdapterNotImplementedError
from adapters.factory import AdapterFactory
from connection_manager import ConnectionManager


class _ManagerAdapter(DatabaseAdapter):
    manager_cls = None

    def __init__(self, conn):
        cm = ConnectionManager()
        self.conn = conn
        self.db_type = conn.type
        self.manager = self.manager_cls(cm.format_connection_url(conn))

    def execute_read(self, query: str):
        return self.manager.execute_query(query, enforce_readonly=False) if hasattr(self.manager, "execute_query") else ([], [])

    def execute_write(self, query: str):
        return self.execute_read(query)

    def get_schema(self) -> str:
        return self.manager.get_schema()

    def get_schema_structured(self) -> dict:
        if hasattr(self.manager, "get_schema_structured"):
            return self.manager.get_schema_structured()
        return {"dialect": self.db_type}

    def capabilities(self) -> CapabilityFlags:
        return CapabilityFlags(transactions=True, rollback=True, list_schema=True)


class SQLAdapter(_ManagerAdapter):
    def __init__(self, conn):
        from database import DatabaseManager
        self.manager_cls = DatabaseManager
        super().__init__(conn)


class MongoAdapter(_ManagerAdapter):
    def __init__(self, conn):
        from mongo_database import MongoDatabaseManager
        self.manager_cls = MongoDatabaseManager
        super().__init__(conn)


class Neo4jAdapter(_ManagerAdapter):
    def __init__(self, conn):
        from neo4j_database import Neo4jDatabaseManager
        self.manager_cls = Neo4jDatabaseManager
        super().__init__(conn)


class ElasticsearchAdapter(_ManagerAdapter):
    def __init__(self, conn):
        from elasticsearch_database import ElasticsearchDatabaseManager
        self.manager_cls = ElasticsearchDatabaseManager
        super().__init__(conn)


class SnowflakeAdapter(_ManagerAdapter):
    def __init__(self, conn):
        from snowflake_database import SnowflakeDatabaseManager
        self.manager_cls = SnowflakeDatabaseManager
        super().__init__(conn)


class StubAdapter(DatabaseAdapter):
    def __init__(self, conn):
        self.conn = conn
        self.db_type = conn.type

    def _raise(self):
        raise AdapterNotImplementedError(f"Adapter not implemented for db_type='{self.db_type}'")

    def execute_read(self, query: str):
        self._raise()

    def execute_write(self, query: str):
        self._raise()

    def get_schema(self) -> str:
        self._raise()

    def get_schema_structured(self) -> dict:
        self._raise()

    def capabilities(self) -> CapabilityFlags:
        return CapabilityFlags(transactions=False, rollback=False, list_schema=False)


def register_adapters() -> None:
    for key in ("postgresql", "mysql", "mariadb", "sqlite", "supabase"):
        AdapterFactory.register(key, SQLAdapter)
    AdapterFactory.register("mongodb", MongoAdapter)
    AdapterFactory.register("neo4j", Neo4jAdapter)
    AdapterFactory.register("elasticsearch", ElasticsearchAdapter)
    AdapterFactory.register("snowflake", SnowflakeAdapter)

    stub_types = (
        "sqlserver", "oracle", "db2", "cockroachdb", "redshift", "bigquery", "clickhouse",
        "couchdb", "firestore", "neptune", "cassandra", "hbase", "scylla", "redis",
        "dynamodb", "opensearch", "planetscale", "tidb", "influxdb", "databricks", "pinecone", "other",
    )
    for key in stub_types:
        AdapterFactory.register(key, StubAdapter)


register_adapters()
