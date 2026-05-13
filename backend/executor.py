def execute_sql(conn, sql):
    try:
        cursor = conn.cursor()
        cursor.execute(sql)
        
        # Check if it's a SELECT query that returns rows
        if cursor.description:
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            # Convert to list of dicts
            result = []
            for row in rows:
                result.append(dict(zip(columns, row)))
            
            return {"success": True, "data": result}
        else:
            conn.commit()
            return {"success": True, "data": "Query executed successfully (no results to display)."}
    
    except Exception as e:
        return {"success": False, "error": str(e)}
