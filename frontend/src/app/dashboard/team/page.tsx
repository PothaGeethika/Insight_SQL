"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Trash2, Mail, Crown, Shield, Eye, UserCheck,
  Loader2, Copy, CheckCircle2, X, Building2, Pencil, Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { api } from "@/lib/apiClient";

// ── Types ────────────────────────────────────────────────────────────────

interface Org { id: string; name: string; slug: string; owner_id: string; role: string }
interface Member {
  org_id: string; user_id: string; role: string; joined_at: number;
  email?: string; name?: string;
}
interface Invite { id: string; email: string; role: string; token: string; expires_at: number }

const ROLE_META: Record<string, { label: string; color: string; icon: any }> = {
  owner:  { label: "Owner",  color: "text-amber-500 bg-amber-500/10 border-amber-500/20",    icon: Crown },
  admin:  { label: "Admin",  color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20", icon: Shield },
  member: { label: "Member", color: "text-blue-500 bg-blue-500/10 border-blue-500/20",       icon: UserCheck },
  viewer: { label: "Viewer", color: "text-slate-500 bg-slate-500/10 border-slate-500/20",    icon: Eye },
};

function RoleBadge({ role }: { role: string }) {
  const meta = ROLE_META[role] ?? ROLE_META.member;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function MemberAvatar({ member }: { member: Member }) {
  const display = member.name || member.email || member.user_id;
  const initials = display.length >= 2
    ? display.slice(0, 2).toUpperCase()
    : display.toUpperCase();
  return (
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
      {initials}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function TeamPage() {
  const {
    orgs: workspaceOrgs,
    activeOrgId: workspaceActiveOrgId,
    setActiveOrgId: setWorkspaceActiveOrgId,
    refreshOrgs,
    refreshPendingInvites,
    canManage: workspaceCanManage,
  } = useWorkspace();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Create org form
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Rename org inline
  const [renamingOrgId, setRenamingOrgId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const canManage = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const isOwner = activeOrg?.role === "owner";

  const load = async () => {
    setLoading(true);
    try {
      const data = await refreshOrgs();
      setOrgs(data as Org[]);
      const preferred =
        (data.find((o) => o.id === workspaceActiveOrgId) as Org | undefined) ||
        (data[0] as Org | undefined) ||
        null;
      if (preferred) {
        setActiveOrg(preferred);
        setWorkspaceActiveOrgId(preferred.id);
      }
    } catch {
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgData = async (org: Org) => {
    try {
      const [membersData, invitesData] = await Promise.all([
        api.orgs.members(org.id).catch(() => []),
        api.orgs.invites(org.id).catch(() => []),
      ]);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setInvites(Array.isArray(invitesData) ? invitesData : []);
      refreshPendingInvites();
    } catch {
      /* non-admin won't see invites — that's fine */
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (workspaceOrgs.length) setOrgs(workspaceOrgs as Org[]);
  }, [workspaceOrgs]);
  useEffect(() => {
    if (workspaceActiveOrgId && orgs.length) {
      const match = orgs.find((o) => o.id === workspaceActiveOrgId);
      if (match && match.id !== activeOrg?.id) setActiveOrg(match);
    }
  }, [workspaceActiveOrgId, orgs]);
  useEffect(() => { if (activeOrg) loadOrgData(activeOrg); }, [activeOrg]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingOrgId) {
      setTimeout(() => renameInputRef.current?.focus(), 50);
    }
  }, [renamingOrgId]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreatingOrg(true);
    try {
      const res = await fetch("/api/backend/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newOrgName }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const org: Org = await res.json();
      setOrgs((prev) => [org, ...prev]);
      setActiveOrg(org);
      setWorkspaceActiveOrgId(org.id);
      await refreshOrgs();
      setNewOrgName("");
      setShowCreateOrg(false);
      toast.success(`Workspace "${org.name}" created!`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create workspace");
    } finally {
      setCreatingOrg(false);
    }
  };

  const startRename = (org: Org) => {
    setRenamingOrgId(org.id);
    setRenameValue(org.name);
  };

  const cancelRename = () => {
    setRenamingOrgId(null);
    setRenameValue("");
  };

  const handleRename = async (orgId: string) => {
    if (!renameValue.trim()) return;
    setSavingRename(true);
    try {
      const res = await fetch(`/api/backend/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const updated: Org = await res.json();
      setOrgs((prev) => prev.map((o) => o.id === orgId ? { ...o, name: updated.name } : o));
      if (activeOrg?.id === orgId) setActiveOrg((prev) => prev ? { ...prev, name: updated.name } : prev);
      toast.success("Workspace renamed!");
      setRenamingOrgId(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to rename workspace");
    } finally {
      setSavingRename(false);
    }
  };

  const handleDeleteOrg = async (orgId: string) => {
    if (!confirm("Delete this workspace? This will remove all members and invites. This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/backend/orgs/${orgId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const remaining = orgs.filter((o) => o.id !== orgId);
      setOrgs(remaining);
      setActiveOrg(remaining[0] ?? null);
      toast.success("Workspace deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete workspace");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeOrg) return;
    setSendingInvite(true);
    try {
      const res = await fetch(`/api/backend/orgs/${activeOrg.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      const invite: Invite & { email_sent?: boolean; email_error?: string | null } = await res.json();
      setInvites((prev) => [...prev, invite]);
      setInviteEmail("");
      setShowInviteForm(false);
      refreshPendingInvites();
      if (invite.email_sent === false) {
        toast.warning(
          `Invite created for ${invite.email}, but email failed to send. Use Copy link to share manually.`,
          { duration: 8000 }
        );
      } else {
        toast.success(`Invite email sent to ${invite.email}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to send invite");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!activeOrg) return;
    try {
      await fetch(`/api/backend/orgs/${activeOrg.id}/invites/${inviteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast.success("Invite revoked");
    } catch {
      toast.error("Failed to revoke invite");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeOrg || !confirm("Remove this member from the workspace?")) return;
    try {
      await fetch(`/api/backend/orgs/${activeOrg.id}/members/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const handleChangeRole = async (userId: string, role: string) => {
    if (!activeOrg) return;
    try {
      const res = await fetch(`/api/backend/orgs/${activeOrg.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, role } : m));
      toast.success("Role updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update role");
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite?token=${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-500" />
            Team
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage workspaces, members, and invitations.</p>
        </div>
        <Button
          onClick={() => setShowCreateOrg(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </Button>
      </motion.div>

      {/* Create org modal */}
      <AnimatePresence>
        {showCreateOrg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCreateOrg(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Create Workspace</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowCreateOrg(false)} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgName">Workspace name</Label>
                <Input
                  id="orgName"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Analytics"
                  className="h-11"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateOrg()}
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowCreateOrg(false)}>Cancel</Button>
                <Button
                  onClick={handleCreateOrg}
                  disabled={!newOrgName.trim() || creatingOrg}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {creatingOrg ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : orgs.length === 0 ? (
        // Empty state
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 border-2 border-dashed border-border rounded-2xl space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto">
            <Building2 className="h-8 w-8 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">No workspaces yet</h3>
            <p className="text-muted-foreground text-sm mt-1">Create a workspace to collaborate with your team.</p>
          </div>
          <Button
            onClick={() => setShowCreateOrg(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create your first workspace
          </Button>
        </motion.div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Org list sidebar */}
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1 mb-3">Workspaces</p>
            {orgs.map((org) => (
              <div key={org.id} className="group relative">
                {renamingOrgId === org.id ? (
                  /* ── Inline rename field ── */
                  <div className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/5">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(org.id);
                        if (e.key === "Escape") cancelRename();
                      }}
                      className="flex-1 text-sm bg-transparent outline-none text-foreground min-w-0"
                    />
                    <button
                      onClick={() => handleRename(org.id)}
                      disabled={savingRename || !renameValue.trim()}
                      className="h-6 w-6 rounded-md bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                    >
                      {savingRename ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </button>
                    <button
                      onClick={cancelRename}
                      className="h-6 w-6 rounded-md bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  /* ── Normal workspace button ── */
                  <div className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 ${
                    activeOrg?.id === org.id
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}>
                    <button
                      onClick={() => {
                        setActiveOrg(org);
                        setWorkspaceActiveOrgId(org.id);
                      }}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <div className="h-6 w-6 rounded-md bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-3 w-3 text-indigo-500" />
                      </div>
                      <span className="truncate text-sm">{org.name}</span>
                    </button>
                    {/* Edit / Delete actions — only visible on hover when active */}
                    {activeOrg?.id === org.id && (org.role === "owner" || org.role === "admin") && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          title="Rename workspace"
                          onClick={(e) => { e.stopPropagation(); startRename(org); }}
                          className="h-5 w-5 rounded text-indigo-400 hover:text-indigo-600 hover:bg-indigo-500/10 flex items-center justify-center"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {org.role === "owner" && (
                          <button
                            title="Delete workspace"
                            onClick={(e) => { e.stopPropagation(); handleDeleteOrg(org.id); }}
                            className="h-5 w-5 rounded text-red-400 hover:text-red-600 hover:bg-red-500/10 flex items-center justify-center"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Org detail */}
          {activeOrg && (
            <div className="lg:col-span-3 space-y-6">
              {/* Workspace title bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{activeOrg.name}</h2>
                    <p className="text-xs text-muted-foreground">/{activeOrg.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge role={activeOrg.role} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    title="Refresh"
                    onClick={() => loadOrgData(activeOrg)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Members card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-500" />
                      Members
                      <Badge variant="secondary" className="text-xs ml-1">{members.length}</Badge>
                    </CardTitle>
                    {canManage && (
                      <Button size="sm" onClick={() => setShowInviteForm(!showInviteForm)} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white">
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                        Invite Member
                      </Button>
                    )}
                  </div>
                </CardHeader>

                {/* Invite form */}
                <AnimatePresence>
                  {showInviteForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4">
                        <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/20 space-y-3">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                              Invite a new member
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            An email with an accept link will be sent to them. The invite expires in 48 hours.
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            <Input
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="colleague@company.com"
                              type="email"
                              className="flex-1 h-9 min-w-[200px]"
                              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                              autoFocus
                            />
                            <Select value={inviteRole} onValueChange={(val) => setInviteRole(val || "member")}>
                              <SelectTrigger className="h-9 w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              onClick={handleInvite}
                              disabled={!inviteEmail.trim() || sendingInvite}
                              className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4"
                            >
                              {sendingInvite
                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Sending…</>
                                : <><Mail className="h-3.5 w-3.5 mr-1.5" />Send Invite</>
                              }
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowInviteForm(false)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <CardContent className="pt-0 space-y-1">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No members yet.</p>
                  ) : (
                    members.map((m, i) => (
                      <motion.div
                        key={m.user_id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <MemberAvatar member={m} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {m.name || m.email || m.user_id}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {m.name && m.email ? m.email : ""}
                              {m.name && m.email ? " · " : ""}
                              Joined {new Date(m.joined_at * 1000).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {canManage && m.role !== "owner" ? (
                            <Select value={m.role} onValueChange={(r) => r && handleChangeRole(m.user_id, r)}>
                              <SelectTrigger className="h-7 w-28 text-xs border-transparent bg-transparent hover:bg-muted">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <RoleBadge role={m.role} />
                          )}
                          {canManage && m.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                              onClick={() => handleRemoveMember(m.user_id)}
                              title="Remove member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Pending invites */}
              {canManage && invites.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mail className="h-4 w-4 text-amber-500" />
                      Pending Invites
                      <Badge variant="secondary" className="text-xs ml-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                        {invites.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <Mail className="h-3.5 w-3.5 text-amber-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{inv.email}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <RoleBadge role={inv.role} />
                              <p className="text-xs text-muted-foreground">
                                Expires {new Date(inv.expires_at * 1000).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Copy invite link"
                            onClick={() => copyInviteLink(inv.token)}
                          >
                            {copiedToken === inv.token ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Revoke invite"
                            onClick={() => handleRevokeInvite(inv.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Role permissions legend */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">Role Permissions</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-3">
                  {Object.entries(ROLE_META).map(([role, meta]) => {
                    const Icon = meta.icon;
                    const perms: Record<string, string> = {
                      owner: "Full control — manage members, billing, and settings",
                      admin: "Invite members, manage connections and queries",
                      member: "Run queries, manage own connections and history",
                      viewer: "View query results only — read-only access",
                    };
                    return (
                      <div key={role} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                        <div className={`h-8 w-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold capitalize">{role}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{perms[role]}</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
