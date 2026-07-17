import os
import time
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from logger_config import get_logger
from sql_validator import validate_readonly_sql

load_dotenv()
log = get_logger("database")


def _engine_kwargs(database_url: str, connect_timeout: int = None, pool_size: int = None):
    """Build create_engine kwargs with connect timeout + optional pool settings."""
    timeout = connect_timeout
    if timeout is None:
        try:
            from config import DB_CONNECT_TIMEOUT
            timeout = DB_CONNECT_TIMEOUT
        except Exception:
            timeout = 10
    pool = pool_size
    if pool is None:
        try:
            from config import DB_POOL_SIZE
            pool = DB_POOL_SIZE
        except Exception:
            pool = 5
    try:
        from config import DB_POOL_MAX_OVERFLOW
        max_overflow = DB_POOL_MAX_OVERFLOW
    except Exception:
        max_overflow = 10

    kwargs: dict = {}
    url_lower = (database_url or "").lower()

    if url_lower.startswith("sqlite"):
        kwargs["connect_args"] = {"timeout": timeout}
        kwargs["pool_pre_ping"] = True
    elif "postgresql" in url_lower or url_lower.startswith("redshift") or "psycopg" in url_lower:
        kwargs["connect_args"] = {"connect_timeout": timeout}
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = pool
        kwargs["max_overflow"] = max_overflow
    elif "mysql" in url_lower or "mariadb" in url_lower:
        kwargs["connect_args"] = {"connect_timeout": timeout}
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = pool
        kwargs["max_overflow"] = max_overflow
    elif "oracle" in url_lower:
        kwargs["connect_args"] = {"tcp_connect_timeout": timeout}
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = pool
        kwargs["max_overflow"] = max_overflow
    elif "mssql" in url_lower or "sqlserver" in url_lower:
        # pyodbc uses LoginTimeout via connect string; also pass as connect_args when supported
        kwargs["connect_args"] = {"timeout": timeout}
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = pool
        kwargs["max_overflow"] = max_overflow
    elif "clickhouse" in url_lower:
        kwargs["connect_args"] = {"connect_timeout": timeout}
        kwargs["pool_pre_ping"] = True
    elif "bigquery" in url_lower:
        kwargs["pool_pre_ping"] = True
    else:
        kwargs["connect_args"] = {"connect_timeout": timeout}
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = pool
        kwargs["max_overflow"] = max_overflow
    return kwargs


def _format_tables_text(tables: list) -> str:
    schema_info = ""
    for table in tables:
        schema_name = table.get("schema")
        name = table.get("name", "")
        title = f"{schema_name}.{name}" if schema_name and schema_name not in (None, "", "public", "main") else name
        schema_info += f"\nTable: {title}\n"
        for col in table.get("columns") or []:
            flags = []
            if col.get("primary_key"):
                flags.append("PK")
            if col.get("nullable") is False:
                flags.append("NOT NULL")
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            schema_info += f"  - {col.get('name')} ({col.get('type')}){flag_str}\n"
        for fk in table.get("foreign_keys") or []:
            ref = f"{fk.get('ref_schema') + '.' if fk.get('ref_schema') else ''}{fk.get('ref_table')}.{fk.get('ref_column')}"
            schema_info += f"  - FK: {fk.get('column')} -> {ref}\n"
    return schema_info


class DatabaseManager:
    def __init__(self, database_url=None, connect_timeout=None, pool_size=None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            log.error("[DB] DATABASE_URL not found in environment or provided.")
            raise ValueError("DATABASE_URL not found in environment or provided.")
        log.info("[DB] Initialising DatabaseManager for engine type in URL.")
        kwargs = _engine_kwargs(self.database_url, connect_timeout=connect_timeout, pool_size=pool_size)
        self.engine = create_engine(self.database_url, **kwargs)
        log.info("[DB] SQLAlchemy engine created – dialect='%s'", self.engine.name)

    def get_schema_structured(self) -> dict:
        """Return structured schema: tables → columns → types → PK/FK when available."""
        log.info("[DB] Fetching structured schema – dialect='%s'", self.engine.name)
        tables: list[dict] = []

        with self.engine.connect() as connection:
            if self.engine.name == "postgresql":
                tables = self._pg_structured(connection)
            elif self.engine.name == "mysql":
                tables = self._mysql_structured(connection)
            elif self.engine.name == "sqlite":
                tables = self._sqlite_structured(connection)
            else:
                tables = self._generic_structured(connection)

        return {"dialect": self.engine.name, "tables": tables}

    def get_schema(self):
        """Returns the schema of the database as prompt-friendly text."""
        structured = self.get_schema_structured()
        schema_info = _format_tables_text(structured.get("tables") or [])
        if not schema_info.strip():
            schema_info = f"Schema retrieval returned no tables for database type '{self.engine.name}'."
        log.info("[DB] Schema fetched – %d chars returned.", len(schema_info))
        return schema_info

    def _pg_structured(self, connection) -> list[dict]:
        log.debug("[DB] Running PostgreSQL multi-schema information_schema query.")
        # All non-system schemas (not public-only)
        col_query = text("""
            SELECT table_schema, table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
              AND table_schema NOT LIKE 'pg_temp%%'
              AND table_schema NOT LIKE 'pg_toast_temp%%'
            ORDER BY table_schema, table_name, ordinal_position;
        """)
        rows = connection.execute(col_query).fetchall()

        pk_query = text("""
            SELECT tc.table_schema, tc.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast');
        """)
        pk_rows = connection.execute(pk_query).fetchall()
        pk_set = {(r[0], r[1], r[2]) for r in pk_rows}

        fk_query = text("""
            SELECT
                kcu.table_schema, kcu.table_name, kcu.column_name,
                ccu.table_schema AS ref_schema, ccu.table_name AS ref_table, ccu.column_name AS ref_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast');
        """)
        try:
            fk_rows = connection.execute(fk_query).fetchall()
        except Exception as ex:
            log.warning("[DB] FK introspection failed: %s", ex)
            fk_rows = []

        tables_map: dict[tuple, dict] = {}
        for schema_name, table_name, column_name, data_type, is_nullable in rows:
            key = (schema_name, table_name)
            if key not in tables_map:
                tables_map[key] = {
                    "schema": schema_name,
                    "name": table_name,
                    "columns": [],
                    "primary_keys": [],
                    "foreign_keys": [],
                }
            is_pk = (schema_name, table_name, column_name) in pk_set
            tables_map[key]["columns"].append({
                "name": column_name,
                "type": data_type,
                "nullable": (is_nullable or "YES").upper() == "YES",
                "primary_key": is_pk,
            })
            if is_pk:
                tables_map[key]["primary_keys"].append(column_name)

        for schema_name, table_name, column_name, ref_schema, ref_table, ref_column in fk_rows:
            key = (schema_name, table_name)
            if key in tables_map:
                tables_map[key]["foreign_keys"].append({
                    "column": column_name,
                    "ref_schema": ref_schema,
                    "ref_table": ref_table,
                    "ref_column": ref_column,
                })

        return list(tables_map.values())

    def _mysql_structured(self, connection) -> list[dict]:
        log.debug("[DB] Running MySQL information_schema query.")
        query = text("""
            SELECT table_schema, table_name, column_name, data_type, is_nullable, column_key
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
            ORDER BY table_name, ordinal_position;
        """)
        tables_map: dict[str, dict] = {}
        for schema_name, table_name, column_name, data_type, is_nullable, column_key in connection.execute(query):
            if table_name not in tables_map:
                tables_map[table_name] = {
                    "schema": schema_name,
                    "name": table_name,
                    "columns": [],
                    "primary_keys": [],
                    "foreign_keys": [],
                }
            is_pk = (column_key or "").upper() == "PRI"
            tables_map[table_name]["columns"].append({
                "name": column_name,
                "type": data_type,
                "nullable": (is_nullable or "YES").upper() == "YES",
                "primary_key": is_pk,
            })
            if is_pk:
                tables_map[table_name]["primary_keys"].append(column_name)
        return list(tables_map.values())

    def _sqlite_structured(self, connection) -> list[dict]:
        log.debug("[DB] Running SQLite PRAGMA queries for schema.")
        tables_query = text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        table_names = [r[0] for r in connection.execute(tables_query).fetchall()]
        tables = []
        for table_name in table_names:
            columns = connection.execute(text(f"PRAGMA table_info('{table_name}');")).fetchall()
            fk_rows = connection.execute(text(f"PRAGMA foreign_key_list('{table_name}');")).fetchall()
            col_list = []
            pks = []
            for col in columns:
                # cid, name, type, notnull, dflt_value, pk
                is_pk = bool(col[5])
                col_list.append({
                    "name": col[1],
                    "type": col[2] or "TEXT",
                    "nullable": not bool(col[3]),
                    "primary_key": is_pk,
                })
                if is_pk:
                    pks.append(col[1])
            fks = []
            for fk in fk_rows:
                # id, seq, table, from, to, on_update, on_delete, match
                fks.append({
                    "column": fk[3],
                    "ref_schema": None,
                    "ref_table": fk[2],
                    "ref_column": fk[4],
                })
            tables.append({
                "schema": "main",
                "name": table_name,
                "columns": col_list,
                "primary_keys": pks,
                "foreign_keys": fks,
            })
        return tables

    def _generic_structured(self, connection) -> list[dict]:
        try:
            log.debug("[DB] Attempting standard information_schema query for dialect='%s'.", self.engine.name)
            query = text("""
                SELECT table_schema, table_name, column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
                ORDER BY table_schema, table_name, ordinal_position;
            """)
            tables_map: dict[tuple, dict] = {}
            for schema_name, table_name, column_name, data_type, is_nullable in connection.execute(query):
                key = (schema_name, table_name)
                if key not in tables_map:
                    tables_map[key] = {
                        "schema": schema_name,
                        "name": table_name,
                        "columns": [],
                        "primary_keys": [],
                        "foreign_keys": [],
                    }
                tables_map[key]["columns"].append({
                    "name": column_name,
                    "type": data_type,
                    "nullable": (is_nullable or "YES").upper() == "YES",
                    "primary_key": False,
                })
            return list(tables_map.values())
        except Exception as ex:
            log.warning("[DB] Schema retrieval fallback failed for dialect='%s': %s", self.engine.name, ex)
            return []

    def execute_query(self, sql_query, *, enforce_readonly: bool = True):
        """Executes a SQL query and returns the results and column headers.

        By default enforces read-only validation for the NL→SQL path.
        """
        log.info("[DB] Executing query on dialect='%s'", self.engine.name)
        log.debug("[DB] SQL:\n%s", sql_query)
        if enforce_readonly:
            validate_readonly_sql(sql_query)

        t0 = time.perf_counter()
        with self.engine.connect() as connection:
            result = connection.execute(text(sql_query))
            if result.returns_rows:
                headers = list(result.keys())
                rows = [list(row) for row in result.fetchall()]
                formatted_rows = [[str(cell) for cell in row] for row in rows]
            else:
                headers = ["Status", "Rows Affected"]
                # Drivers often return -1 for DDL (CREATE/DROP/ALTER) — not a real row count.
                affected = result.rowcount
                affected_label = (
                    "N/A (nothing affected)"
                    if affected is None or affected < 0
                    else str(affected)
                )
                formatted_rows = [["Success", affected_label]]
            # SQLAlchemy 2.0 opens an implicit transaction; without commit(),
            # DDL/DML is rolled back when the connection closes.
            if not enforce_readonly:
                connection.commit()

        elapsed = time.perf_counter() - t0
        log.info("[DB] Query completed in %.3fs – %d row(s) returned, %d column(s).",
                 elapsed, len(formatted_rows), len(headers))
        return headers, formatted_rows

    def explain_query(self, sql_query):
        """Runs EXPLAIN (FORMAT JSON) or equivalent to get the query execution plan."""
        log.info("[DB] Running EXPLAIN on dialect='%s'", self.engine.name)
        log.debug("[DB] SQL:\n%s", sql_query)
        validate_readonly_sql(sql_query)

        explain_sql = sql_query
        if self.engine.name == 'postgresql':
            explain_sql = f"EXPLAIN (FORMAT JSON) {sql_query}"
        elif self.engine.name == 'mysql':
            explain_sql = f"EXPLAIN FORMAT=JSON {sql_query}"
        elif self.engine.name == 'sqlite':
            explain_sql = f"EXPLAIN QUERY PLAN {sql_query}"
        else:
            explain_sql = f"EXPLAIN {sql_query}"

        t0 = time.perf_counter()
        with self.engine.connect() as connection:
            result = connection.execute(text(explain_sql))
            rows = [list(row) for row in result.fetchall()]

        elapsed = time.perf_counter() - t0
        log.info("[DB] EXPLAIN completed in %.3fs", elapsed)

        if self.engine.name in ['postgresql', 'mysql']:
            return rows[0][0]
        else:
            return {"plan_text": rows}
