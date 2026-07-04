"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, BarChart3, Bot, Database, Layers, Play, Sparkles, Zap, GitBranch, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard, DocsStagger } from "@/components/docs/primitives";
import { FlowDiagram } from "@/components/docs/walkthrough";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const cards = [
  {
    icon: Sparkles,
    title: "What is InsightSQL?",
    description: "A natural-language analytics layer that connects to your databases, generates SQL with AI, and returns tables and charts instantly.",
    href: "/docs/introduction",
  },
  {
    icon: Zap,
    title: "Why use it?",
    description: "Skip the SQL syntax hunt. Product, ops, and data teams ask questions in plain English and get trustworthy answers in seconds.",
    href: "/docs/getting-started",
  },
  {
    icon: BarChart3,
    title: "Key Features",
    description: "Multi-DB support, streaming AI responses, auto-visualizations, dashboards, exports, and enterprise-grade security.",
    href: "/docs/visualizations",
  },
  {
    icon: GitBranch,
    title: "Architecture",
    description: "Next.js frontend, FastAPI backend, LLM agents with schema-aware prompting, and a secure connection manager.",
    href: "/docs/introduction#architecture",
  },
  {
    icon: Database,
    title: "Supported Databases",
    description: "PostgreSQL, MySQL, SQLite, MongoDB, Snowflake, BigQuery, Elasticsearch, Neo4j, and more.",
    href: "/docs/connecting-database",
  },
  {
    icon: Bot,
    title: "AI Workflow",
    description: "Schema introspection → prompt synthesis → SQL generation → execution → chart recommendation → streaming response.",
    href: "/docs/ai-sql-generation",
  },
];

function Particles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-indigo-400/40"
          style={{ left: `${(i * 17) % 100}%`, top: `${(i * 23) % 100}%` }}
          animate={{ opacity: [0.2, 0.8, 0.2], y: [0, -20, 0] }}
          transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

export default function DocsHomePage() {
  return (
    <div className="relative -mx-6 overflow-hidden">
      {/* Hero */}
      <section className="relative px-6 pb-24 pt-16">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <motion.div
          className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <Particles />

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.12 } } }}
          className="relative mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300">
            <Layers className="h-3.5 w-3.5" />
            Documentation
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Build insights from{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
              every database
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-xl text-lg text-slate-400">
            Everything you need to connect data sources, ask questions in natural language, and ship analytics your team trusts.
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/docs/getting-started">
              <Button size="lg" className="bg-indigo-600 px-8 shadow-lg shadow-indigo-600/30 hover:bg-indigo-500">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs/asking-questions">
              <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Play className="mr-2 h-4 w-4" />
                Quick tour
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7 }}
          className="relative mx-auto mt-20 max-w-4xl"
        >
          <FlowDiagram />
        </motion.div>
      </section>

      {/* Cards */}
      <section className="border-t border-white/5 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-white">Explore the platform</h2>
          <DocsStagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <motion.div key={card.title} variants={fadeUp}>
                <FeatureCard {...card} />
              </motion.div>
            ))}
          </DocsStagger>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 px-6 py-20">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 p-10 text-center backdrop-blur-xl">
          <Shield className="mx-auto mb-4 h-10 w-10 text-indigo-400" />
          <h2 className="text-2xl font-bold text-white">Ready to query your data?</h2>
          <p className="mt-3 text-slate-400">Create a free account and connect your first database in under five minutes.</p>
          <Link href="/signup" className="mt-6 inline-block">
            <Button className="bg-indigo-600 hover:bg-indigo-500">Get started free</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
