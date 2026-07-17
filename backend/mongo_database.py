import os
import json
import time
from collections import defaultdict
from pymongo import MongoClient
from bson import json_util
from logger_config import get_logger

log = get_logger("mongo")
try:
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False

_ALLOWED_ACTIONS = frozenset({"find", "aggregate", "count"})


class MongoDatabaseManager:
    def __init__(self, connection_url, connect_timeout_ms=None):
        log.info("[MONGO] Initialising MongoDatabaseManager")
        if not PYMONGO_AVAILABLE:
            log.error("[MONGO] pymongo is not installed.")
            raise ImportError("pymongo is not installed. Please run 'pip install pymongo'")
        self.connection_url = connection_url
        if connect_timeout_ms is None:
            try:
                from config import DB_CONNECT_TIMEOUT
                connect_timeout_ms = int(DB_CONNECT_TIMEOUT) * 1000
            except Exception:
                connect_timeout_ms = 10000
        log.debug("[MONGO] Creating MongoClient (serverSelectionTimeoutMS=%s)...", connect_timeout_ms)
        self.client = MongoClient(
            self.connection_url,
            serverSelectionTimeoutMS=connect_timeout_ms,
            connectTimeoutMS=connect_timeout_ms,
        )
        # Extract database name from connection URL
        self.db_name = self.connection_url.split('/')[-1].split('?')[0]
        self.db = self.client[self.db_name]
        log.info("[MONGO] Connected to database: '%s'", self.db_name)

    def get_schema_structured(self, sample_size: int = 20) -> dict:
        """Return structured schema with sampled field types across documents."""
        log.info("[MONGO] Fetching structured schema for database: '%s'", self.db_name)
        if not PYMONGO_AVAILABLE:
            return {"dialect": "mongodb", "database": self.db_name, "collections": [], "error": "pymongo not installed"}

        collections_out = []
        try:
            for coll_name in self.db.list_collection_names():
                coll = self.db[coll_name]
                try:
                    count = coll.estimated_document_count()
                except Exception:
                    count = None
                field_types: dict[str, set] = defaultdict(set)
                samples = list(coll.find().limit(sample_size))
                for doc in samples:
                    for key, value in doc.items():
                        field_types[key].add(type(value).__name__)
                fields = [
                    {"name": name, "types": sorted(list(types))}
                    for name, types in sorted(field_types.items())
                ]
                collections_out.append({
                    "name": coll_name,
                    "count": count,
                    "fields": fields,
                    "sample_size": len(samples),
                })
            return {"dialect": "mongodb", "database": self.db_name, "collections": collections_out}
        except Exception as e:
            log.error("[MONGO] Error fetching structured schema: %s", e, exc_info=True)
            return {"dialect": "mongodb", "database": self.db_name, "collections": [], "error": str(e)}

    def get_schema(self):
        """Returns the schema of the MongoDB database by listing collections and sample keys."""
        structured = self.get_schema_structured()
        if structured.get("error") and not structured.get("collections"):
            return f"Error fetching MongoDB schema: {structured['error']}"
        schema_info = f"Database: {self.db_name}\n"
        collections = structured.get("collections") or []
        if not collections:
            return "No collections found in this database."
        for coll in collections:
            schema_info += f"\nCollection: {coll['name']}\n"
            if coll.get("count") is not None:
                schema_info += f"  approx_count: {coll['count']}\n"
            fields = coll.get("fields") or []
            if fields:
                schema_info += "  Fields (sampled):\n"
                for field in fields:
                    type_str = "|".join(field.get("types") or ["unknown"])
                    schema_info += f"    - {field['name']} ({type_str})\n"
            else:
                schema_info += "  (Empty collection)\n"
        log.info("[MONGO] Schema fetched successfully (%d chars).", len(schema_info))
        return schema_info

    def execute_query(self, mql_json):
        log.info("[MONGO] Executing MQL query")
        if not PYMONGO_AVAILABLE:
            raise ImportError("pymongo is not installed.")

        try:
            if isinstance(mql_json, str):
                mql_json = mql_json.strip().replace("```json", "").replace("```", "").strip()
                log.debug("[MONGO] Raw MQL JSON:\n%s", mql_json)
                mql_json = json.loads(mql_json)

            collection_name = mql_json.get("collection")
            action = mql_json.get("action", "find")
            query = mql_json.get("query", {})
            projection = mql_json.get("projection")
            limit = mql_json.get("limit", 100)

            if not collection_name:
                raise ValueError("Collection name is required in MQL JSON.")

            if action not in _ALLOWED_ACTIONS:
                raise ValueError(
                    f"Unsupported MongoDB action: {action}. "
                    f"Only read actions are allowed: {', '.join(sorted(_ALLOWED_ACTIONS))}."
                )

            log.info("[MONGO] Action: '%s', Collection: '%s', Limit: %s", action, collection_name, limit)
            collection = self.db[collection_name]

            t0 = time.perf_counter()
            if action == "find":
                cursor = collection.find(query, projection).limit(limit)
                results = list(cursor)
            elif action == "aggregate":
                pipeline = mql_json.get("pipeline", [])
                cursor = collection.aggregate(pipeline)
                results = list(cursor)
            else:  # count
                count = collection.count_documents(query)
                results = [{"count": count}]
            elapsed = time.perf_counter() - t0

            log.info("[MONGO] Execution completed in %.3fs – returned %d doc(s).", elapsed, len(results))
            if not results:
                return [], []

            headers = set()
            for doc in results:
                headers.update(doc.keys())

            headers = sorted(list(headers))
            if "_id" in headers:
                headers.remove("_id")
                headers.insert(0, "_id")

            rows = []
            for doc in results:
                row = []
                for header in headers:
                    val = doc.get(header, "")
                    if hasattr(val, '__str__'):
                        row.append(str(val))
                    else:
                        from bson import json_util
                        row.append(json.dumps(val, default=json_util.default))
                rows.append(row)

            return headers, rows

        except ValueError:
            raise
        except Exception as e:
            raise Exception(f"MongoDB execution error: {str(e)}")

    def explain_query(self, mql_json):
        log.info("[MONGO] Explaining MQL query")
        if not PYMONGO_AVAILABLE:
            raise ImportError("pymongo is not installed.")

        try:
            if isinstance(mql_json, str):
                mql_json = mql_json.strip().replace("```json", "").replace("```", "").strip()
                mql_json = json.loads(mql_json)

            collection_name = mql_json.get("collection")
            action = mql_json.get("action", "find")
            query = mql_json.get("query", {})
            projection = mql_json.get("projection")
            limit = mql_json.get("limit", 100)

            if not collection_name:
                raise ValueError("Collection name is required in MQL JSON.")
            if action not in _ALLOWED_ACTIONS:
                raise ValueError(f"Unsupported MongoDB action for explain: {action}")

            collection = self.db[collection_name]

            t0 = time.perf_counter()
            if action == "find":
                plan = collection.find(query, projection).limit(limit).explain()
            elif action == "aggregate":
                pipeline = mql_json.get("pipeline", [])
                plan = self.db.command('aggregate', collection_name, pipeline=pipeline, explain=True)
            else:
                plan = {"message": "Count queries do not support detailed execution plans in this wrapper."}
            elapsed = time.perf_counter() - t0

            log.info("[MONGO] Explain completed in %.3fs.", elapsed)
            return plan

        except ValueError:
            raise
        except Exception as e:
            raise Exception(f"MongoDB explain error: {str(e)}")
