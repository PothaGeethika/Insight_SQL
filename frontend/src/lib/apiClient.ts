/**
 * Centralised API client for backend calls.
 *
 * All requests route through /api/backend/* which Next.js proxies to the
 * FastAPI server. This means:
 *   - No hardcoded ports in browser code
 *   - Cookies are forwarded automatically (same-origin)
 *   - Works in production without CORS changes
 */

const BASE = "/api/backend";

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const data = await res.json();
      message = data?.detail || data?.message || data?.error || message;
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }

  // Some DELETE endpoints may return empty body
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

function withOrg(path: string, orgId?: string | null): string {
  if (!orgId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}org_id=${encodeURIComponent(orgId)}`;
}

// ---- Ask / stream SSE -----------------------------------------------------

export type AskStreamEvent =
  | { type: "sql"; sql?: string | null; mql?: string | null; timestamp?: string; visualization?: string | null }
  | { type: "table"; headers: string[]; rows: any[][]; connection_id?: string; database?: string; query?: string; dialect?: string }
  | { type: "results"; results: AskResultSource[] }
  | { type: "content"; data: string }
  | {
      type: "pending_approval";
      pending_approval: true;
      approval_id: string;
      operation?: string;
      risk_level?: string;
      reason?: string;
      original_prompt?: string;
      preview?: any;
      query?: string;
      connection_id?: string;
      database?: string;
      timestamp?: string;
    }
  | { type: "done"; id?: string }
  | { type: "error"; data: string };

export interface AskResultSource {
  connection_id?: string;
  database?: string;
  headers: string[];
  rows: any[][];
  query?: string;
  dialect?: string;
}

export interface AskStreamHandlers {
  onEvent?: (evt: AskStreamEvent) => void;
  onSql?: (evt: Extract<AskStreamEvent, { type: "sql" }>) => void;
  onTable?: (evt: Extract<AskStreamEvent, { type: "table" }>) => void;
  onResults?: (results: AskResultSource[]) => void;
  onContent?: (token: string) => void;
  onPendingApproval?: (
    evt: Extract<AskStreamEvent, { type: "pending_approval" }>
  ) => void;
  onDone?: (evt: Extract<AskStreamEvent, { type: "done" }>) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

export async function askStream(
  payload: object,
  handlers: AskStreamHandlers = {}
): Promise<void> {
  const res = await fetch(`${BASE}/ask/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: handlers.signal,
  });

  if (!res.ok || !res.body) {
    let message = `Streaming failed: ${res.status}`;
    try {
      const data = await res.json();
      message = data?.detail || message;
    } catch { /* ignore */ }
    handlers.onError?.(message);
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        const raw = JSON.parse(line.slice(6)) as any;
        const evt: AskStreamEvent =
          raw?.pending_approval
            ? ({ type: "pending_approval", ...raw } as AskStreamEvent)
            : (raw as AskStreamEvent);

        handlers.onEvent?.(evt);
        switch (evt.type) {
          case "sql":
            handlers.onSql?.(evt);
            break;
          case "table":
            handlers.onTable?.(evt);
            break;
          case "results":
            handlers.onResults?.(evt.results || []);
            break;
          case "content":
            handlers.onContent?.(evt.data);
            break;
          case "pending_approval":
            handlers.onPendingApproval?.(evt);
            break;
          case "done":
            handlers.onDone?.(evt);
            break;
          case "error":
            handlers.onError?.(evt.data);
            // Surface stream error to caller callback but avoid unhandled throw chains
            // that break optimistic UI flows (edit/save handlers already show toasts).
            return;
        }
      } catch (e) {
        if (e instanceof Error && e.message && !e.message.startsWith("Unexpected")) {
          // rethrow stream errors from evt.type === "error"
          if (handlers.onError) { /* already notified */ }
          throw e;
        }
        // skip malformed SSE line
      }
    }
  }
}

// ---- API surface ----------------------------------------------------------

export const api = {
  databases: {
    list: (orgId?: string | null) =>
      request<any[]>(withOrg("/databases", orgId)),
    add: (payload: object) =>
      request<any>("/databases", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: object) =>
      request<any>(`/databases/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    delete: (id: string) =>
      request<any>(`/databases/${id}`, { method: "DELETE" }),
    test: (payload: object) =>
      request<{ status: string; message: string }>("/databases/test", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    setDefault: (id: string) =>
      request<any>(`/databases/${id}/default`, { method: "PUT" }),
  },

  schema: {
    get: (connectionId: string, opts?: { refresh?: boolean }) => {
      const q = opts?.refresh ? "?refresh=true" : "";
      return request<SchemaResponse>(`/databases/${connectionId}/schema${q}`).then(
        normalizeSchemaResponse
      );
    },
    invalidate: (connectionId: string) =>
      request<{ status: string; connection_id: string }>(
        `/databases/${connectionId}/schema/invalidate`,
        { method: "POST" }
      ),
  },

  ask: (payload: object) =>
    request<any>("/ask", { method: "POST", body: JSON.stringify(payload) }),

  askStream,

  suggest: (payload: object) =>
    request<string[]>("/suggest", { method: "POST", body: JSON.stringify(payload) }),

  summarize: (payload: object) =>
    request<{ title: string }>("/summarize", { method: "POST", body: JSON.stringify(payload) }),

  dashboardGenerate: (payload: object) =>
    request<{ widgets: any[] }>("/dashboard-generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  history: {
    list: (orgId?: string | null) =>
      request<any[]>(withOrg("/history", orgId)),
    upsert: (sessionId: string, body: object) =>
      request<any>(`/history/${sessionId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (sessionId: string) =>
      request<any>(`/history/${sessionId}`, { method: "DELETE" }),
  },

  savedQueries: {
    list: (orgId?: string | null) =>
      request<any[]>(withOrg("/saved-queries", orgId)),
    save: (body: object) =>
      request<any>("/saved-queries", { method: "POST", body: JSON.stringify(body) }),
    delete: (queryId: string) =>
      request<any>(`/saved-queries/${queryId}`, { method: "DELETE" }),
  },

  projects: {
    list: (orgId?: string | null) =>
      request<any[]>(withOrg("/projects", orgId)),
    create: (body: object) =>
      request<any>("/projects", { method: "POST", body: JSON.stringify(body) }),
    update: (projectId: string, body: object) =>
      request<any>(`/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (projectId: string) =>
      request<any>(`/projects/${projectId}`, { method: "DELETE" }),
  },

  orgs: {
    list: () => request<OrgSummary[]>("/orgs"),
    create: (name: string) =>
      request<OrgSummary>("/orgs", { method: "POST", body: JSON.stringify({ name }) }),
    update: (orgId: string, name: string) =>
      request<OrgSummary>(`/orgs/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    delete: (orgId: string) =>
      request<any>(`/orgs/${orgId}`, { method: "DELETE" }),
    members: (orgId: string) =>
      request<any[]>(`/orgs/${orgId}/members`),
    updateMember: (orgId: string, userId: string, role: string) =>
      request<any>(`/orgs/${orgId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    removeMember: (orgId: string, userId: string) =>
      request<any>(`/orgs/${orgId}/members/${userId}`, { method: "DELETE" }),
    invites: (orgId: string) =>
      request<any[]>(`/orgs/${orgId}/invites`),
    createInvite: (orgId: string, email: string, role = "member") =>
      request<any>(`/orgs/${orgId}/invites`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    revokeInvite: (orgId: string, inviteId: string) =>
      request<any>(`/orgs/${orgId}/invites/${inviteId}`, { method: "DELETE" }),
    acceptInvite: (token: string) =>
      request<{ status: string; org_id: string }>("/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
  },

  billing: {
    subscription: () => request<any>("/billing/subscription"),
    checkout: (plan: string) =>
      request<{ url: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      }),
    portal: () =>
      request<{ url: string }>("/billing/portal", { method: "POST", body: "{}" }),
  },

  dashboards: {
    list: (orgId?: string | null) =>
      request<any[]>(withOrg("/dashboards", orgId)),
    get: (id: string) => request<any>(`/dashboards/${id}`),
    create: (body: object) =>
      request<any>("/dashboards", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: object) =>
      request<any>(`/dashboards/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<any>(`/dashboards/${id}`, { method: "DELETE" }),
  },

  health: () => request<{ status: string }>("/health"),

  approvals: {
    list: (orgId?: string | null, status?: string | null) => {
      let path = withOrg("/approvals", orgId);
      if (status) {
        const sep = path.includes("?") ? "&" : "?";
        path = `${path}${sep}status=${encodeURIComponent(status)}`;
      }
      return request<any[]>(path);
    },
    mine: (status?: string | null) => {
      let path = "/approvals/mine";
      if (status) path = `${path}?status=${encodeURIComponent(status)}`;
      return request<any[]>(path);
    },
    approve: (id: string, body?: { comment?: string }) =>
      request<any>(`/approvals/${id}/approve`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    reject: (id: string, body?: { comment?: string }) =>
      request<any>(`/approvals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean; id: string }>(`/approvals/${id}`, {
        method: "DELETE",
      }),
    bulkDelete: (body: { ids?: string[]; status?: string; org_id?: string | null }) =>
      request<{ deleted: number }>("/approvals/bulk-delete", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    /**
     * SSE stream for approval lifecycle events.
     * Caller must close() the returned EventSource.
     */
    stream: (handlers: {
      orgId?: string | null;
      onEvent?: (evt: { type: string; [k: string]: any }) => void;
      onError?: (e: any) => void;
    }) => {
      const path = withOrg("/approvals/stream", handlers.orgId);
      const es = new EventSource(`${BASE}${path}`);
      const handle = (type: string) => (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handlers.onEvent?.({ type, ...data });
        } catch {
          handlers.onEvent?.({ type, data: e.data });
        }
      };
      es.addEventListener("approval_created", handle("approval_created"));
      es.addEventListener("approval_resolved", handle("approval_resolved"));
      es.addEventListener("execution_complete", handle("execution_complete"));
      es.onerror = (e) => handlers.onError?.(e);
      return es;
    },
  },

  audit: {
    list: (orgId?: string | null) => request<any[]>(withOrg("/audit", orgId)),
  },
};

// ---- Shared types ---------------------------------------------------------

export interface OrgSummary {
  id: string;
  name: string;
  slug?: string;
  owner_id?: string;
  role: string;
}

export interface SchemaColumn {
  name: string;
  type?: string;
  nullable?: boolean;
  primary_key?: boolean;
}

export interface SchemaTable {
  name: string;
  columns?: SchemaColumn[];
  type?: string; // table | collection | label | index
}

/** Backend GET /databases/{id}/schema body (plus normalized `tables` for UI). */
export interface SchemaResponse {
  connection_id?: string;
  database?: string;
  dialect?: string;
  /** Structured schema document from backend */
  schema?: {
    dialect?: string;
    database?: string;
    tables?: SchemaTable[];
    collections?: SchemaTable[];
    indices?: SchemaTable[];
    indexes?: SchemaTable[];
    nodes?: SchemaTable[];
    relationships?: Array<{ name: string; type?: string }>;
    [key: string]: unknown;
  } | null;
  schema_text?: string;
  cached?: boolean;
  /** Normalized entity list for the schema explorer */
  tables?: SchemaTable[];
  /** @deprecated use dialect */
  db_type?: string;
  /** @deprecated use schema_text */
  raw?: string;
}

/** Flatten structured schema into explorer-friendly table/collection rows. */
export function tablesFromSchema(data: SchemaResponse | null | undefined): SchemaTable[] {
  if (!data) return [];
  if (data.tables?.length) return data.tables;
  const s = data.schema;
  if (!s || typeof s !== "object") return [];
  const out: SchemaTable[] = [];
  const push = (items: SchemaTable[] | undefined, type: string) => {
    for (const item of items || []) {
      out.push({
        name: item.name,
        columns: item.columns,
        type: item.type || type,
      });
    }
  };
  push(s.tables, "table");
  push(s.collections, "collection");
  push(s.indices || s.indexes, "index");
  push(s.nodes, "label");
  for (const rel of s.relationships || []) {
    if (rel?.name) out.push({ name: rel.name, type: rel.type || "relationship", columns: [] });
  }
  return out;
}

function normalizeSchemaResponse(data: SchemaResponse): SchemaResponse {
  const tables = tablesFromSchema(data);
  return {
    ...data,
    dialect: data.dialect || data.db_type || data.schema?.dialect,
    db_type: data.dialect || data.db_type,
    schema_text: data.schema_text || data.raw,
    tables,
  };
}
