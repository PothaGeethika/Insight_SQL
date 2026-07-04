"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle2, Copy, Info, Lightbulb, Terminal as TerminalIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export function DocsReveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} variants={fadeUp} className={className}>
      {children}
    </motion.div>
  );
}

export function DocsStagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Callout({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="my-6 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-5 backdrop-blur-sm">
      {title && <p className="mb-2 text-sm font-bold text-indigo-200">{title}</p>}
      <div className="text-sm leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

export function Warning({ title = "Warning", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="my-6 flex gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
      <div>
        <p className="mb-1 text-sm font-bold text-amber-200">{title}</p>
        <div className="text-sm leading-relaxed text-slate-300">{children}</div>
      </div>
    </div>
  );
}

export function Tip({ title = "Tip", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="my-6 flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5">
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      <div>
        <p className="mb-1 text-sm font-bold text-emerald-200">{title}</p>
        <div className="text-sm leading-relaxed text-slate-300">{children}</div>
      </div>
    </div>
  );
}

export function InfoBox({ title = "Note", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="my-6 flex gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-5">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
      <div>
        <p className="mb-1 text-sm font-bold text-sky-200">{title}</p>
        <div className="text-sm leading-relaxed text-slate-300">{children}</div>
      </div>
    </div>
  );
}

export function FeatureCard({
  title, description, icon: Icon, href,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const inner = (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative h-full overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition-shadow hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <Icon className="h-5 w-5 text-indigo-400" />
        </div>
        <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-slate-400">{description}</p>
      </div>
    </motion.div>
  );
  if (href) {
    return <a href={href} className="block h-full">{inner}</a>;
  }
  return inner;
}

export function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <div className="relative flex gap-4 pb-10 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/30">
          {number}
        </div>
        <div className="mt-2 w-px flex-1 bg-gradient-to-b from-indigo-500/40 to-transparent" />
      </div>
      <div className="flex-1 pt-1">
        <h4 className="mb-2 text-base font-bold text-white">{title}</h4>
        <div className="text-sm leading-relaxed text-slate-400">{children}</div>
      </div>
    </div>
  );
}

export function CodeBlock({ code, language = "sql" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group relative my-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a12]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <span className="text-xs font-mono text-slate-500">{language}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Terminal({ lines }: { lines: string[] }) {
  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a12] font-mono text-sm">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
        <TerminalIcon className="h-4 w-4 text-slate-500" />
        <span className="text-xs text-slate-500">Terminal</span>
      </div>
      <div className="space-y-1 p-4 text-slate-300">
        {lines.map((line, i) => (
          <div key={i} className={line.startsWith("$") ? "text-emerald-400" : ""}>{line}</div>
        ))}
      </div>
    </div>
  );
}

export function DocImage({
  src, alt, caption, className,
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <figure className={cn("my-8", className)}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        onClick={() => setZoomed(!zoomed)}
        className="block w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-xl"
      >
        <img src={src} alt={alt} className={cn("w-full object-cover transition-transform duration-500", zoomed && "scale-105")} />
      </motion.button>
      {caption && <figcaption className="mt-3 text-center text-xs text-slate-500">{caption}</figcaption>}
    </figure>
  );
}

export function ImageCompare({
  before, after, beforeLabel = "Before", afterLabel = "After",
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  const [position, setPosition] = useState(50);
  return (
    <div className="relative my-8 aspect-video overflow-hidden rounded-2xl border border-white/10 select-none">
      <img src={after} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img src={before} alt={beforeLabel} className="h-full w-full object-cover" style={{ width: `${100 / (position / 100)}%`, maxWidth: "none" }} />
      </div>
      <input
        type="range"
        min={5}
        max={95}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="absolute inset-x-4 bottom-4 z-10 accent-indigo-500"
        aria-label="Compare images"
      />
      <span className="absolute left-4 top-4 rounded-lg bg-black/60 px-2 py-1 text-xs text-white">{beforeLabel}</span>
      <span className="absolute right-4 top-4 rounded-lg bg-black/60 px-2 py-1 text-xs text-white">{afterLabel}</span>
    </div>
  );
}

export function ZoomImage({ src, alt }: { src: string; alt: string }) {
  return <DocImage src={src} alt={alt} />;
}

export function VideoPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="my-8 flex aspect-video flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-8 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
        <div className="ml-1 h-0 w-0 border-y-[8px] border-l-[14px] border-y-transparent border-l-indigo-400" />
      </div>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function Timeline({ items }: { items: { date: string; title: string; body: string }[] }) {
  return (
    <div className="my-8 space-y-0">
      {items.map((item, i) => (
        <div key={i} className="relative flex gap-4 pb-8 last:pb-0">
          <div className="w-24 shrink-0 pt-1 text-xs font-semibold text-indigo-400">{item.date}</div>
          <div className="relative flex-1 border-l border-white/10 pl-6">
            <div className="absolute -left-1.5 top-2 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-[#030303]" />
            <h4 className="font-bold text-white">{item.title}</h4>
            <p className="mt-1 text-sm text-slate-400">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DocsTabs({
  items,
}: {
  items: { value: string; label: string; content: ReactNode }[];
}) {
  return (
    <Tabs defaultValue={items[0]?.value} className="my-6">
      <TabsList className="bg-white/5 border border-white/10">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="mt-4">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function DocsAccordion({ items }: { items: { title: string; content: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="my-6 divide-y divide-white/10 rounded-2xl border border-white/10 overflow-hidden">
      {items.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-white hover:bg-white/[0.03]"
          >
            {item.title}
            <span className="text-slate-500">{open === i ? "−" : "+"}</span>
          </button>
          <motion.div
            initial={false}
            animate={{ height: open === i ? "auto" : 0, opacity: open === i ? 1 : 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-sm leading-relaxed text-slate-400">{item.content}</div>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export function DocHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-28 text-2xl font-bold tracking-tight text-white mb-4 mt-12 first:mt-0">
      {children}
    </h2>
  );
}

export function DocSubheading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="scroll-mt-28 text-lg font-semibold text-white mb-3 mt-8">
      {children}
    </h3>
  );
}

export function DocParagraph({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-base leading-relaxed text-slate-400">{children}</p>;
}
