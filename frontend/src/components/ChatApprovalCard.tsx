"use client";

import { useState } from "react";
import { AlertTriangle, Check, X, Code2, Loader2 } from "lucide-react";

export type ChatApprovalState = {
  id: string;
  status: "pending" | "approved" | "rejected" | "failed";
  operation?: string;
  connection_id?: string;
  database?: string;
  query?: string;
  original_prompt?: string;
  risk_level?: string;
  reason?: string;
  busy?: boolean;
  error?: string;
};

type Props = {
  approval: ChatApprovalState;
  onApprove: () => void;
  onReject: () => void;
  canApprove?: boolean;
};

export function ChatApprovalCard({ approval, onApprove, onReject, canApprove = true }: Props) {
  const [showSql, setShowSql] = useState(true);
  const op = (approval.operation || "QUERY").toUpperCase();
  const pending = approval.status === "pending";
  const approved = approval.status === "approved";
  const rejected = approval.status === "rejected";
  const failed = approval.status === "failed";

  const border =
    pending
      ? "border-amber-500/40 bg-amber-500/10"
      : approved
        ? "border-emerald-500/40 bg-emerald-500/10"
        : failed
          ? "border-red-500/40 bg-red-500/10"
          : "border-slate-500/40 bg-slate-500/10";

  return (
    <div className={`mt-3 rounded-xl border ${border} px-4 py-3 text-sm space-y-3`}>
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={`h-4 w-4 mt-0.5 shrink-0 ${
            pending ? "text-amber-500" : approved ? "text-emerald-500" : "text-red-500"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {pending && "Database query requires approval"}
            {approved && "Query approved & executed"}
            {rejected && "Query rejected"}
            {failed && "Execution failed"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {op}
            {approval.database ? ` · ${approval.database}` : ""}
            {approval.risk_level ? ` · Risk: ${approval.risk_level}` : ""}
            {" · "}
            Status:{" "}
            <span className="font-medium capitalize">{approval.status.replace("_", " ")}</span>
          </p>
        </div>
      </div>

      {approval.original_prompt && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Prompt</p>
          <p className="text-sm text-foreground/90">{approval.original_prompt}</p>
        </div>
      )}

      {approval.reason && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Reason</p>
          <p className="text-sm text-foreground/80">{approval.reason}</p>
        </div>
      )}

      {(approval.query || showSql) && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Generated SQL</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowSql((v) => !v)}
            >
              <Code2 className="h-3 w-3" />
              {showSql ? "Hide SQL" : "View SQL"}
            </button>
          </div>
          {showSql && approval.query && (
            <pre className="text-xs whitespace-pre-wrap rounded-lg bg-black/30 border border-white/10 p-3 overflow-x-auto font-mono">
              {approval.query}
            </pre>
          )}
        </div>
      )}

      {failed && approval.error && (
        <p className="text-xs text-red-400">
          <span className="font-medium">Reason:</span> {approval.error}
        </p>
      )}

      {approved && (
        <p className="text-xs text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Successfully applied to the database.
        </p>
      )}

      {rejected && (
        <p className="text-xs text-muted-foreground">The SQL statement was not executed.</p>
      )}

      {pending && canApprove && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={approval.busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-50"
            onClick={onApprove}
          >
            {approval.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {approval.busy ? "Executing…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={approval.busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium disabled:opacity-50"
            onClick={onReject}
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
          {approval.query && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background/50 text-xs font-medium hover:bg-muted"
              onClick={() => setShowSql((v) => !v)}
            >
              <Code2 className="h-3.5 w-3.5" />
              View SQL
            </button>
          )}
        </div>
      )}
      {pending && !canApprove && (
        <p className="text-xs text-muted-foreground">
          Waiting for a workspace owner or admin to approve this query.
        </p>
      )}
    </div>
  );
}
