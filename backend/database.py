import os
import re
import time
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from logger_config import get_logger

load_dotenv()
log = get_logger("database")

# Mutating queries are allowed per user request

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
        """Executes a SQL query and returns the results and column headers."""
        log.info("[DB] Executing query on dialect='%s'", self.engine.name)
        log.debug("[DB] SQL:\n%s", sql_query)
        t0 = time.perf_counter()
        
        # Using engine.begin() so mutating queries are automatically committed
        with self.engine.begin() as connection:
            result = connection.execute(text(sql_query))
            if result.returns_rows:
                headers = list(result.keys())
                rows = [list(row) for row in result.fetchall()]
                formatted_rows = [[str(cell) for cell in row] for row in rows]
            else:
                # For INSERT/UPDATE/DELETE, return a summary
                headers = ["Status", "Rows Affected"]
                formatted_rows = [["Success", str(result.rowcount)]]

        elapsed = time.perf_counter() - t0
        log.info("[DB] Query completed in %.3fs – %d row(s) returned, %d column(s).",
                 elapsed, len(formatted_rows), len(headers))
        return headers, formatted_rows
