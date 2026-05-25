import os
import json
import urllib.parse
import time
from logger_config import get_logger

log = get_logger("elastic")

try:
    from elasticsearch import Elasticsearch
    ES_AVAILABLE = True
except ImportError:
    ES_AVAILABLE = False

class ElasticsearchDatabaseManager:
    """Database manager for Elasticsearch connections."""

    def __init__(self, connection_url: str):
        log.info("[ELASTIC] Initialising ElasticsearchDatabaseManager")
        if not ES_AVAILABLE:
            log.error("[ELASTIC] elasticsearch is not installed.")
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
        log.info("[ELASTIC] Fetching schema for indices")
        if not ES_AVAILABLE:
            return "Error: elasticsearch library not installed."

        try:
            t0 = time.perf_counter()
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
                    
            elapsed = time.perf_counter() - t0
            log.info("[ELASTIC] Schema fetched in %.2fs", elapsed)
            return schema_info
        except Exception as e:
            log.error("[ELASTIC] Error fetching schema: %s", e, exc_info=True)
            return f"Error fetching Elasticsearch schema: {str(e)}"

    def execute_query(self, es_query_json: str):
        log.info("[ELASTIC] Executing Elasticsearch query")
        if not ES_AVAILABLE:
            raise ImportError("elasticsearch package not installed.")
            
        try:
            if isinstance(es_query_json, str):
                es_query_json = es_query_json.strip().replace("```json", "").replace("```", "").strip()
                log.debug("[ELASTIC] Raw DSL Query:\n%s", es_query_json)
                es_query = json.loads(es_query_json)
            else:
                es_query = es_query_json

            index = es_query.get("index") or self.index_name
            if not index:
                raise ValueError("An 'index' must be specified in the query JSON if not provided in connection.")

            log.info("[ELASTIC] Searching index='%s'", index)
            if "index" in es_query:
                del es_query["index"]

            t0 = time.perf_counter()
            result = self.client.search(index=index, body=es_query)
            elapsed = time.perf_counter() - t0
            
            hits = result.get("hits", {}).get("hits", [])
            
            if not hits:
                log.info("[ELASTIC] Search completed in %.3fs – returned 0 hits.", elapsed)
                return [], []
            
            log.info("[ELASTIC] Search completed in %.3fs – returned %d hit(s).", elapsed, len(hits))
                
            def flatten_dict(d: dict, parent_key: str = '', sep: str = '.') -> dict:
                items = []
                for k, v in d.items():
                    new_key = f"{parent_key}{sep}{k}" if parent_key else k
                    if isinstance(v, dict):
                        items.extend(flatten_dict(v, new_key, sep=sep).items())
                    else:
                        items.append((new_key, v))
                return dict(items)

            headers = set()
            flat_sources = []
            for hit in hits:
                source = hit.get("_source", {})
                if not source:
                    source = {}
                flat_source = flatten_dict(source)
                flat_sources.append(flat_source)
                headers.update(flat_source.keys())
                
            headers = sorted(list(headers))
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
                
            if "aggregations" in result:
                log.info("[ELASTIC] Processing aggregations.")
                agg_data = result["aggregations"]
                
                def extract_aggs(aggs, prefix=""):
                    rows = []
                    for agg_name, agg_value in aggs.items():
                        if "buckets" in agg_value:
                            for bucket in agg_value["buckets"]:
                                key = bucket.get("key_as_string", bucket.get("key"))
                                doc_count = bucket.get("doc_count")
                                rows.append([f"{prefix}{agg_name}:{key}", doc_count])
                        elif "value" in agg_value:
                            rows.append([f"{prefix}{agg_name}", agg_value["value"]])
                    return rows

                agg_rows = extract_aggs(agg_data)
                if agg_rows:
                    log.info("[ELASTIC] Found %d aggregation bucket(s).", len(agg_rows))
                    return ["Aggregation_Key", "Value"], agg_rows

            log.info("[ELASTIC] Query execution successful – %d row(s) matched.", len(rows))
            return headers, rows
        except Exception as e:
            log.error("[ELASTIC] Execution error: %s", e, exc_info=True)
            raise Exception(f"Elasticsearch query error: {str(e)}")
