"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Plus,
  Search,
  Sun,
  Moon,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

const mainNavItems: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Chat", href: "/dashboard/chat", icon: MessageSquare },
  { name: "Databases", href: "/dashboard/databases", icon: Database },
  { name: "Projects", href: "/dashboard/projects", icon: LayoutGrid },
  { name: "Saved Queries", href: "/dashboard/saved-queries", icon: Bookmark },
  { name: "Favorites", href: "/dashboard/favorites", icon: Star },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);

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

  // Apply dark class to <html> so Tailwind dark: variants work globally
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans bg-white dark:bg-[var(--surface-0)] text-slate-800 dark:text-slate-300 transition-colors duration-300">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : sidebarWidth }}
        className="relative h-full flex flex-col z-30 bg-slate-50 dark:bg-[var(--surface-0)] border-r border-slate-200 dark:border-slate-900/40 transition-colors duration-300"
      >
        {/* Logo Header */}
        <div className="p-7 flex items-center justify-between">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg shadow-indigo-600/30">
                <Database className="h-5 w-5 text-white" />
              </div>
              <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">InsightSQL</span>
            </motion.div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>



        {/* Navigation */}
        <div className="flex-1 px-4 py-2 space-y-1">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group cursor-pointer ${
                    isActive
                      ? "bg-indigo-600/10 dark:bg-indigo-600/15 text-indigo-600 dark:text-white font-bold"
                      : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-indigo-500" : "group-hover:text-slate-700 dark:group-hover:text-slate-100 transition-colors"}`} />
                  {!collapsed && <span className="text-sm tracking-wide">{item.name}</span>}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom Section: User Profile & Credits */}
        <div className="p-4 space-y-4 mb-2">
          {!collapsed && (
            <div className="bg-white dark:bg-[var(--surface-1)] rounded-[24px] p-5 border border-slate-200 dark:border-slate-900/50 shadow-lg dark:shadow-2xl transition-colors">
              <div className="flex items-center gap-3 mb-5">
                <Avatar className="h-11 w-11 border-2 border-slate-200 dark:border-slate-800 shadow-xl">
                  <AvatarFallback className="bg-indigo-600 text-white font-black text-xs">JD</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-black text-slate-900 dark:text-white truncate">Jane Doe</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-medium">jane.doe@acme.com</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[var(--surface-2)] rounded-2xl p-4 mb-4 flex items-center justify-between border border-slate-100 dark:border-white/5 transition-colors">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.15em]">Pro Plan</p>
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 font-bold">Renews on Jun 20, 2025</p>
                </div>
                <Button size="sm" className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg shadow-lg shadow-indigo-600/20 uppercase tracking-wider">
                  Upgrade
                </Button>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-slate-400 dark:text-slate-400">SQL Credits</span>
                  <span className="text-slate-800 dark:text-white">2,450 / 5,000</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "49%" }}
                    className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 rounded-full"
                  />
                </div>
                <p className="text-[9px] text-right text-slate-400 dark:text-slate-500 font-bold">49%</p>
              </div>
            </div>
          )}

          {/* Documentation Link */}
          <Link href="#" className="flex items-center gap-3 px-5 py-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all group">
            <FileText className="h-4 w-4" />
            {!collapsed && <span className="text-xs font-black uppercase tracking-widest">Documentation</span>}
            {!collapsed && <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />}
          </Link>
        </div>
        {/* Dynamic Drag Handle */}
        <div
          onMouseDown={startResizing}
          className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/60 z-50 transition-all ${
            isResizing ? "bg-indigo-650 w-[3px] border-r-2 border-indigo-400" : "bg-transparent hover:w-1.5"
          }`}
        />
      </motion.aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-white dark:bg-[var(--surface-0)] transition-colors duration-300">
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-8 z-20 border-b border-slate-200 dark:border-slate-900/30 transition-colors">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl">👋</span>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Welcome back, Jane</h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-500 font-medium mt-1">Ask questions, analyze data, and get insights from your databases.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Light / Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="relative flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all duration-300 bg-slate-50 dark:bg-[var(--surface-1)] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-white"
            >
              {/* Toggle Track */}
              <div className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${isDarkMode ? "bg-indigo-600" : "bg-slate-200"}`}>
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center ${
                    isDarkMode ? "left-[18px]" : "left-0.5"
                  }`}
                >
                  {isDarkMode
                    ? <Moon className="h-2.5 w-2.5 text-indigo-600" />
                    : <Sun className="h-2.5 w-2.5 text-amber-500" />
                  }
                </div>
              </div>
              <span>{isDarkMode ? "Dark" : "Light"}</span>
            </button>

            {/* Notification Bell */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl relative border text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-[var(--surface-1)] border-slate-200 dark:border-slate-800 transition-colors"
            >
              <Bell className="h-5 w-5" />
              <div className="absolute top-2 right-2.5 h-2 w-2 bg-rose-500 rounded-full border-2 border-slate-50 dark:border-[var(--surface-1)]" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 relative overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
