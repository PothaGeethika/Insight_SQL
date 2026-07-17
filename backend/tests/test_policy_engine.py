from approval.policy_engine import PolicyEngine
from approval.models import PolicyContext


class _Repo:
    def seed_default_policies(self, workspace_id):
        return None

    def list_policies(self, workspace_id):
        return [
            {"role": "viewer", "operation": "WRITE", "action": "deny", "allow_connection_owner_auto": 0},
            {"operation": "READ", "action": "auto_run", "allow_connection_owner_auto": 0},
            {"operation": "WRITE", "action": "require_approval", "allow_connection_owner_auto": 1},
        ]


def test_policy_viewer_denied_write():
    engine = PolicyEngine(_Repo())
    decision = engine.evaluate(
        PolicyContext(
            workspace_id="w1",
            connection_id="c1",
            connection_owner_id="u1",
            requester_id="u2",
            requester_role="viewer",
            db_type="postgresql",
            operation="WRITE",
            estimated_rows=2,
        )
    )
    assert decision.action == "deny"


def test_policy_connection_owner_auto():
    engine = PolicyEngine(_Repo())
    decision = engine.evaluate(
        PolicyContext(
            workspace_id="w1",
            connection_id="c1",
            connection_owner_id="u1",
            requester_id="u1",
            requester_role="member",
            db_type="postgresql",
            operation="WRITE",
        )
    )
    assert decision.action == "auto_run"
