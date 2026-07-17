"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, type OrgSummary } from "@/lib/apiClient";

const STORAGE_KEY = "insight_active_org_id";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer" | string;

interface WorkspaceContextValue {
  orgs: OrgSummary[];
  activeOrgId: string | null;
  activeOrg: OrgSummary | null;
  role: WorkspaceRole | null;
  /** True when role is owner or admin (can invite, delete, etc.) */
  canManage: boolean;
  /** True when role is not viewer (and not null in personal context without org) */
  canEdit: boolean;
  loading: boolean;
  pendingInviteCount: number;
  pendingApprovalCount: number;
  setActiveOrgId: (orgId: string | null) => void;
  refreshOrgs: () => Promise<OrgSummary[]>;
  refreshPendingInvites: () => Promise<void>;
  refreshPendingApprovals: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrgId(orgId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (orgId) localStorage.setItem(STORAGE_KEY, orgId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const orgsRef = useRef<OrgSummary[]>([]);
  orgsRef.current = orgs;

  const setActiveOrgId = useCallback((orgId: string | null) => {
    setActiveOrgIdState(orgId);
    writeStoredOrgId(orgId);
  }, []);

  // Stable callback — read orgs from ref so it does not recreate when orgs change
  // (that recreation previously caused an infinite refreshOrgs loop).
  const refreshPendingInvites = useCallback(async (orgList?: OrgSummary[]) => {
    const list = orgList ?? orgsRef.current;
    const manageable = list.filter(
      (o) => o.role === "owner" || o.role === "admin"
    );
    if (manageable.length === 0) {
      setPendingInviteCount(0);
      return;
    }
    try {
      const results = await Promise.all(
        manageable.map((o) =>
          api.orgs.invites(o.id).catch(() => [] as any[])
        )
      );
      const count = results.reduce((sum, invites) => sum + (invites?.length || 0), 0);
      setPendingInviteCount(count);
    } catch {
      setPendingInviteCount(0);
    }
  }, []);

  const refreshPendingApprovals = useCallback(async (orgList?: OrgSummary[]) => {
    const list = orgList ?? orgsRef.current;
    const manageable = list.filter((o) => o.role === "owner" || o.role === "admin");
    if (manageable.length === 0) {
      setPendingApprovalCount(0);
      return;
    }
    try {
      const results = await Promise.all(
        manageable.map((o) => api.approvals.list(o.id, "pending").catch(() => [] as any[]))
      );
      const count = results.reduce(
        (sum, approvals) =>
          sum + (approvals?.filter((a) => a?.status === "pending")?.length || 0),
        0
      );
      setPendingApprovalCount(count);
    } catch {
      setPendingApprovalCount(0);
    }
  }, []);

  const refreshOrgs = useCallback(async () => {
    try {
      const data = await api.orgs.list();
      setOrgs(Array.isArray(data) ? data : []);

      const stored = readStoredOrgId();
      const validStored = stored && data.some((o) => o.id === stored) ? stored : null;
      const personal = data.find(
        (o) =>
          o.name === "Personal Workspace" ||
          o.name?.toLowerCase() === "personal" ||
          o.slug === "personal"
      );
      const nextId = validStored || personal?.id || data[0]?.id || null;
      setActiveOrgIdState(nextId);
      writeStoredOrgId(nextId);

      await refreshPendingInvites(data);
      await refreshPendingApprovals(data);
      return data;
    } catch {
      setOrgs([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [refreshPendingInvites, refreshPendingApprovals]);

  // Mount once only — do not depend on refreshOrgs identity changes
  useEffect(() => {
    const stored = readStoredOrgId();
    if (stored) setActiveOrgIdState(stored);
    void refreshOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeOrg = useMemo(
    () => orgs.find((o) => o.id === activeOrgId) || null,
    [orgs, activeOrgId]
  );

  const role = (activeOrg?.role as WorkspaceRole) || null;
  const canManage = role === "owner" || role === "admin";
  // Personal workspace / no role → allow edits; viewers are read-only
  const canEdit = !role || role !== "viewer";

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      orgs,
      activeOrgId,
      activeOrg,
      role,
      canManage,
      canEdit,
      loading,
      pendingInviteCount,
      pendingApprovalCount,
      setActiveOrgId,
      refreshOrgs,
      refreshPendingInvites: () => refreshPendingInvites(),
      refreshPendingApprovals: () => refreshPendingApprovals(),
    }),
    [
      orgs,
      activeOrgId,
      activeOrg,
      role,
      canManage,
      canEdit,
      loading,
      pendingInviteCount,
      pendingApprovalCount,
      setActiveOrgId,
      refreshOrgs,
      refreshPendingInvites,
      refreshPendingApprovals,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

/** Safe hook when provider may be absent (e.g. invite page outside dashboard). */
export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}
