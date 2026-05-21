import os
import json
import urllib.parse
from neo4j import GraphDatabase

try:
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False

class Neo4jDatabaseManager:
    """Database manager for Neo4j connections."""

    def __init__(self, connection_url: str):
        if not NEO4J_AVAILABLE:
            raise ImportError("neo4j is not installed. Please run 'pip install neo4j'")
        
        self.connection_url = connection_url
        parsed = urllib.parse.urlparse(connection_url)
        
        username = urllib.parse.unquote(parsed.username) if parsed.username else None
        password = urllib.parse.unquote(parsed.password) if parsed.password else None
        
        # Reconstruct URI without auth
        scheme = parsed.scheme
        host_netloc = f"{parsed.hostname}"
        if parsed.port:
            host_netloc += f":{parsed.port}"
            
        uri = f"{scheme}://{host_netloc}"
        
        self.driver = GraphDatabase.driver(uri, auth=(username, password))

    def get_schema(self) -> str:
        """Returns the schema (nodes and relationships) of the Neo4j database."""
        if not NEO4J_AVAILABLE:
            return "Error: neo4j library not installed."
        
        schema_info = "Neo4j Database Schema:\n"
        try:
            with self.driver.session() as session:
                # Query to get Node labels and their properties
                node_query = """
                MATCH (n)
                UNWIND labels(n) AS label
                WITH label, keys(n) AS keys
                UNWIND (CASE keys WHEN [] THEN [null] ELSE keys END) AS key
                RETURN label, collect(DISTINCT key) AS properties
                """
                result = session.run(node_query)
                schema_info += "\nNodes:\n"
                for record in result:
                    label = record["label"]
                    props = [p for p in record["properties"] if p is not None]
                    schema_info += f"  - Label: {label}\n"
                    if props:
                        for p in props:
                            schema_info += f"    - {p}\n"
                            
                # Relationships
                rel_query = """
                MATCH ()-[r]->()
                WITH type(r) AS type, keys(r) AS keys
                UNWIND (CASE keys WHEN [] THEN [null] ELSE keys END) AS key
                RETURN type, collect(DISTINCT key) AS properties
                """
                result = session.run(rel_query)
                schema_info += "\nRelationships:\n"
                for record in result:
                    rel_type = record["type"]
                    props = [p for p in record["properties"] if p is not None]
                    schema_info += f"  - Type: {rel_type}\n"
                    if props:
                        for p in props:
                            schema_info += f"    - {p}\n"
                            
            if schema_info.strip() == "Neo4j Database Schema:\n\nNodes:\n\nRelationships:":
                return "No nodes or relationships found in this Neo4j database."
            return schema_info
        except Exception as e:
            return f"Error fetching Neo4j schema: {str(e)}"

    def execute_query(self, cypher_query: str):
        """Executes a Cypher query and returns (headers, rows)."""
        if not NEO4J_AVAILABLE:
            raise ImportError("neo4j package not installed.")
            
        try:
            cypher_query = cypher_query.strip().replace("```cypher", "").replace("```", "").strip()
            with self.driver.session() as session:
                result = session.run(cypher_query)
                records = list(result)
                
                if not records:
                    return [], []
                
                headers = list(records[0].keys())
                rows = []
                
                for record in records:
                    row = []
                    for key in headers:
                        val = record[key]
                        if hasattr(val, "labels") and hasattr(val, "_properties"):
                            # It's a Node
                            labels = list(val.labels)
                            props = val._properties
                            row.append(json.dumps({"labels": labels, "properties": props}))
                        elif hasattr(val, "type") and hasattr(val, "_properties"):
                            # It's a Relationship
                            rel_type = val.type
                            props = val._properties
                            row.append(json.dumps({"type": rel_type, "properties": props}))
                        else:
                            # Scalar value or list/dict
                            if isinstance(val, (dict, list)):
                                row.append(json.dumps(val))
                            else:
                                row.append(str(val))
                    rows.append(row)
                
                return headers, rows
        except Exception as e:
            raise Exception(f"Neo4j execution error: {str(e)}")
