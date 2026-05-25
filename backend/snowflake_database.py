import time
from logger_config import get_logger

log = get_logger("snowflake")

try:
    from sqlalchemy import create_engine, text
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False


class SnowflakeDatabaseManager:
    """Database manager for Snowflake connections via snowflake-sqlalchemy."""

    def __init__(self, connection_url: str):
        log.info("[SNOWFLAKE] Initialising SnowflakeDatabaseManager")
        if not SQLALCHEMY_AVAILABLE:
            log.error("[SNOWFLAKE] sqlalchemy is not installed.")
            raise ImportError("sqlalchemy is not installed. Please run 'pip install sqlalchemy'")
        self.connection_url = connection_url
        log.debug("[SNOWFLAKE] Creating SQLAlchemy engine...")
        self.engine = create_engine(connection_url)
        log.info("[SNOWFLAKE] Engine created.")

    def get_schema(self) -> str:
        """Returns the schema of the Snowflake database using information_schema."""
        log.info("[SNOWFLAKE] Fetching schema via information_schema...")
        schema_info = ""
        try:
            t0 = time.perf_counter()
            with self.engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT
                        table_name,
                        column_name,
                        data_type
                    FROM information_schema.columns
                    WHERE table_schema != 'INFORMATION_SCHEMA'
                    ORDER BY table_name, ordinal_position
                """))
                current_table = ""
                table_count = 0
                for row in result:
                    table, col, dtype = row[0], row[1], row[2]
                    if table != current_table:
                        schema_info += f"\nTable: {table}\n"
                        current_table = table
                        table_count += 1
                    schema_info += f"  - {col} ({dtype})\n"

            elapsed = time.perf_counter() - t0
            if not schema_info.strip():
                log.warning("[SNOWFLAKE] No tables found.")
                return "No tables found in this Snowflake schema."
            log.info("[SNOWFLAKE] Fetched %d table(s) in %.2fs", table_count, elapsed)
            return schema_info
        except Exception as e:
            log.error("[SNOWFLAKE] Error fetching schema: %s", e, exc_info=True)
            return f"Error fetching Snowflake schema: {str(e)}"

    def execute_query(self, sql_query: str):
        """Executes a Snowflake SQL query and returns (headers, rows)."""
        log.info("[SNOWFLAKE] Executing query")
        log.debug("[SNOWFLAKE] SQL:\n%s", sql_query)
        try:
            t0 = time.perf_counter()
            with self.engine.connect() as conn:
                result = conn.execute(text(sql_query))
                headers = list(result.keys())
                rows = [list(row) for row in result.fetchall()]
                # Convert all row elements to strings for the frontend
                formatted_rows = [[str(cell) for cell in row] for row in rows]
            elapsed = time.perf_counter() - t0
            log.info("[SNOWFLAKE] Query completed in %.3fs – %d row(s), %d column(s).", elapsed, len(rows), len(headers))
            return headers, formatted_rows
        except Exception as e:
            log.error("[SNOWFLAKE] Execution error: %s", e, exc_info=True)
            raise Exception(f"Snowflake execution error: {str(e)}")
