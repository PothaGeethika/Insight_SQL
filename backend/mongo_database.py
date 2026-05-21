import os
import json
from pymongo import MongoClient
from bson import json_util
try:
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False

class MongoDatabaseManager:
    def __init__(self, connection_url):
        if not PYMONGO_AVAILABLE:
            raise ImportError("pymongo is not installed. Please run 'pip install pymongo'")
        self.connection_url = connection_url
        self.client = MongoClient(self.connection_url)
        # Extract database name from connection URL
        self.db_name = self.connection_url.split('/')[-1].split('?')[0]
        self.db = self.client[self.db_name]

    def get_schema(self):
        """Returns the schema of the MongoDB database by listing collections and sample keys."""
        if not PYMONGO_AVAILABLE:
             return "Error: pymongo library not installed."
             
        schema_info = f"Database: {self.db_name}\n"
        
        try:
            collections = self.db.list_collection_names()
            if not collections:
                return "No collections found in this database."
                
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
                    
            return schema_info
        except Exception as e:
            return f"Error fetching MongoDB schema: {str(e)}"

    def execute_query(self, mql_json):
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
                
            collection = self.db[collection_name]
            
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
