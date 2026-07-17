from __future__ import annotations

import json
import re
from adapters.base import OperationKind, QueryPlan

_SCHEMA = re.compile(r"\b(CREATE|ALTER|DROP|TRUNCATE|RENAME)\b", re.IGNORECASE)
_ADMIN = re.compile(r"\b(GRANT|REVOKE|VACUUM|ANALYZE|REINDEX|CLUSTER)\b", re.IGNORECASE)
_WRITE = re.compile(r"\b(INSERT|UPDATE|DELETE|MERGE|REPLACE|UPSERT)\b", re.IGNORECASE)

_MONGO_READ = {"find", "aggregate", "count", "countdocuments", "distinct"}
_MONGO_WRITE = {"insertone", "insertmany", "updateone", "updatemany", "deleteone", "deletemany", "replaceone"}
_MONGO_SCHEMA = {"createcollection", "drop", "dropdatabase", "createindex", "dropindex"}


class OperationClassifier:
    @staticmethod
    def classify(query: str, db_type: str) -> QueryPlan:
        q = (query or "").strip()
        dtype = (db_type or "").lower()
        normalized = " ".join(q.split())
        operation = OperationKind.READ
        risk = "low"

        if dtype == "mongodb":
            operation = OperationClassifier._classify_mongo(q)
        elif dtype == "elasticsearch":
            operation = OperationClassifier._classify_es(q)
        elif dtype == "neo4j":
            operation = OperationClassifier._classify_cypher(q)
        else:
            upper = normalized.upper()
            if _SCHEMA.search(upper):
                operation = OperationKind.SCHEMA
            elif _ADMIN.search(upper):
                operation = OperationKind.ADMIN
            elif _WRITE.search(upper):
                operation = OperationKind.WRITE
            else:
                operation = OperationKind.READ

        if operation in (OperationKind.WRITE, OperationKind.SCHEMA, OperationKind.ADMIN):
            risk = "high" if operation != OperationKind.WRITE else "medium"

        return QueryPlan(
            dialect=dtype or "unknown",
            operation=operation,
            raw_query=q,
            normalized_query=normalized,
            risk=risk,
        )

    @staticmethod
    def _classify_mongo(query: str) -> OperationKind:
        action = ""
        try:
            payload = json.loads(query)
            action = str(payload.get("action", "")).lower()
        except Exception:
            pass
        if action in _MONGO_SCHEMA:
            return OperationKind.SCHEMA
        if action in _MONGO_WRITE:
            return OperationKind.WRITE
        if action in _MONGO_READ:
            return OperationKind.READ
        return OperationKind.READ

    @staticmethod
    def _classify_es(query: str) -> OperationKind:
        q = query.lower()
        if "put_mapping" in q or "create_index" in q or "delete_index" in q:
            return OperationKind.SCHEMA
        if "search" in q:
            return OperationKind.READ
        if any(x in q for x in ("index", "update", "delete", "bulk")):
            return OperationKind.WRITE
        return OperationKind.READ

    @staticmethod
    def _classify_cypher(query: str) -> OperationKind:
        q = query.upper()
        if any(k in q for k in ("CREATE ", "MERGE ", "DELETE ", "SET ", "REMOVE ")):
            return OperationKind.WRITE
        if any(k in q for k in ("DROP ", "CREATE CONSTRAINT", "CREATE INDEX")):
            return OperationKind.SCHEMA
        return OperationKind.READ
