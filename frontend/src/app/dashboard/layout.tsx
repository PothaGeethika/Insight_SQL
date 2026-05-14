"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  MessageSquare,
  Database,
  BookmarkCheck,
  History,
  Star,
  Settings,
  ChevronLeft,
  Search,
  HelpCircle,
  LogOut,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const mainNavItems = [
  { icon: Home, label: "Home", href: "/dashboard" },
  { icon: MessageSquare, label: "Chat", href: "/dashboard/chat" },
  { icon: Database, label: "Databases", href: "/dashboard/databases" },
  { icon: BookmarkCheck, label: "Saved Queries", href: "/dashboard/saved" },
  { icon: Star, label: "Favorites", href: "/dashboard/favorites" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="flex flex-col border-r bg-sidebar h-full relative flex-shrink-0"
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 gap-3 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
              <Database className="h-4 w-4 text-white" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-lg font-bold tracking-tight whitespace-nowrap overflow-hidden"
                >
                  InsightSQL
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Search */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 mb-2"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  placeholder="Search anything..."
                  className="w-full h-9 pl-9 pr-12 rounded-lg bg-muted/50 border-0 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded border">
                  ⌘K
                </kbd>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer relative ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? "text-white" : ""}`} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Plan info */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3"
            >
              <div className="rounded-xl bg-muted/50 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Pro Plan</span>
                </div>
                <p className="text-xs text-muted-foreground">Usage this month</p>
                <p className="text-sm font-semibold">65 / 200 queries</p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-[32%] rounded-full bg-gradient-to-r from-blue-500 to-blue-600" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Separator />

        {/* User profile */}
        <div className="p-3 flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div 
                role="button" 
                className={`flex items-center gap-3 w-full p-2 rounded-xl hover:bg-accent transition-colors cursor-pointer ${collapsed ? "justify-center" : ""}`}
              >
                <Avatar className="h-9 w-9 flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm font-semibold">
                    JC
                  </AvatarFallback>
                </Avatar>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-sm font-semibold truncate">Jane Cooper</p>
                      <p className="text-xs text-muted-foreground truncate">jane@acme.com</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!collapsed && <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
              <DropdownMenuItem><HelpCircle className="mr-2 h-4 w-4" /> Help & Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-background shadow-sm flex items-center justify-center hover:bg-accent transition-colors z-10"
        >
          <ChevronLeft className={`h-3 w-3 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b flex items-center justify-end px-6 gap-3 flex-shrink-0 bg-background/80 backdrop-blur-sm">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </Button>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
