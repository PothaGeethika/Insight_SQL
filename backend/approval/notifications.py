from __future__ import annotations

import json
import queue
from collections import defaultdict


class NotificationHub:
    def __init__(self) -> None:
        self._subs: dict[str, list[queue.Queue]] = defaultdict(list)

    def subscribe(self, workspace_id: str) -> queue.Queue:
        q: queue.Queue = queue.Queue()
        self._subs[workspace_id].append(q)
        return q

    def unsubscribe(self, workspace_id: str, q: queue.Queue) -> None:
        if workspace_id in self._subs and q in self._subs[workspace_id]:
            self._subs[workspace_id].remove(q)

    def emit(self, workspace_id: str, event_type: str, payload: dict) -> None:
        message = {"event": event_type, **payload}
        for q in list(self._subs.get(workspace_id, [])):
            q.put_nowait(f"event: {event_type}\ndata: {json.dumps(message)}\n\n")
