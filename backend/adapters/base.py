from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class OperationKind(str, Enum):
    READ = "READ"
    WRITE = "WRITE"
    SCHEMA = "SCHEMA"
    ADMIN = "ADMIN"


@dataclass
class QueryPlan:
    dialect: str
    operation: OperationKind
    raw_query: str
    normalized_query: str
    objects: list[str] = field(default_factory=list)
    risk: str = "low"


@dataclass
class PreviewResult:
    kind: str
    before_rows: Optional[list[dict[str, Any]]] = None
    after_rows: Optional[list[dict[str, Any]]] = None
    objects: Optional[list[str]] = None
    diff: Optional[dict[str, Any]] = None
    estimated_rows: Optional[int] = None


@dataclass
class CapabilityFlags:
    transactions: bool = False
    ddl: bool = True
    rollback: bool = False
    list_schema: bool = True


class AdapterNotImplementedError(NotImplementedError):
    pass


class DatabaseAdapter(ABC):
    db_type: str = "unknown"

    def classify_operation(self, query: str) -> QueryPlan:
        from adapters.classifier import OperationClassifier
        return OperationClassifier.classify(query, self.db_type)

    @abstractmethod
    def execute_read(self, query: str) -> tuple[list[str], list[list[Any]]]:
        raise NotImplementedError

    @abstractmethod
    def execute_write(self, query: str) -> tuple[list[str], list[list[Any]]]:
        raise NotImplementedError

    @abstractmethod
    def get_schema(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_schema_structured(self) -> dict[str, Any]:
        raise NotImplementedError

    def begin_transaction(self) -> Any:
        return None

    def commit(self, tx: Any = None) -> None:
        return None

    def abort(self, tx: Any = None) -> None:
        return None

    def estimate_affected_rows(self, query: str) -> Optional[int]:
        return None

    def generate_preview(self, plan: QueryPlan) -> PreviewResult:
        return PreviewResult(kind=plan.operation.value, estimated_rows=self.estimate_affected_rows(plan.raw_query))

    def capabilities(self) -> CapabilityFlags:
        return CapabilityFlags()
