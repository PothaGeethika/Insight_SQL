"use client";

import { useState } from "react";
import { Database } from "lucide-react";
import { DATABASE_BRANDS } from "@/lib/databaseBrands";

function LogoPill({ name, icon }: { name: string; icon: string }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-3 transition-colors hover:border-white/10 hover:bg-white/[0.05]">
      <div className="flex h-8 w-8 items-center justify-center">
        {imgError ? (
          <Database className="h-6 w-6 text-slate-400" />
        ) : (
          <img
            src={icon}
            alt={`${name} logo`}
            className="h-7 w-7 object-contain"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <span className="whitespace-nowrap text-sm font-semibold text-slate-400">{name}</span>
    </div>
  );
}

export function DatabaseLogoMarquee() {
  const loop = [...DATABASE_BRANDS, ...DATABASE_BRANDS];

  return (
    <section className="border-y border-white/5 py-16">
      <p className="mb-10 text-center text-sm font-medium uppercase tracking-widest text-slate-500">
        Works with every database you already use
      </p>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#030303] to-transparent sm:w-32" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#030303] to-transparent sm:w-32" />

        <div className="db-marquee-track flex w-max gap-4 px-4">
          {loop.map((db, index) => (
            <LogoPill key={`${db.id}-${index}`} name={db.name} icon={db.icon} />
          ))}
        </div>
      </div>
    </section>
  );
}
