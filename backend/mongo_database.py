import os
import json
import time
from pymongo import MongoClient
from bson import json_util
from logger_config import get_logger

log = get_logger("mongo")
try:
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False

class MongoDatabaseManager:
    def __init__(self, connection_url):
        log.info("[MONGO] Initialising MongoDatabaseManager")
        if not PYMONGO_AVAILABLE:
            log.error("[MONGO] pymongo is not installed.")
            raise ImportError("pymongo is not installed. Please run 'pip install pymongo'")
        self.connection_url = connection_url
        log.debug("[MONGO] Creating MongoClient...")
        self.client = MongoClient(self.connection_url)
        # Extract database name from connection URL
        self.db_name = self.connection_url.split('/')[-1].split('?')[0]
        self.db = self.client[self.db_name]
        log.info("[MONGO] Connected to database: '%s'", self.db_name)

    def get_schema(self):
        """Returns the schema of the MongoDB database by listing collections and sample keys."""
        log.info("[MONGO] Fetching schema for database: '%s'", self.db_name)
        if not PYMONGO_AVAILABLE:
             return "Error: pymongo library not installed."
             
        schema_info = f"Database: {self.db_name}\n"
        
        try:
            collections = self.db.list_collection_names()
            if not collections:
                log.warning("[MONGO] No collections found in database.")
                return "No collections found in this database."
                
            log.debug("[MONGO] Found %d collection(s). Extracting sample docs.", len(collections))
            for coll_name in collections:
                schema_info += f"\nCollection: {coll_name}\n"
                sample_doc = self.db[coll_name].find_one()
                if sample_doc:
                    schema_info += "  Fields (sample):\n"
                    for key, value in sample_doc.items():
                        val_type = type(value).__name__
                        schema_info += f"    - {key} ({val_type})\n"
                else:
                    schema_info += "  (Empty collection)\n"
                    
            log.info("[MONGO] Schema fetched successfully (%d chars).", len(schema_info))
            return schema_info
        except Exception as e:
            log.error("[MONGO] Error fetching schema: %s", e, exc_info=True)
            return f"Error fetching MongoDB schema: {str(e)}"

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
            elif action == "count":
                count = collection.count_documents(query)
                results = [{"count": count}]
            else:
                raise ValueError(f"Unsupported MongoDB action: {action}")
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
            
        except Exception as e:
            raise Exception(f"MongoDB execution error: {str(e)}")
