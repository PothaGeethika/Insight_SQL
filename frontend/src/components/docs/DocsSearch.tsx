"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Search, X } from "lucide-react";
import { searchDocs } from "@/lib/docs/search-index";
import { cn } from "@/lib/utils";

const RECENT_KEY = "insightsql-docs-recent";

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveRecent(slug: string) {
  const prev = loadRecent().filter((s) => s !== slug);
  localStorage.setItem(RECENT_KEY, JSON.stringify([slug, ...prev].slice(0, 5)));
}

interface DocsSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DocsSearch({ open, onOpenChange }: DocsSearchProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = searchDocs(query);
  const recentEntries = recent
    .map((slug) => results.find((r) => r.slug === slug) ?? searchDocs("").find((r) => r.slug === slug))
    .filter(Boolean) as typeof results;

  const display = query.trim() ? results : recentEntries.length ? recentEntries : results.slice(0, 6);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = useCallback(
    (slug: string) => {
      saveRecent(slug);
      onOpenChange(false);
      router.push(`/docs/${slug}`);
    },
    [onOpenChange, router]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !open && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        onOpenChange(true);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, display.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      }
      if (e.key === "Enter" && display[selected]) {
        navigate(display[selected].slug);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, display, selected, navigate, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 pt-[15vh] backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c14] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                placeholder="Search documentation…"
                className="flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <button type="button" onClick={() => onOpenChange(false)} className="text-slate-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {!query.trim() && recentEntries.length > 0 && (
                <p className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <Clock className="h-3 w-3" /> Recent
                </p>
              )}
              {display.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No results for &ldquo;{query}&rdquo;</p>
              ) : (
                display.map((item, i) => {
                  const highlighted = query.trim()
                    ? item.title.replace(new RegExp(`(${query})`, "gi"), "<mark>$1</mark>")
                    : item.title;
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => navigate(item.slug)}
                      className={cn(
                        "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors",
                        selected === i ? "bg-indigo-500/20" : "hover:bg-white/[0.04]"
                      )}
                    >
                      <span
                        className="text-sm font-medium text-white [&_mark]:rounded [&_mark]:bg-indigo-500/40 [&_mark]:px-0.5"
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                      />
                      <span className="text-xs text-slate-500">{item.description}</span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
              <span>↑↓ navigate · ↵ open · esc close</span>
              <kbd className="rounded border border-white/10 px-1.5 py-0.5">/</kbd>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DocsSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-500 transition-colors hover:text-slate-300 lg:flex"
    >
      <Search className="h-3.5 w-3.5" />
      Search
      <kbd className="rounded border border-white/10 px-1 py-0.5 text-[10px]">/</kbd>
    </button>
  );
}
