"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { cn } from "@/lib/utils";

function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      className="fixed top-16 left-0 right-0 z-40 h-0.5 origin-left bg-gradient-to-r from-indigo-500 to-violet-500"
      style={{ scaleX }}
    />
  );
}

export function DocsPageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface DocsShellProps {
  children: ReactNode;
}

export function DocsShell({ children }: DocsShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/docs";
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#030303] text-white">
      <MarketingNavbar />
      <ReadingProgress />
      <DocsSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <div className="flex pt-16">
        {/* Desktop sidebar */}
        <div className="hidden lg:block fixed top-16 bottom-0 left-0 z-30">
          <DocsSidebar
            onSearchOpen={() => setSearchOpen(true)}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          />
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileNav && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileNav(false)}
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="fixed top-16 bottom-0 left-0 z-50 w-72 lg:hidden"
              >
                <DocsSidebar onSearchOpen={() => { setSearchOpen(true); setMobileNav(false); }} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main
          className={cn(
            "flex-1 min-w-0 transition-[margin] duration-300",
            sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
          )}
        >
          {/* Mobile header bar */}
          <div className="sticky top-16 z-20 flex items-center gap-3 border-b border-white/5 bg-[#030303]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-slate-400">Documentation</span>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-500"
            >
              Search /
            </button>
          </div>

          <div className={cn("mx-auto px-6 py-10", isHome ? "max-w-6xl" : "max-w-[1400px]")}>
            <DocsPageTransition>{children}</DocsPageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
