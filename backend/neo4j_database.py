import os
import json
import urllib.parse
import time
from neo4j import GraphDatabase
from logger_config import get_logger

log = get_logger("neo4j")

try:
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False

class Neo4jDatabaseManager:
    """Database manager for Neo4j connections."""

    def __init__(self, connection_url: str):
        log.info("[NEO4J] Initialising Neo4jDatabaseManager")
        if not NEO4J_AVAILABLE:
            log.error("[NEO4J] neo4j is not installed.")
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
        
        log.debug("[NEO4J] Creating GraphDatabase driver...")
        self.driver = GraphDatabase.driver(uri, auth=(username, password))
        log.info("[NEO4J] Driver created.")

    def get_schema(self) -> str:
        """Returns the schema (nodes and relationships) of the Neo4j database."""
        log.info("[NEO4J] Fetching schema (nodes and relationships)...")
        if not NEO4J_AVAILABLE:
            return "Error: neo4j library not installed."
        
        schema_info = "Neo4j Database Schema:\n"
        try:
            t0 = time.perf_counter()
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
                            
            elapsed = time.perf_counter() - t0
            if schema_info.strip() == "Neo4j Database Schema:\n\nNodes:\n\nRelationships:":
                log.warning("[NEO4J] No nodes or relationships found.")
                return "No nodes or relationships found in this Neo4j database."
            log.info("[NEO4J] Schema fetched in %.2fs", elapsed)
            return schema_info
        except Exception as e:
            log.error("[NEO4J] Error fetching schema: %s", e, exc_info=True)
            return f"Error fetching Neo4j schema: {str(e)}"

    def execute_query(self, cypher_query: str):
        """Executes a Cypher query and returns (headers, rows)."""
        log.info("[NEO4J] Executing Cypher query")
        if not NEO4J_AVAILABLE:
            raise ImportError("neo4j package not installed.")
            
        try:
            cypher_query = cypher_query.strip().replace("```cypher", "").replace("```", "").strip()
            log.debug("[NEO4J] SQL/Cypher:\n%s", cypher_query)
            t0 = time.perf_counter()
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
                
                elapsed = time.perf_counter() - t0
                log.info("[NEO4J] Query completed in %.3fs – %d row(s), %d column(s).", elapsed, len(rows), len(headers))
                return headers, rows
                
        except Exception as e:
            log.error("[NEO4J] Execution error: %s", e, exc_info=True)
            raise Exception(f"Neo4j execution error: {str(e)}")

    def explain_query(self, cypher_query: str):
        """Runs EXPLAIN to get the query execution plan."""
        log.info("[NEO4J] Explaining Cypher query")
        if not NEO4J_AVAILABLE:
            raise ImportError("neo4j package not installed.")
            
        try:
            cypher_query = cypher_query.strip().replace("```cypher", "").replace("```", "").strip()
            explain_query = f"EXPLAIN {cypher_query}"
            log.debug("[NEO4J] SQL/Cypher:\n%s", explain_query)
            t0 = time.perf_counter()
            with self.driver.session() as session:
                result = session.run(explain_query)
                info = result.consume()
                if info.plan:
                    def plan_to_dict(plan_obj):
                        if not plan_obj: return None
                        return {
                            "operatorType": plan_obj.operator_type,
                            "identifiers": plan_obj.identifiers,
                            "arguments": plan_obj.arguments,
                            "children": [plan_to_dict(c) for c in plan_obj.children]
                        }
                    plan_json = plan_to_dict(info.plan)
                else:
                    plan_json = {"message": "No explain plan returned"}
                
                elapsed = time.perf_counter() - t0
                log.info("[NEO4J] EXPLAIN completed in %.3fs", elapsed)
                return plan_json
                
        except Exception as e:
            log.error("[NEO4J] EXPLAIN error: %s", e, exc_info=True)
            raise Exception(f"Neo4j EXPLAIN error: {str(e)}")

