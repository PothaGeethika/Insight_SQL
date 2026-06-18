import os
import re
import time
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from logger_config import get_logger

load_dotenv()
log = get_logger("database")

# Forbidden SQL statement prefixes that mutate data or schema
_FORBIDDEN_PATTERN = re.compile(
    r"^\s*(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE|MERGE|CALL|EXEC|EXECUTE|GRANT|REVOKE|LOCK|UNLOCK|RENAME|SET\s+GLOBAL|LOAD\s+DATA)\b",
    re.IGNORECASE,
)

def _assert_read_only(sql: str) -> None:
    """Raises ValueError if the SQL is not a safe read-only statement."""
    # Strip leading comments before checking
    stripped = re.sub(r"--[^\n]*", "", sql)
    stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.DOTALL).strip()
    if _FORBIDDEN_PATTERN.match(stripped):
        first_word = stripped.split()[0].upper() if stripped.split() else ""
        log.warning("[DB] Blocked forbidden SQL statement: %s", first_word)
        raise ValueError(
            f"Unsafe SQL statement '{first_word}' is not allowed. Only read-only SELECT queries are permitted."
        )

class DatabaseManager:
    def __init__(self, database_url=None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            log.error("[DB] DATABASE_URL not found in environment or provided.")
            raise ValueError("DATABASE_URL not found in environment or provided.")
        log.info("[DB] Initialising DatabaseManager for engine type in URL.")
        self.engine = create_engine(self.database_url)
        log.info("[DB] SQLAlchemy engine created – dialect='%s'", self.engine.name)

    def get_schema(self):
        """Returns the schema of the database to help the LLM generate SQL."""
        log.info("[DB] Fetching schema – dialect='%s'", self.engine.name)
        schema_info = ""

        with self.engine.connect() as connection:
            if self.engine.name == 'postgresql':
                log.debug("[DB] Running PostgreSQL information_schema query.")
                query = text("""
                    SELECT table_name, column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                    ORDER BY table_name, ordinal_position;
                """)
                result = connection.execute(query)
                current_table = ""
                for row in result:
                    table_name, column_name, data_type = row
                    if table_name != current_table:
                        schema_info += f"\nTable: {table_name}\n"
                        current_table = table_name
                    schema_info += f"  - {column_name} ({data_type})\n"

            elif self.engine.name == 'mysql':
                log.debug("[DB] Running MySQL information_schema query.")
                query = text("""
                    SELECT table_name, column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                    ORDER BY table_name, ordinal_position;
                """)
                result = connection.execute(query)
                current_table = ""
                for row in result:
                    table_name, column_name, data_type = row
                    if table_name != current_table:
                        schema_info += f"\nTable: {table_name}\n"
                        current_table = table_name
                    schema_info += f"  - {column_name} ({data_type})\n"

            elif self.engine.name == 'sqlite':
                log.debug("[DB] Running SQLite PRAGMA queries for schema.")
                tables_query = text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
                tables = connection.execute(tables_query).fetchall()
                log.debug("[DB] Found %d table(s) in SQLite db.", len(tables))
                for table_row in tables:
                    table_name = table_row[0]
                    schema_info += f"\nTable: {table_name}\n"
                    columns_query = text(f"PRAGMA table_info({table_name});")
                    columns = connection.execute(columns_query).fetchall()
                    for col in columns:
                        schema_info += f"  - {col[1]} ({col[2]})\n"
            else:
                log.warning("[DB] Schema retrieval not implemented for dialect='%s'", self.engine.name)
                schema_info = "Schema retrieval not fully implemented for this database type."

        log.info("[DB] Schema fetched – %d chars returned.", len(schema_info))
        return schema_info

    def execute_query(self, sql_query):
        """Executes a read-only SQL query and returns the results and column headers."""
        _assert_read_only(sql_query)
        log.info("[DB] Executing query on dialect='%s'", self.engine.name)
        log.debug("[DB] SQL:\n%s", sql_query)
        t0 = time.perf_counter()
        with self.engine.connect() as connection:
            result = connection.execute(text(sql_query))
            headers = list(result.keys())
            rows = [list(row) for row in result.fetchall()]
            formatted_rows = [[str(cell) for cell in row] for row in rows]
        elapsed = time.perf_counter() - t0
        log.info("[DB] Query completed in %.3fs – %d row(s) returned, %d column(s).",
                 elapsed, len(formatted_rows), len(headers))
        return headers, formatted_rows
