"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  title: string;
  level?: 2 | 3;
}

export function DocsTOC({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    items.forEach((item) => {
      const el = document.getElementById(item.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(item.id);
        },
        { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [items]);

  if (!items.length) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-24">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">On this page</p>
        <ul className="space-y-1 border-l border-white/10">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={cn(
                  "block border-l-2 py-1.5 text-sm transition-colors -ml-px",
                  item.level === 3 ? "pl-6" : "pl-4",
                  active === item.id
                    ? "border-indigo-500 font-medium text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                )}
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
