import os
import json
import urllib.parse

try:
    from elasticsearch import Elasticsearch
    ES_AVAILABLE = True
except ImportError:
    ES_AVAILABLE = False

class ElasticsearchDatabaseManager:
    """Database manager for Elasticsearch connections."""

    def __init__(self, connection_url: str):
        if not ES_AVAILABLE:
            raise ImportError("elasticsearch is not installed. Please run 'pip install elasticsearch'")
        
        self.connection_url = connection_url
        
        import urllib.parse
        parsed = urllib.parse.urlparse(connection_url)
        query_params = urllib.parse.parse_qs(parsed.query)
        
        api_key = query_params.get("api_key", [None])[0]
        cloud_id = query_params.get("cloud_id", [None])[0]
        
        index_name = parsed.path.lstrip("/")
        if "/" in index_name:
            index_name = index_name.split("/")[0]
        self.index_name = index_name.strip()
        
        if cloud_id and api_key:
            self.client = Elasticsearch(
                cloud_id=cloud_id,
                api_key=api_key
            )
        elif api_key:
            host_netloc = parsed.netloc
            if not host_netloc.startswith("http://") and not host_netloc.startswith("https://"):
                if "elastic.cloud" in host_netloc or parsed.port == 443:
                    host_url = f"https://{host_netloc}"
                else:
                    host_url = f"http://{host_netloc}"
            else:
                host_url = host_netloc
            self.client = Elasticsearch(
                host_url,
                api_key=api_key
            )
        else:
            host_netloc = parsed.netloc
            if not host_netloc.startswith("http://") and not host_netloc.startswith("https://"):
                if parsed.port == 443:
                    host_url = f"https://{host_netloc}"
                else:
                    host_url = f"http://{parsed.hostname or 'localhost'}:{parsed.port or 9200}"
            else:
                host_url = host_netloc
                
            if parsed.username and parsed.password:
                self.client = Elasticsearch(
                    [host_url],
                    basic_auth=(parsed.username, parsed.password)
                )
            else:
                self.client = Elasticsearch([host_url])

    def get_schema(self) -> str:
        """Returns the mapping schema of the index or all indices in Elasticsearch."""
        if not ES_AVAILABLE:
            return "Error: elasticsearch library not installed."
            
        try:
            schema_info = ""
            if self.index_name:
                indices = [self.index_name]
            else:
                # Get all non-system indices
                indices_info = self.client.cat.indices(format="json")
                indices = [ind["index"] for ind in indices_info if not ind["index"].startswith(".")]
                
            if not indices:
                return "No indices found in this Elasticsearch instance."
                
            for idx in indices:
                schema_info += f"\nIndex: {idx}\n"
                try:
                    mapping = self.client.indices.get_mapping(index=idx)
                    properties = mapping[idx]["mappings"].get("properties", {})
                    def get_fields(props: dict, prefix: str = "") -> list:
                        fields_list = []
                        for field, details in props.items():
                            full_name = f"{prefix}{field}"
                            field_type = details.get("type")
                            if "properties" in details:
                                fields_list.extend(get_fields(details["properties"], f"{full_name}."))
                            else:
                                fields_list.append((full_name, field_type or "object"))
                        return fields_list

                    if properties:
                        schema_info += "  Properties:\n"
                        for field_name, field_type in get_fields(properties):
                            schema_info += f"    - {field_name} ({field_type})\n"
                    else:
                        schema_info += "  (No fields mapped)\n"
                except Exception as e:
                    schema_info += f"  (Error fetching mapping: {str(e)})\n"
                    
            return schema_info
        except Exception as e:
            return f"Error fetching Elasticsearch schema: {str(e)}"

    def execute_query(self, query_json):
        """Executes an Elasticsearch query (JSON DSL query) and returns (headers, rows)."""
        if not ES_AVAILABLE:
            raise ImportError("elasticsearch package not installed.")
            
        try:
            if isinstance(query_json, str):
                query_json = query_json.strip().replace("```json", "").replace("```", "").strip()
                query_json = json.loads(query_json)
                
            index = query_json.get("index", self.index_name)
            body = query_json.get("body", query_json)
            
            # If body has 'index' wrapper, remove it
            if "body" in query_json:
                body = query_json["body"]
            else:
                # If the query itself was just the search body (e.g. {"query": {"match_all": {}}})
                body = query_json
                
            if not index:
                # Fallback to search all non-system indices if none specified
                index = "_all"
                
            search_args = {"index": index, "body": body}
            if "size" not in body:
                search_args["size"] = 100
            res = self.client.search(**search_args)
            hits = res.get("hits", {}).get("hits", [])
            
            if not hits:
                print(f"No hits returned from index {index}")
                return [], []
            else:
                print(f"Found {len(hits)} hits in index {index}. First hit: {json.dumps(hits[0])}")
                
            def flatten_dict(d: dict, parent_key: str = '', sep: str = '.') -> dict:
                items = []
                for k, v in d.items():
                    new_key = f"{parent_key}{sep}{k}" if parent_key else k
                    if isinstance(v, dict):
                        items.extend(flatten_dict(v, new_key, sep=sep).items())
                    else:
                        items.append((new_key, v))
                return dict(items)

            # Extract headers from the flattened source of hits
            headers = set()
            flat_sources = []
            for hit in hits:
                source = hit.get("_source", {})
                # If source is None or empty, fall back to empty dict
                if not source:
                    source = {}
                flat_source = flatten_dict(source)
                flat_sources.append(flat_source)
                headers.update(flat_source.keys())
                
            headers = sorted(list(headers))
            # Insert metadata fields at the front
            headers.insert(0, "_id")
            headers.insert(1, "_score")
            
            rows = []
            for hit, flat_source in zip(hits, flat_sources):
                row = []
                for header in headers:
                    if header == "_id":
                        row.append(str(hit.get("_id", "")))
                    elif header == "_score":
                        row.append(str(hit.get("_score", "")))
                    else:
                        val = flat_source.get(header, "")
                        if isinstance(val, (dict, list)):
                            row.append(json.dumps(val))
                        else:
                            row.append(str(val))
                rows.append(row)
                
            return headers, rows
        except Exception as e:
            raise Exception(f"Elasticsearch execution error: {str(e)}")
