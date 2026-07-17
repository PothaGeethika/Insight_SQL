"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { motion } from "framer-motion";
import {
  Home,
  MessageSquare,
  Database,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileText,
  ExternalLink,
  Star,
  Bookmark,
  LayoutGrid,
  Menu,
  X,
  LogOut,
  Loader2,
  LucideIcon,
  CreditCard,
  Users,
  Building2,
  Network,
  LayoutDashboard,
  Check,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AuthUser } from "@/types";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "pendingInvites" | "pendingApprovals";
}

const mainNavItems: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Chat", href: "/dashboard/chat", icon: MessageSquare },
  { name: "Databases", href: "/dashboard/databases", icon: Database },
  { name: "Schema", href: "/dashboard/schema", icon: Network },
  { name: "Projects", href: "/dashboard/projects", icon: LayoutGrid },
  { name: "Dashboards", href: "/dashboard/boards", icon: LayoutDashboard },
  { name: "Saved Queries", href: "/dashboard/saved-queries", icon: Bookmark },
  { name: "Favorites", href: "/dashboard/favorites", icon: Star },
  { name: "Approvals", href: "/dashboard/approvals", icon: Check, badgeKey: "pendingApprovals" },
  { name: "Team", href: "/dashboard/team", icon: Users, badgeKey: "pendingInvites" },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </WorkspaceProvider>
  );
}

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    orgs,
    activeOrg,
    activeOrgId,
    setActiveOrgId,
    pendingInviteCount,
    pendingApprovalCount,
    loading: workspaceLoading,
  } = useWorkspace();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileOpen(false);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch current user from /api/auth/me — redirect to login if not authenticated
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Not authenticated — redirect to login
          window.location.href = "/login";
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
        window.location.href = "/login";
      }
    };
    fetchUser();
  }, []);

  // resolvedTheme is always "dark" or "light" — next-themes handles system resolution
  const isDarkMode = mounted && resolvedTheme === "dark";

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      setSidebarWidth((prev) => {
        const next = prev + e.movementX;
        if (next < 140) {
          setCollapsed(true);
          return 80;
        }
        setCollapsed(false);
        return next > 180 && next < 450 ? next : prev;
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Handle logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
      // Force redirect even on error
      window.location.href = "/login";
    }
  };

  // Derive user display info
  const userName = user?.name || "User";
  const userEmail = user?.email || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const firstName = userName.split(" ")[0];

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans relative bg-white dark:bg-black text-slate-800 dark:text-slate-300 transition-colors duration-300">
      {/* ── Background Video (Dark Mode) ── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 hidden dark:block opacity-70 pointer-events-none"
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* ── Background Video (Light Mode) ── */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 block dark:hidden opacity-60 pointer-events-none"
      >
        <source src="/bg-video-light.mp4" type="video/mp4" />
      </video>
      
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={isMobile ? { x: mobileOpen ? 0 : -280, width: 280 } : { x: 0, width: collapsed ? 72 : sidebarWidth }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className={`flex flex-col z-50 md:z-30 bg-white/50 dark:bg-[#0a0a0f]/50 backdrop-blur-md border-r border-[var(--sidebar-border)] dark:border-white/10 ${
          isMobile ? "fixed inset-y-0 left-0 shadow-2xl" : "relative h-full"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-[var(--sidebar-border)] dark:border-white/10">
          {(!collapsed || isMobile) && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2.5"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
                <Database className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-base tracking-tight text-foreground">InsightSQL</span>
            </motion.div>
          )}
          {collapsed && !isMobile && (
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30 mx-auto">
              <Database className="h-4 w-4 text-white" />
            </div>
          )}
          {isMobile ? (
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="h-8 w-8 ml-auto">
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className={`h-7 w-7 text-muted-foreground hover:text-foreground ${collapsed ? "mx-auto" : ""}`}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Workspace switcher */}
        {(!collapsed || isMobile) && (
          <div className="px-3 pt-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-card/80 hover:bg-accent text-left transition-colors"
                    disabled={workspaceLoading}
                  >
                    <div className="h-7 w-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Workspace</p>
                      <p className="text-xs font-semibold text-foreground truncate">
                        {activeOrg?.name || (workspaceLoading ? "Loading…" : "Personal")}
                      </p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  </button>
                }
              />
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
                  {orgs.length === 0 && (
                    <DropdownMenuItem disabled>No workspaces yet</DropdownMenuItem>
                  )}
                  {orgs.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      onClick={() => setActiveOrgId(org.id)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{org.name}</span>
                      {org.id === activeOrgId && <Check className="h-3.5 w-3.5 text-indigo-500" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <Link href="/dashboard/team" className="block">
                    <DropdownMenuItem className="cursor-pointer w-full">
                      Manage team…
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Navigation */}
        <div className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
            const badge =
              item.badgeKey === "pendingInvites" && pendingInviteCount > 0
                ? pendingInviteCount
                : item.badgeKey === "pendingApprovals" && pendingApprovalCount > 0
                  ? pendingApprovalCount
                : null;
            return (
              <Link key={item.name} href={item.href} onClick={() => isMobile && setMobileOpen(false)}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group ${
                    isActive
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <item.icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? "text-indigo-500" : ""}`} />
                  {(!collapsed || isMobile) && (
                    <span className="text-sm leading-none">{item.name}</span>
                  )}
                  {badge != null && (!collapsed || isMobile) && (
                    <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  {badge == null && isActive && (!collapsed || isMobile) && (
                    <div className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom: user card */}
        <div className="p-3 border-t border-[var(--sidebar-border)] dark:border-white/10 space-y-1">
          {(!collapsed || isMobile) && (
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
              {/* User row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar className="h-8 w-8 border border-border flex-shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  title="Log out"
                >
                  {isLoggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {/* Credits bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-medium">
                  <span className="text-muted-foreground">SQL Credits</span>
                  <span className="text-foreground font-semibold">2,450 / 5,000</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "49%" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                  />
                </div>
              </div>

              {/* Upgrade link */}
              <Link href="/dashboard/billing">
                <div className="flex items-center justify-between text-[10px] px-2.5 py-1.5 rounded-lg bg-indigo-500/8 border border-indigo-500/15 cursor-pointer hover:bg-indigo-500/12">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">Free Plan</span>
                  <span className="text-indigo-500 font-bold">Upgrade →</span>
                </div>
              </Link>
            </div>
          )}

          {/* Docs link */}
          <Link href="#" className={`flex items-center gap-3 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl text-xs group ${collapsed && !isMobile ? "justify-center" : ""}`}>
            <FileText className="h-4 w-4 flex-shrink-0" />
            {(!collapsed || isMobile) && <span className="font-medium">Documentation</span>}
            {(!collapsed || isMobile) && <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100" />}
          </Link>

          {/* Logout when collapsed */}
          {collapsed && !isMobile && (
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center justify-center w-full py-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
              title="Log out"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Drag handle */}
        {!isMobile && (
          <div
            onMouseDown={startResizing}
            className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-50 hover:bg-indigo-500/40 ${
              isResizing ? "bg-indigo-500/60" : "bg-transparent"
            }`}
          />
        )}
      </motion.aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-white/40 dark:bg-black/30 backdrop-blur-sm">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 z-20 border-b border-border dark:border-white/10 bg-background/80 dark:bg-black/40 backdrop-blur-md sticky top-0">
          {/* Left — mobile menu + greeting */}
          <div className="flex items-center gap-3 min-w-0">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="h-9 w-9 flex-shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate">
                Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName} 👋
              </h1>
              <p className="hidden md:block text-xs text-muted-foreground truncate">
                Ask anything about your data
              </p>
            </div>
          </div>

          {/* Right — theme toggle + bell */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {mounted && (
              <button
                onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-indigo-500/40 hover:bg-accent"
              >
                <div className={`relative h-4 w-7 rounded-full transition-colors ${isDarkMode ? "bg-indigo-600" : "bg-slate-200"}`}>
                  <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${isDarkMode ? "left-[14px]" : "left-0.5"}`} />
                </div>
                <span className="hidden sm:inline">{isDarkMode ? "Dark" : "Light"}</span>
              </button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-rose-500 rounded-full" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 relative overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
