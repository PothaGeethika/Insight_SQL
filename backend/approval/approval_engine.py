from __future__ import annotations

import json
import time
from approval.repository import ApprovalRepository
from approval.execution import ExecutionEngine


class ApprovalEngine:
    def __init__(self, repo: ApprovalRepository, executor: ExecutionEngine):
        self.repo = repo
        self.executor = executor

    def create_request(self, payload: dict) -> dict:
        return self.repo.create_request(payload)

    def approve(self, request_id: str, approver_id: str, adapter, plan, comment: str | None = None) -> dict:
        req = self.repo.get_request(request_id)
        if not req:
            raise ValueError("Approval request not found")
        if req["status"] != "pending":
            raise ValueError("Approval request already resolved")
        exec_result = self.executor.run(adapter, plan)
        resolved = self.repo.resolve_request(
            request_id=request_id,
            status="approved",
            approver_id=approver_id,
            comment=comment,
            result_json=json.dumps(exec_result),
            error=None,
            executed_at=time.time(),
        )
        self.repo.add_audit(
            {
                "request_id": request_id,
                "workspace_id": req["workspace_id"],
                "connection_id": req["connection_id"],
                "db_type": req["db_type"],
                "operation": req["operation"],
                "requester_id": req["requester_id"],
                "approver_id": approver_id,
                "query": req["query"],
                "status": "approved",
                "result_json": json.dumps(exec_result),
                "duration_ms": exec_result.get("duration_ms"),
            }
        )
        return {**resolved, "execution": exec_result}

    def reject(self, request_id: str, approver_id: str, comment: str | None = None) -> dict:
        req = self.repo.get_request(request_id)
        if not req:
            raise ValueError("Approval request not found")
        resolved = self.repo.resolve_request(
            request_id=request_id,
            status="rejected",
            approver_id=approver_id,
            comment=comment,
            result_json=None,
            error="rejected",
        )
        self.repo.add_audit(
            {
                "request_id": request_id,
                "workspace_id": req["workspace_id"],
                "connection_id": req["connection_id"],
                "db_type": req["db_type"],
                "operation": req["operation"],
                "requester_id": req["requester_id"],
                "approver_id": approver_id,
                "query": req["query"],
                "status": "rejected",
                "error": "rejected",
            }
        )
        return resolved
