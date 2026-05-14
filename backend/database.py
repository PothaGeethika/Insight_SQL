import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

class DatabaseManager:
    def __init__(self, database_url=None):
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL not found in environment or provided.")
        self.engine = create_engine(self.database_url)

    def get_schema(self):
        """Returns the schema of the database to help the LLM generate SQL."""
        schema_info = ""
        
        with self.engine.connect() as connection:
            if self.engine.name == 'postgresql':
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
            
            elif self.engine.name == 'sqlite':
                # Get all tables
                tables_query = text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
                tables = connection.execute(tables_query).fetchall()
                
                for table_row in tables:
                    table_name = table_row[0]
                    schema_info += f"\nTable: {table_name}\n"
                    # Get columns for each table
                    columns_query = text(f"PRAGMA table_info({table_name});")
                    columns = connection.execute(columns_query).fetchall()
                    for col in columns:
                        # PRAGMA table_info returns (id, name, type, notnull, default_value, pk)
                        schema_info += f"  - {col[1]} ({col[2]})\n"
            else:
                # Fallback for other databases
                schema_info = "Schema retrieval not fully implemented for this database type."
                
        return schema_info

    def execute_query(self, sql_query):
        """Executes a SQL query and returns the results and column headers."""
        with self.engine.connect() as connection:
            result = connection.execute(text(sql_query))
            headers = list(result.keys())
            rows = [list(row) for row in result.fetchall()]
            # Convert all row elements to strings for the frontend
            formatted_rows = [[str(cell) for cell in row] for row in rows]
            return headers, formatted_rows
