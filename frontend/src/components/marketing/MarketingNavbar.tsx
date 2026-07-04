"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Database, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Docs", href: "/docs" },
];

export function MarketingNavbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDocs = pathname?.startsWith("/docs");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled || isDocs ? "bg-[#030303]/90 backdrop-blur-xl border-b border-white/5" : ""
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/30 transition-shadow group-hover:shadow-indigo-500/50">
            <Database className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">InsightSQL</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => {
            const active = l.href === "/docs" && isDocs;
            const isHash = l.href.startsWith("/#");
            const className = cn(
              "text-sm transition-colors",
              active ? "font-semibold text-white" : "text-slate-400 hover:text-white"
            );
            if (isHash) {
              return (
                <a key={l.label} href={l.href} className={className}>
                  {l.label}
                </a>
              );
            }
            return (
              <Link key={l.label} href={l.href} className={className}>
                {l.label}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="mt-1 block h-0.5 rounded-full bg-indigo-500"
                  />
                )}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-sm text-slate-400 hover:text-white">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500">
              Get started free
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <button type="button" className="p-2 text-slate-400 hover:text-white md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-white/5 bg-[#0c0c14] md:hidden"
          >
            <div className="space-y-3 px-6 py-4">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className={cn("block py-1 text-sm", pathname?.startsWith(l.href) && l.href !== "/" ? "font-semibold text-white" : "text-slate-400")}
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full border-white/10 text-slate-300">Log in</Button>
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-500">Get started free</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
