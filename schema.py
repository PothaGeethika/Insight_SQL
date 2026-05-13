def get_schema(conn):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """)
    
    rows = cursor.fetchall()
    
    schema = {}
    for table, column, dtype in rows:
        if table not in schema:
            schema[table] = []
        schema[table].append(f"{column} ({dtype})")
    
    # Format as readable string for LLM
    result = ""
    for table, columns in schema.items():
        result += f"Table: {table}\n"
        result += f"Columns: {', '.join(columns)}\n\n"
    
    return result
