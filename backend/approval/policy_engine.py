from __future__ import annotations

from approval.models import PolicyContext, PolicyDecision
from approval.repository import ApprovalRepository


class PolicyEngine:
    def __init__(self, repo: ApprovalRepository):
        self.repo = repo

    def evaluate(self, ctx: PolicyContext) -> PolicyDecision:
        self.repo.seed_default_policies(ctx.workspace_id)
        rules = self.repo.list_policies(ctx.workspace_id)
        for rule in rules:
            if rule.get("connection_id") and rule["connection_id"] != ctx.connection_id:
                continue
            if rule.get("db_type") and rule["db_type"] != ctx.db_type:
                continue
            if rule.get("role") and rule["role"] != ctx.requester_role:
                continue
            if rule.get("operation") and rule["operation"] != ctx.operation:
                continue
            max_rows = rule.get("max_affected_rows")
            if max_rows is not None and ctx.estimated_rows is not None and ctx.estimated_rows > int(max_rows):
                continue
            action = rule.get("action", "require_approval")
            allow_owner_auto = bool(rule.get("allow_connection_owner_auto"))
            if (
                action == "require_approval"
                and allow_owner_auto
                and ctx.connection_owner_id
                and ctx.connection_owner_id == ctx.requester_id
            ):
                return PolicyDecision(action="auto_run", reason="connection owner auto-approved", allow_connection_owner_auto=True)
            return PolicyDecision(action=action, reason="matched policy rule", allow_connection_owner_auto=allow_owner_auto)

        if ctx.operation == "READ":
            return PolicyDecision(action="auto_run", reason="default read auto-run")
        return PolicyDecision(action="require_approval", reason="safe fallback policy")
