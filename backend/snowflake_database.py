try:
    from sqlalchemy import create_engine, text
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False


class SnowflakeDatabaseManager:
    """Database manager for Snowflake connections via snowflake-sqlalchemy."""

    def __init__(self, connection_url: str):
        if not SQLALCHEMY_AVAILABLE:
            raise ImportError("sqlalchemy is not installed. Please run 'pip install sqlalchemy'")
        self.connection_url = connection_url
        self.engine = create_engine(connection_url)

    def get_schema(self) -> str:
        """Returns the schema of the Snowflake database using information_schema."""
        schema_info = ""
        try:
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
                for row in result:
                    table, col, dtype = row[0], row[1], row[2]
                    if table != current_table:
                        schema_info += f"\nTable: {table}\n"
                        current_table = table
                    schema_info += f"  - {col} ({dtype})\n"

            if not schema_info.strip():
                return "No tables found in this Snowflake schema."
            return schema_info
        except Exception as e:
            return f"Error fetching Snowflake schema: {str(e)}"

    def execute_query(self, sql_query: str):
        """Executes a Snowflake SQL query and returns (headers, rows)."""
        try:
            with self.engine.connect() as conn:
                result = conn.execute(text(sql_query))
                headers = list(result.keys())
                rows = [list(row) for row in result.fetchall()]
                # Convert all row elements to strings for the frontend
                formatted_rows = [[str(cell) for cell in row] for row in rows]
            return headers, formatted_rows
        except Exception as e:
            raise Exception(f"Snowflake execution error: {str(e)}")
