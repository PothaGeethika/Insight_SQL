from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class PolicyContext:
    workspace_id: str
    connection_id: str
    connection_owner_id: Optional[str]
    requester_id: str
    requester_role: str
    db_type: str
    operation: str
    estimated_rows: Optional[int] = None


@dataclass
class PolicyDecision:
    action: str
    reason: str
    allow_connection_owner_auto: bool = False

