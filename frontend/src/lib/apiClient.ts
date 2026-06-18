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

  return res.json() as Promise<T>;
}

// ---- Database connections ------------------------------------------------

export const api = {
  databases: {
    list: () => request<any[]>("/databases"),
    add: (payload: object) => request<any>("/databases", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: object) => request<any>(`/databases/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    delete: (id: string) => request<any>(`/databases/${id}`, { method: "DELETE" }),
    test: (payload: object) => request<{ status: string; message: string }>("/databases/test", { method: "POST", body: JSON.stringify(payload) }),
    setDefault: (id: string) => request<any>(`/databases/${id}/default`, { method: "PUT" }),
  },
  ask: (payload: object) => request<any>("/ask", { method: "POST", body: JSON.stringify(payload) }),
  suggest: (payload: object) => request<string[]>("/suggest", { method: "POST", body: JSON.stringify(payload) }),
  summarize: (payload: object) => request<{ title: string }>("/summarize", { method: "POST", body: JSON.stringify(payload) }),
  dashboardGenerate: (payload: object) => request<{ widgets: any[] }>("/dashboard-generate", { method: "POST", body: JSON.stringify(payload) }),
  health: () => request<{ status: string }>("/health"),
};
