import os
import json
import urllib.parse
import time
from neo4j import GraphDatabase
from logger_config import get_logger
from sql_validator import validate_readonly_cypher

log = get_logger("neo4j")

try:
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False


class Neo4jDatabaseManager:
    """Database manager for Neo4j connections."""

    def __init__(self, connection_url: str, connect_timeout: int = None):
        log.info("[NEO4J] Initialising Neo4jDatabaseManager")
        if not NEO4J_AVAILABLE:
            log.error("[NEO4J] neo4j is not installed.")
            raise ImportError("neo4j is not installed. Please run 'pip install neo4j'")

        self.connection_url = connection_url
        parsed = urllib.parse.urlparse(connection_url)

        username = urllib.parse.unquote(parsed.username) if parsed.username else None
        password = urllib.parse.unquote(parsed.password) if parsed.password else None

        scheme = parsed.scheme
        host_netloc = f"{parsed.hostname}"
        if parsed.port:
            host_netloc += f":{parsed.port}"

        uri = f"{scheme}://{host_netloc}"

        if connect_timeout is None:
            try:
                from config import DB_CONNECT_TIMEOUT
                connect_timeout = int(DB_CONNECT_TIMEOUT)
            except Exception:
                connect_timeout = 10

        log.debug("[NEO4J] Creating GraphDatabase driver (connection_timeout=%ss)...", connect_timeout)
        self.driver = GraphDatabase.driver(
            uri,
            auth=(username, password),
            connection_timeout=connect_timeout,
        )
        log.info("[NEO4J] Driver created.")

    def get_schema_structured(self, sample_limit: int = 200) -> dict:
        """Return structured labels/relationships with sampled property types."""
        log.info("[NEO4J] Fetching structured schema...")
        if not NEO4J_AVAILABLE:
            return {"dialect": "neo4j", "nodes": [], "relationships": [], "error": "neo4j not installed"}

        nodes_out = []
        rels_out = []
        try:
            with self.driver.session() as session:
                # Prefer APOC if available; otherwise sample nodes
                try:
                    result = session.run(
                        """
                        CALL db.schema.nodeTypeProperties()
                        YIELD nodeType, propertyName, propertyTypes
                        RETURN nodeType, propertyName, propertyTypes
                        """
                    )
                    by_label: dict[str, list] = {}
                    for record in result:
                        raw = record["nodeType"] or ""
                        label = raw.strip(":").strip("`")
                        if not label:
                            continue
                        by_label.setdefault(label, []).append({
                            "name": record["propertyName"],
                            "type": ",".join(record["propertyTypes"] or []) or "unknown",
                        })
                    for label, props in by_label.items():
                        nodes_out.append({"label": label, "properties": props})
                except Exception:
                    node_query = f"""
                    MATCH (n)
                    WITH n LIMIT {int(sample_limit)}
                    UNWIND labels(n) AS label
                    WITH label, keys(n) AS keys
                    UNWIND (CASE keys WHEN [] THEN [null] ELSE keys END) AS key
                    RETURN label, collect(DISTINCT key) AS properties
                    """
                    result = session.run(node_query)
                    for record in result:
                        props = [{"name": p, "type": "unknown"} for p in (record["properties"] or []) if p]
                        nodes_out.append({"label": record["label"], "properties": props})

                try:
                    result = session.run(
                        """
                        CALL db.schema.relTypeProperties()
                        YIELD relType, propertyName, propertyTypes
                        RETURN relType, propertyName, propertyTypes
                        """
                    )
                    by_type: dict[str, list] = {}
                    for record in result:
                        raw = record["relType"] or ""
                        rel_type = raw.strip(":").strip("`").lstrip(":")
                        if not rel_type:
                            continue
                        by_type.setdefault(rel_type, []).append({
                            "name": record["propertyName"],
                            "type": ",".join(record["propertyTypes"] or []) or "unknown",
                        })
                    for rel_type, props in by_type.items():
                        rels_out.append({"type": rel_type, "properties": props})
                except Exception:
                    rel_query = f"""
                    MATCH ()-[r]->()
                    WITH r LIMIT {int(sample_limit)}
                    WITH type(r) AS type, keys(r) AS keys
                    UNWIND (CASE keys WHEN [] THEN [null] ELSE keys END) AS key
                    RETURN type, collect(DISTINCT key) AS properties
                    """
                    result = session.run(rel_query)
                    for record in result:
                        props = [{"name": p, "type": "unknown"} for p in (record["properties"] or []) if p]
                        rels_out.append({"type": record["type"], "properties": props})

            return {"dialect": "neo4j", "nodes": nodes_out, "relationships": rels_out}
        except Exception as e:
            log.error("[NEO4J] Error fetching structured schema: %s", e, exc_info=True)
            return {"dialect": "neo4j", "nodes": [], "relationships": [], "error": str(e)}

    def get_schema(self) -> str:
        """Returns the schema (nodes and relationships) of the Neo4j database."""
        structured = self.get_schema_structured()
        if structured.get("error") and not structured.get("nodes") and not structured.get("relationships"):
            return f"Error fetching Neo4j schema: {structured['error']}"

        schema_info = "Neo4j Database Schema:\n"
        nodes = structured.get("nodes") or []
        rels = structured.get("relationships") or []
        if not nodes and not rels:
            return "No nodes or relationships found in this Neo4j database."

        schema_info += "\nNodes:\n"
        for node in nodes:
            schema_info += f"  - Label: {node.get('label')}\n"
            for prop in node.get("properties") or []:
                if isinstance(prop, dict):
                    schema_info += f"    - {prop.get('name')} ({prop.get('type', 'unknown')})\n"
                else:
                    schema_info += f"    - {prop}\n"

        schema_info += "\nRelationships:\n"
        for rel in rels:
            schema_info += f"  - Type: {rel.get('type')}\n"
            for prop in rel.get("properties") or []:
                if isinstance(prop, dict):
                    schema_info += f"    - {prop.get('name')} ({prop.get('type', 'unknown')})\n"
                else:
                    schema_info += f"    - {prop}\n"

        log.info("[NEO4J] Schema fetched (%d chars)", len(schema_info))
        return schema_info

    def execute_query(self, cypher_query: str, *, enforce_readonly: bool = True):
        """Executes a Cypher query and returns (headers, rows)."""
        log.info("[NEO4J] Executing Cypher query")
        if not NEO4J_AVAILABLE:
            raise ImportError("neo4j package not installed.")

        try:
            cypher_query = cypher_query.strip().replace("```cypher", "").replace("```", "").strip()
            if enforce_readonly:
                validate_readonly_cypher(cypher_query)
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
                            labels = list(val.labels)
                            props = val._properties
                            row.append(json.dumps({"labels": labels, "properties": props}))
                        elif hasattr(val, "type") and hasattr(val, "_properties"):
                            rel_type = val.type
                            props = val._properties
                            row.append(json.dumps({"type": rel_type, "properties": props}))
                        else:
                            if isinstance(val, (dict, list)):
                                row.append(json.dumps(val))
                            else:
                                row.append(str(val))
                    rows.append(row)

                elapsed = time.perf_counter() - t0
                log.info("[NEO4J] Query completed in %.3fs – %d row(s), %d column(s).", elapsed, len(rows), len(headers))
                return headers, rows

        except ValueError:
            raise
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
            validate_readonly_cypher(cypher_query)
            explain_query = f"EXPLAIN {cypher_query}"
            log.debug("[NEO4J] SQL/Cypher:\n%s", explain_query)
            t0 = time.perf_counter()
            with self.driver.session() as session:
                result = session.run(explain_query)
                info = result.consume()
                if info.plan:
                    def plan_to_dict(plan_obj):
                        if not plan_obj:
                            return None
                        return {
                            "operatorType": plan_obj.operator_type,
                            "identifiers": plan_obj.identifiers,
                            "arguments": plan_obj.arguments,
                            "children": [plan_to_dict(c) for c in plan_obj.children],
                        }
                    plan_json = plan_to_dict(info.plan)
                else:
                    plan_json = {"message": "No explain plan returned"}

                elapsed = time.perf_counter() - t0
                log.info("[NEO4J] EXPLAIN completed in %.3fs", elapsed)
                return plan_json

        except ValueError:
            raise
        except Exception as e:
            log.error("[NEO4J] EXPLAIN error: %s", e, exc_info=True)
            raise Exception(f"Neo4j EXPLAIN error: {str(e)}")
