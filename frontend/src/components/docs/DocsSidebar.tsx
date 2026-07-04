"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DOCS_NAV } from "@/lib/docs/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocsSidebarProps {
  onSearchOpen: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DocsSidebar({ onSearchOpen, collapsed, onToggleCollapse }: DocsSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DOCS_NAV.map((s) => [s.title, true]))
  );

  const toggle = (title: string) => setExpanded((e) => ({ ...e, [title]: !e[title] }));

  return (
    <aside className={cn("flex h-full flex-col border-r border-white/5 bg-[#030303]/80 backdrop-blur-xl", collapsed ? "w-16" : "w-64")}>
      <div className="border-b border-white/5 p-4">
        <button
          type="button"
          onClick={onSearchOpen}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-500 transition-colors hover:border-white/20 hover:text-slate-300",
            collapsed && "justify-center px-2"
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search docs…</span>
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px]">/</kbd>
            </>
          )}
        </button>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {DOCS_NAV.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggle(section.title)}
                  className="mb-2 flex w-full items-center justify-between px-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300"
                >
                  {section.title}
                  {expanded[section.title] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              )}
              <AnimatePresence initial={false}>
                {(collapsed || expanded[section.title]) && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-0.5 overflow-hidden"
                  >
                    {section.items.map((item) => {
                      const href = `/docs/${item.slug}`;
                      const active = pathname === href;
                      return (
                        <li key={item.slug}>
                          <Link
                            href={href}
                            title={collapsed ? item.title : undefined}
                            className={cn(
                              "relative block rounded-lg px-3 py-2 text-sm transition-colors",
                              active
                                ? "bg-indigo-500/15 font-semibold text-white"
                                : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                            )}
                          >
                            {active && (
                              <motion.span
                                layoutId="docs-active"
                                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-500"
                              />
                            )}
                            {collapsed ? item.title.charAt(0) : item.title}
                          </Link>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="border-t border-white/5 p-3 text-xs text-slate-500 hover:text-white"
        >
          {collapsed ? "→" : "← Collapse"}
        </button>
      )}
    </aside>
  );
}
