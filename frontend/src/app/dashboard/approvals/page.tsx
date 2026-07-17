"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/apiClient";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";
import { Trash2, RefreshCw, Filter } from "lucide-react";

type ApprovalRow = {
  id: string;
  workspace_id?: string;
  connection_id?: string;
  db_type?: string;
  operation?: string;
  requester_id?: string;
  requester_role?: string;
  query?: string;
  original_prompt?: string;
  risk_level?: string;
  reason?: string;
  status?: string;
  approver_id?: string;
  result_json?: string;
  error?: string;
  created_at?: number;
  updated_at?: number;
  executed_at?: number;
  expires_at?: number;
};

const STATUSES = ["all", "pending", "approved", "rejected", "failed", "expired"] as const;

function fmtTime(ts?: number | null) {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return "—";
  }
}

function shortText(s?: string | null, n = 80) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default function ApprovalsPage() {
  const { activeOrgId, canManage, refreshPendingApprovals } = useWorkspace();
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [opFilter, setOpFilter] = useState<string>("all");
  const [dbFilter, setDbFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.approvals.list(
        activeOrgId || undefined,
        statusFilter === "all" ? undefined : statusFilter
      );
      setItems(rows || []);
      setSelected(new Set());
    } catch (err) {
      setItems([]);
      const msg = err instanceof Error ? err.message : "Failed to load approvals.";
      setError(
        msg.includes("500")
          ? "Backend unavailable. Restart the FastAPI server, then refresh."
          : msg
      );
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const dbTypes = useMemo(
    () => Array.from(new Set(items.map((i) => i.db_type).filter(Boolean))) as string[],
    [items]
  );
  const ops = useMemo(
    () => Array.from(new Set(items.map((i) => i.operation).filter(Boolean))) as string[],
    [items]
  );

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (opFilter !== "all" && row.operation !== opFilter) return false;
      if (dbFilter !== "all" && row.db_type !== dbFilter) return false;
      if (userFilter.trim()) {
        const q = userFilter.trim().toLowerCase();
        const hay = `${row.requester_id || ""} ${row.approver_id || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom).getTime() / 1000;
        if ((row.created_at || 0) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo).getTime() / 1000 + 86400;
        if ((row.created_at || 0) > to) return false;
      }
      return true;
    });
  }, [items, opFilter, dbFilter, userFilter, dateFrom, dateTo]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const resolve = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      if (action === "approve") await api.approvals.approve(id);
      else await api.approvals.reject(id);
      toast.success(action === "approve" ? "Approved & executed" : "Rejected");
      await load();
      void refreshPendingApprovals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setBusyId(null);
    }
  };

  const deleteOne = async (id: string) => {
    if (!confirm("Delete this approval record?")) return;
    try {
      await api.approvals.delete(id);
      toast.success("Deleted");
      await load();
      void refreshPendingApprovals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected record(s)?`)) return;
    try {
      await api.approvals.bulkDelete({
        ids: Array.from(selected),
        org_id: activeOrgId || undefined,
      });
      toast.success("Deleted selected");
      await load();
      void refreshPendingApprovals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    }
  };

  const deleteByStatus = async (status: string) => {
    if (!activeOrgId) {
      toast.error("Select a workspace first");
      return;
    }
    if (!confirm(`Delete all ${status} records in this workspace?`)) return;
    try {
      const res = await api.approvals.bulkDelete({ status, org_id: activeOrgId });
      toast.success(`Deleted ${res.deleted} record(s)`);
      await load();
      void refreshPendingApprovals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cleanup failed");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Approval History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audit trail for schema and write approvals. Approve pending requests in chat when possible.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded border border-border hover:bg-muted"
          onClick={() => void load()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="rounded-xl border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                Status: {s}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={opFilter}
            onChange={(e) => setOpFilter(e.target.value)}
          >
            <option value="all">Query type: all</option>
            {ops.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={dbFilter}
            onChange={(e) => setDbFilter(e.target.value)}
          >
            <option value="all">Database: all</option>
            {dbTypes.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            className="h-9 rounded-md border bg-background px-2 text-sm"
            placeholder="User id"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          />
          <input
            type="date"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={selected.size === 0}
              className="text-xs px-2.5 py-1.5 rounded border disabled:opacity-40 hover:bg-muted"
              onClick={() => void deleteSelected()}
            >
              Delete selected ({selected.size})
            </button>
            <button
              type="button"
              className="text-xs px-2.5 py-1.5 rounded border hover:bg-muted"
              onClick={() => void deleteByStatus("approved")}
            >
              Delete all approved
            </button>
            <button
              type="button"
              className="text-xs px-2.5 py-1.5 rounded border hover:bg-muted"
              onClick={() => void deleteByStatus("rejected")}
            >
              Delete all rejected
            </button>
            <button
              type="button"
              className="text-xs px-2.5 py-1.5 rounded border hover:bg-muted"
              onClick={() => void deleteByStatus("expired")}
            >
              Delete expired
            </button>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading approval history…</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">No approval records match these filters.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                  />
                </th>
                <th className="p-2">Status</th>
                <th className="p-2">Type</th>
                <th className="p-2">Risk</th>
                <th className="p-2">Prompt</th>
                <th className="p-2">SQL</th>
                <th className="p-2">DB</th>
                <th className="p-2">Requested</th>
                <th className="p-2">Executed</th>
                <th className="p-2">By</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t align-top">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td className="p-2 capitalize whitespace-nowrap">{item.status || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{item.operation || "—"}</td>
                  <td className="p-2 whitespace-nowrap">{item.risk_level || "—"}</td>
                  <td className="p-2 max-w-[180px]" title={item.original_prompt || ""}>
                    {shortText(item.original_prompt, 60)}
                  </td>
                  <td className="p-2 max-w-[220px]">
                    <pre className="text-[11px] whitespace-pre-wrap font-mono">{shortText(item.query, 100)}</pre>
                  </td>
                  <td className="p-2 whitespace-nowrap">{item.db_type || "—"}</td>
                  <td className="p-2 whitespace-nowrap text-xs">{fmtTime(item.created_at)}</td>
                  <td className="p-2 whitespace-nowrap text-xs">{fmtTime(item.executed_at)}</td>
                  <td className="p-2 text-xs max-w-[100px] truncate" title={item.approver_id || item.requester_id}>
                    {item.approver_id || item.requester_id || "—"}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1 min-w-[110px]">
                      {item.status === "pending" && canManage && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            className="px-2 py-1 rounded bg-emerald-600 text-white text-xs disabled:opacity-50"
                            onClick={() => void resolve(item.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-50"
                            onClick={() => void resolve(item.id, "reject")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded border text-xs hover:bg-muted"
                          onClick={() => void deleteOne(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
