"use client";

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Database, MessageSquare, Zap, Shield, ArrowRight, BarChart3,
  Table2, Bot, Sparkles, ChevronRight, Check, Star, Menu, X,
  Globe, Lock, Users, TrendingUp, Code2, Layers, Cpu, GitBranch,
  Terminal, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { DatabaseLogoMarquee } from "@/components/DatabaseLogoMarquee";

// ─── Animation variants ────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
} as const;

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
} as const;

const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5 } },
} as const;

// ─── Data ──────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "/docs" },
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Natural Language to SQL",
    description: "Type a question in plain English. Get precise SQL and instant results — no SQL expertise required.",
    gradient: "from-blue-500/20 to-indigo-500/20",
    iconColor: "text-blue-400",
    border: "border-blue-500/20",
  },
  {
    icon: Layers,
    title: "Multi-Database Support",
    description: "Connect PostgreSQL, MySQL, MongoDB, Snowflake, Elasticsearch, Neo4j — all in one unified interface.",
    gradient: "from-purple-500/20 to-violet-500/20",
    iconColor: "text-purple-400",
    border: "border-purple-500/20",
  },
  {
    icon: BarChart3,
    title: "Auto Visualizations",
    description: "Bar charts, pie charts, line graphs — auto-generated from your query results. Export to PNG, CSV, Excel.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  {
    icon: Zap,
    title: "Streaming Responses",
    description: "Watch your AI answer stream in token by token — no waiting for the full response to load.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
    border: "border-amber-500/20",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Encrypted credentials, read-only query enforcement, JWT auth, rate limiting, per-user isolation.",
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-400",
    border: "border-rose-500/20",
  },
  {
    icon: Cpu,
    title: "Multiple AI Providers",
    description: "Choose from Gemini, Groq, DeepSeek, Ollama. Swap providers without changing your workflow.",
    gradient: "from-cyan-500/20 to-sky-500/20",
    iconColor: "text-cyan-400",
    border: "border-cyan-500/20",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Connect Your Database",
    description: "Paste your connection string or fill in the details. We test the connection live and encrypt your credentials at rest.",
    icon: Database,
    color: "from-blue-600 to-indigo-600",
  },
  {
    number: "02",
    title: "Ask in Plain English",
    description: "Type your question naturally. \"Show me the top 10 customers by revenue this month\" — that's all you need.",
    icon: MessageSquare,
    color: "from-indigo-600 to-purple-600",
  },
  {
    number: "03",
    title: "Get Answers Instantly",
    description: "See the SQL, the results table, and an AI-written summary. Export to CSV, Excel, or share as a link.",
    icon: BarChart3,
    color: "from-purple-600 to-pink-600",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals exploring their data.",
    cta: "Get started free",
    ctaVariant: "outline" as const,
    highlighted: false,
    features: [
      "1 database connection",
      "100 queries / month",
      "CSV export",
      "3 AI providers",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "per month",
    description: "For analysts and data professionals.",
    cta: "Start 14-day trial",
    ctaVariant: "default" as const,
    highlighted: true,
    badge: "Most Popular",
    features: [
      "10 database connections",
      "5,000 queries / month",
      "CSV, Excel, PDF export",
      "All AI providers",
      "Query history & saved queries",
      "Charts & visualizations",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "per seat",
    description: "For teams that need scale and control.",
    cta: "Contact sales",
    ctaVariant: "outline" as const,
    highlighted: false,
    features: [
      "Unlimited connections",
      "Unlimited queries",
      "Team workspaces & roles",
      "SSO / SAML",
      "Audit logs",
      "Custom AI model",
      "SLA & dedicated support",
    ],
  },
];

const TESTIMONIALS = [
  {
    quote: "InsightSQL cut our data request backlog by 80%. Now anyone on the team can answer their own data questions without waiting on the data team.",
    name: "Sarah Chen",
    role: "Head of Growth, Acme Corp",
    avatar: "SC",
    color: "from-blue-500 to-indigo-500",
  },
  {
    quote: "I've tried every BI tool out there. InsightSQL is the first one that actually works for non-technical users. The SQL it generates is production-quality.",
    name: "Marcus Reid",
    role: "CTO, DataTech",
    avatar: "MR",
    color: "from-purple-500 to-pink-500",
  },
  {
    quote: "We connected our entire Snowflake warehouse in 5 minutes. Our team now runs 200+ queries a day without writing a single line of SQL.",
    name: "Priya Nair",
    role: "Data Lead, StarMart",
    avatar: "PN",
    color: "from-emerald-500 to-teal-500",
  },
];

// ─── Typewriter demo component ─────────────────────────────────────────────

const DEMO_SEQUENCE = [
  { q: "Who are our top 5 customers by revenue?", a: "Found 5 customers. Here's the breakdown:" },
  { q: "How many orders did we receive this week?", a: "You received 342 orders this week, up 18.7% from last week." },
  { q: "Show inactive users in the last 30 days", a: "Found 128 inactive users. Showing the most recent first." },
];

function TypewriterDemo() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"typing-q" | "showing-a" | "pause">("typing-q");
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    const current = DEMO_SEQUENCE[idx];
    let timeout: NodeJS.Timeout;

    if (phase === "typing-q") {
      if (displayed.length < current.q.length) {
        timeout = setTimeout(() => setDisplayed(current.q.slice(0, displayed.length + 1)), 40);
      } else {
        timeout = setTimeout(() => setPhase("showing-a"), 600);
      }
    } else if (phase === "showing-a") {
      timeout = setTimeout(() => setPhase("pause"), 2500);
    } else {
      timeout = setTimeout(() => {
        setIdx((i) => (i + 1) % DEMO_SEQUENCE.length);
        setDisplayed("");
        setPhase("typing-q");
      }, 800);
    }

    return () => clearTimeout(timeout);
  }, [displayed, phase, idx]);

  const current = DEMO_SEQUENCE[idx];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0c14]/80 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className="h-3 w-3 rounded-full bg-red-500/70" />
        <div className="h-3 w-3 rounded-full bg-amber-500/70" />
        <div className="h-3 w-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-[11px] text-slate-500 font-mono">InsightSQL — Chat</span>
      </div>

      <div className="p-5 space-y-4 min-h-[200px]">
        {/* User message */}
        <div className="flex items-start gap-3 justify-end">
          <div className="bg-indigo-600 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs">
            <p className="text-sm text-white font-medium">
              {displayed}
              {phase === "typing-q" && <span className="inline-block w-0.5 h-4 bg-white ml-0.5 animate-pulse align-middle" />}
            </p>
          </div>
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            U
          </div>
        </div>

        {/* AI response */}
        <AnimatePresence>
          {phase !== "typing-q" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-3"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="space-y-2 max-w-xs">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5">
                  <p className="text-sm text-slate-200">{current.a}</p>
                </div>
                {/* Mini table preview */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
                  <div className="flex gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                    <span className="w-24">Customer</span>
                    <span className="w-16 text-right">Revenue</span>
                  </div>
                  {["Acme Corp", "DataTech", "StarMart"].map((name, i) => (
                    <div key={name} className="flex gap-3 text-[11px] py-1 border-t border-white/5 px-1">
                      <span className="w-24 text-slate-300">{name}</span>
                      <span className="w-16 text-right text-emerald-400 font-mono">${(48 - i * 7).toFixed(1)}k</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02] flex items-center gap-3">
        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-500">
          Ask anything about your data…
        </div>
        <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center">
          <ArrowRight className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const heroY = useTransform(scrollY, [0, 300], [0, -60]);

  useEffect(() => {
    const unsub = scrollY.on("change", (v) => setScrolled(v > 20));
    return unsub;
  }, [scrollY]);

  return (
    // The landing page is intentionally always dark — wrapping in .dark forces all
    // Tailwind dark: variants and CSS variable overrides to apply regardless of user pref.
    <div className="dark min-h-screen bg-[#030303] text-white overflow-x-hidden">

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[#030303]/90 backdrop-blur-xl border-b border-white/5" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow">
              <Database className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">InsightSQL</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) =>
              l.href.startsWith("/") && !l.href.startsWith("/#") ? (
                <Link key={l.label} href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                  {l.label}
                </Link>
              ) : (
                <a key={l.label} href={l.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                  {l.label}
                </a>
              )
            )}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 text-sm font-semibold px-5"
              >
                Get started free
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/5 bg-[#0c0c14]"
            >
              <div className="px-6 py-4 space-y-3">
                {NAV_LINKS.map((l) =>
                  l.href.startsWith("/") && !l.href.startsWith("/#") ? (
                    <Link key={l.label} href={l.href} className="block text-sm text-slate-400 hover:text-white py-1" onClick={() => setMobileOpen(false)}>
                      {l.label}
                    </Link>
                  ) : (
                    <a key={l.label} href={l.href} className="block text-sm text-slate-400 hover:text-white py-1" onClick={() => setMobileOpen(false)}>
                      {l.label}
                    </a>
                  )
                )}
                <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                  <Link href="/login"><Button variant="outline" className="w-full border-white/10 text-slate-300">Log in</Button></Link>
                  <Link href="/signup"><Button className="w-full bg-indigo-600 hover:bg-indigo-500">Get started free</Button></Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Background mesh */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-600/5 rounded-full blur-[140px]" />
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="w-full">
          <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">
              {/* Badge */}
              <motion.div variants={fadeUp}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium">
                  <Sparkles className="h-3 w-3" />
                  AI-powered · Multi-database · Real-time streaming
                </div>
              </motion.div>

              {/* Headline */}
              <motion.div variants={fadeUp} className="space-y-3">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05]">
                  Ask questions.
                  <br />
                  <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                    Get answers.
                  </span>
                  <br />
                  <span className="text-white">Instantly.</span>
                </h1>
              </motion.div>

              <motion.p variants={fadeUp} className="text-lg text-slate-400 leading-relaxed max-w-xl">
                InsightSQL turns natural language into SQL — so anyone on your team can get answers from your databases without writing a single line of code.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white h-12 px-8 font-semibold shadow-xl shadow-indigo-600/30 text-base"
                  >
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#how">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 px-8 border-white/10 text-slate-300 hover:text-white hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] text-base"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    See how it works
                  </Button>
                </Link>
              </motion.div>

              {/* Social proof */}
              <motion.div variants={fadeUp} className="flex items-center gap-4 pt-2">
                <div className="flex -space-x-2">
                  {["SC","MR","PN","JD","KL"].map((init, i) => (
                    <div key={init} className={`h-8 w-8 rounded-full border-2 border-[#030303] flex items-center justify-center text-[10px] font-bold text-white ${
                      ["bg-indigo-600","bg-purple-600","bg-emerald-600","bg-blue-600","bg-rose-600"][i]
                    }`}>
                      {init}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-slate-400">
                  <span className="text-white font-semibold">2,400+</span> data teams trust InsightSQL
                </div>
              </motion.div>
            </motion.div>

            {/* Right — Demo */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative hidden lg:block"
            >
              {/* Glow behind card */}
              <div className="absolute -inset-8 bg-indigo-600/10 rounded-3xl blur-2xl" />
              <div className="relative">
                <TypewriterDemo />
              </div>

              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-5 -right-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 flex items-center gap-2 backdrop-blur-sm"
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-300">Query successful</span>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
                className="absolute -bottom-5 -left-5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 flex items-center gap-2 backdrop-blur-sm"
              >
                <Zap className="h-3 w-3 text-indigo-400" />
                <span className="text-xs font-semibold text-indigo-300">Streaming live</span>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <DatabaseLogoMarquee />

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-20 space-y-4"
          >
            <motion.div variants={fadeUp}>
              <Badge className="border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 px-3 py-1">
                Features
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-black tracking-tight">
              Everything your data team needs
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto">
              Built for analysts, engineers, and product teams who want answers — not SQL headaches.
            </motion.p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`group relative rounded-2xl border ${f.border} bg-white/[0.02] hover:bg-white/[0.04] p-6 transition-all duration-300 cursor-default overflow-hidden`}
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                <div className="relative z-10">
                  <div className={`h-11 w-11 rounded-xl border ${f.border} bg-white/5 flex items-center justify-center mb-5`}>
                    <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                  </div>
                  <h3 className="text-base font-bold mb-2 text-white">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how" className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-20 space-y-4"
          >
            <motion.div variants={fadeUp}>
              <Badge className="border border-violet-500/30 bg-violet-500/10 text-violet-300 px-3 py-1">
                How it works
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-black tracking-tight">
              From question to answer in seconds
            </motion.h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-14 left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-px bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-30" />

            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative text-center space-y-5"
              >
                <div className="relative inline-flex">
                  <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-2xl shadow-indigo-500/20 mx-auto`}>
                    <step.icon className="h-7 w-7 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-[#030303] border border-white/10 flex items-center justify-center text-[10px] font-black text-slate-400">
                    {i + 1}
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16 space-y-3"
          >
            <div className="flex items-center justify-center gap-1 mb-4">
              {Array.from({length: 5}).map((_, i) => (
                <Star key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Loved by data teams</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 space-y-5 hover:border-white/15 transition-all"
              >
                <div className="flex gap-1">
                  {Array.from({length: 5}).map((_, j) => (
                    <Star key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                  <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-xs font-bold text-white`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-32 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-center mb-20 space-y-4"
          >
            <motion.div variants={fadeUp}>
              <Badge className="border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-3 py-1">
                Pricing
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-black tracking-tight">
              Simple, transparent pricing
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-400">
              Start free. Upgrade as you grow. Cancel anytime.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PRICING.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border p-8 space-y-7 ${
                  plan.highlighted
                    ? "border-indigo-500/50 bg-gradient-to-b from-indigo-950/40 to-transparent shadow-2xl shadow-indigo-500/10"
                    : "border-white/8 bg-white/[0.02] hover:border-white/15 transition-colors"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">{plan.name}</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-5xl font-black ${plan.highlighted ? "text-white" : "text-white"}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-slate-500 text-sm">/ {plan.period}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{plan.description}</p>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        plan.highlighted ? "bg-indigo-500/20" : "bg-white/5"
                      }`}>
                        <Check className={`h-3 w-3 ${plan.highlighted ? "text-indigo-400" : "text-slate-400"}`} />
                      </div>
                      <span className={plan.highlighted ? "text-slate-200" : "text-slate-400"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.name === "Enterprise" ? "#" : "/signup"} className="block">
                  <Button
                    className={`w-full h-11 font-semibold ${
                      plan.highlighted
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                        : "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 hover:border-white/20"
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm text-slate-600 mt-10"
          >
            All plans include a 14-day free trial. No credit card required.
          </motion.p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-32 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/60 via-blue-900/40 to-violet-900/60" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-100" />
            <div className="absolute inset-x-0 -top-20 h-40 bg-indigo-600/20 blur-3xl" />
            <div className="absolute inset-0 border border-indigo-500/20 rounded-3xl" />

            <div className="relative z-10 px-8 py-20 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-2">
                <Sparkles className="h-3 w-3" />
                Free to start · No credit card
              </div>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
                Ready to talk to your data?
              </h2>
              <p className="text-lg text-slate-400 max-w-xl mx-auto">
                Join 2,400+ teams who use InsightSQL to get instant answers from their databases — without writing SQL.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-white text-indigo-900 hover:bg-slate-100 h-12 px-8 font-bold text-base shadow-2xl"
                  >
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 px-8 border-white/20 text-slate-300 hover:text-white hover:border-white/40 bg-white/5 hover:bg-white/10 text-base"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                  <Database className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-lg">InsightSQL</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                AI-powered natural language to SQL. Get answers from your data instantly.
              </p>
            </div>

            {[
              { title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
              { title: "Resources", links: ["Documentation", "API Reference", "Blog", "Status"] },
              { title: "Company", links: ["About", "Privacy", "Terms", "Contact"] },
            ].map((col) => (
              <div key={col.title} className="space-y-4">
                <p className="text-sm font-semibold text-white">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-white/5 gap-4">
            <p className="text-sm text-slate-600">© 2025 InsightSQL. All rights reserved.</p>
            <div className="flex items-center gap-6">
              {["Privacy", "Terms", "Cookies"].map((l) => (
                <a key={l} href="#" className="text-sm text-slate-600 hover:text-slate-400 transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
