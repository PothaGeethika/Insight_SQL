import time
from logger_config import get_logger
from sql_validator import validate_readonly_sql
from database import _format_tables_text

log = get_logger("snowflake")

try:
    from sqlalchemy import create_engine, text
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False


class SnowflakeDatabaseManager:
    """Database manager for Snowflake connections via snowflake-sqlalchemy."""

    def __init__(self, connection_url: str, connect_timeout=None, pool_size=None):
        log.info("[SNOWFLAKE] Initialising SnowflakeDatabaseManager")
        if not SQLALCHEMY_AVAILABLE:
            log.error("[SNOWFLAKE] sqlalchemy is not installed.")
            raise ImportError("sqlalchemy is not installed. Please run 'pip install sqlalchemy'")
        self.connection_url = connection_url
        log.debug("[SNOWFLAKE] Creating SQLAlchemy engine...")
        # Snowflake connector uses login_timeout / network_timeout via connect_args
        timeout = connect_timeout
        if timeout is None:
            try:
                from config import DB_CONNECT_TIMEOUT
                timeout = DB_CONNECT_TIMEOUT
            except Exception:
                timeout = 10
        kwargs = {
            "connect_args": {
                "login_timeout": timeout,
                "network_timeout": timeout,
            },
            "pool_pre_ping": True,
        }
        self.engine = create_engine(connection_url, **kwargs)
        log.info("[SNOWFLAKE] Engine created.")

    def get_schema_structured(self) -> dict:
        """Return structured Snowflake schema via information_schema."""
        log.info("[SNOWFLAKE] Fetching structured schema...")
        tables_map: dict[tuple, dict] = {}
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT
                        table_schema,
                        table_name,
                        column_name,
                        data_type,
                        is_nullable
                    FROM information_schema.columns
                    WHERE table_schema != 'INFORMATION_SCHEMA'
                    ORDER BY table_schema, table_name, ordinal_position
                """))
                for schema_name, table_name, column_name, data_type, is_nullable in result:
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
                        "nullable": str(is_nullable or "YES").upper() == "YES",
                        "primary_key": False,
                    })
            return {"dialect": "snowflake", "tables": list(tables_map.values())}
        except Exception as e:
            log.error("[SNOWFLAKE] Error fetching structured schema: %s", e, exc_info=True)
            return {"dialect": "snowflake", "tables": [], "error": str(e)}

    def get_schema(self) -> str:
        """Returns the schema of the Snowflake database using information_schema."""
        structured = self.get_schema_structured()
        if structured.get("error") and not structured.get("tables"):
            return f"Error fetching Snowflake schema: {structured['error']}"
        schema_info = _format_tables_text(structured.get("tables") or [])
        if not schema_info.strip():
            return "No tables found in this Snowflake schema."
        log.info("[SNOWFLAKE] Schema fetched (%d chars)", len(schema_info))
        return schema_info

    def execute_query(self, sql_query: str, *, enforce_readonly: bool = True):
        """Executes a Snowflake SQL query and returns (headers, rows)."""
        log.info("[SNOWFLAKE] Executing query")
        log.debug("[SNOWFLAKE] SQL:\n%s", sql_query)
        if enforce_readonly:
            validate_readonly_sql(sql_query)
        try:
            t0 = time.perf_counter()
            with self.engine.connect() as conn:
                result = conn.execute(text(sql_query))
                if result.returns_rows:
                    headers = list(result.keys())
                    rows = [list(row) for row in result.fetchall()]
                    formatted_rows = [[str(cell) for cell in row] for row in rows]
                else:
                    headers = ["Status", "Rows Affected"]
                    affected = result.rowcount
                    affected_label = (
                        "N/A (nothing affected)"
                        if affected is None or affected < 0
                        else str(affected)
                    )
                    rows = []
                    formatted_rows = [["Success", affected_label]]
                if not enforce_readonly:
                    conn.commit()
            elapsed = time.perf_counter() - t0
            log.info("[SNOWFLAKE] Query completed in %.3fs – %d row(s), %d column(s).", elapsed, len(formatted_rows), len(headers))
            return headers, formatted_rows
        except ValueError:
            raise
        except Exception as e:
            log.error("[SNOWFLAKE] Execution error: %s", e, exc_info=True)
            raise Exception(f"Snowflake execution error: {str(e)}")

    def explain_query(self, sql_query: str):
        """Runs EXPLAIN USING JSON to get the query execution plan."""
        log.info("[SNOWFLAKE] Running EXPLAIN")
        log.debug("[SNOWFLAKE] SQL:\n%s", sql_query)
        validate_readonly_sql(sql_query)
        try:
            explain_sql = f"EXPLAIN USING JSON {sql_query}"
            t0 = time.perf_counter()
            with self.engine.connect() as conn:
                result = conn.execute(text(explain_sql))
                row = result.fetchone()
                if row and row[0]:
                    import json
                    try:
                        plan_json = json.loads(row[0])
                    except Exception:
                        plan_json = {"plan": row[0]}
                else:
                    plan_json = {"message": "No explain plan returned"}
            elapsed = time.perf_counter() - t0
            log.info("[SNOWFLAKE] EXPLAIN completed in %.3fs", elapsed)
            return plan_json
        except ValueError:
            raise
        except Exception as e:
            log.error("[SNOWFLAKE] EXPLAIN error: %s", e, exc_info=True)
            raise Exception(f"Snowflake EXPLAIN error: {str(e)}")
