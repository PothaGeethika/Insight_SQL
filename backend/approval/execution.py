from __future__ import annotations

import time
from adapters.base import OperationKind


class ExecutionEngine:
    def run(self, adapter, plan):
        start = time.perf_counter()
        tx = adapter.begin_transaction()
        try:
            if plan.operation == OperationKind.READ:
                headers, rows = adapter.execute_read(plan.raw_query)
            else:
                headers, rows = adapter.execute_write(plan.raw_query)
            adapter.commit(tx)
            duration_ms = int((time.perf_counter() - start) * 1000)
            return {"headers": headers, "rows": rows, "duration_ms": duration_ms}
        except Exception:
            adapter.abort(tx)
            raise
