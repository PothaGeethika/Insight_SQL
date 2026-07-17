from __future__ import annotations

from typing import Callable
from adapters.base import DatabaseAdapter, AdapterNotImplementedError


class AdapterFactory:
    _registry: dict[str, Callable] = {}

    @classmethod
    def register(cls, db_type: str, constructor: Callable) -> None:
        cls._registry[db_type.lower()] = constructor

    @classmethod
    def create(cls, connection) -> DatabaseAdapter:
        db_type = (getattr(connection, "type", "") or "").lower()
        if db_type not in cls._registry:
            raise AdapterNotImplementedError(f"Adapter not implemented for db_type='{db_type}'")
        return cls._registry[db_type](connection)
