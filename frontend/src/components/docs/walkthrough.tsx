"use client";

import { motion } from "framer-motion";
import { BarChart3, Bot, Database, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

const flowSteps = [
  { label: "Your Database", icon: Database, color: "from-blue-500 to-cyan-500" },
  { label: "InsightSQL", icon: Sparkles, color: "from-indigo-500 to-violet-500" },
  { label: "AI Engine", icon: Bot, color: "from-purple-500 to-fuchsia-500" },
  { label: "Charts & Tables", icon: BarChart3, color: "from-emerald-500 to-teal-500" },
];

export function FlowDiagram() {
  return (
    <div className="my-10 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-4">
      {flowSteps.map((step, i) => (
        <div key={step.label} className="flex flex-col items-center sm:flex-row">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="flex flex-col items-center"
          >
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} shadow-lg`}>
              <step.icon className="h-7 w-7 text-white" />
            </div>
            <span className="mt-2 text-xs font-semibold text-slate-300">{step.label}</span>
          </motion.div>
          {i < flowSteps.length - 1 && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 + 0.1 }}
              className="my-2 hidden h-px w-12 bg-gradient-to-r from-indigo-500 to-violet-500 sm:block"
            />
          )}
          {i < flowSteps.length - 1 && (
            <motion.div
              initial={{ opacity: 0, scaleY: 0 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={{ once: true }}
              className="h-8 w-px bg-gradient-to-b from-indigo-500 to-violet-500 sm:hidden"
            />
          )}
        </div>
      ))}
    </div>
  );
}

const DEMO_QUESTIONS = [
  "Show top 10 customers by revenue this quarter",
  "Which products had the highest return rate?",
  "Plot monthly signups as a bar chart",
];

export function TypingDemo() {
  const [qIndex, setQIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = DEMO_QUESTIONS[qIndex];
    const timeout = setTimeout(() => {
      if (!deleting) {
        if (text.length < full.length) setText(full.slice(0, text.length + 1));
        else setTimeout(() => setDeleting(true), 1800);
      } else if (text.length > 0) {
        setText(full.slice(0, text.length - 1));
      } else {
        setDeleting(false);
        setQIndex((i) => (i + 1) % DEMO_QUESTIONS.length);
      }
    }, deleting ? 30 : 45);
    return () => clearTimeout(timeout);
  }, [text, deleting, qIndex]);

  return (
    <div className="my-8 rounded-2xl border border-white/10 bg-[#0c0c14]/90 p-5 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        Chat · InsightSQL
      </div>
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 px-4 py-3 font-medium text-white">
        {text}
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-indigo-400 align-middle" />
      </div>
    </div>
  );
}

const SQL_LINES = [
  "SELECT c.name, SUM(o.total_amount) AS revenue",
  "FROM customers c",
  "JOIN orders o ON o.customer_id = c.id",
  "WHERE o.order_date >= DATE_TRUNC('quarter', CURRENT_DATE)",
  "GROUP BY c.name",
  "ORDER BY revenue DESC",
  "LIMIT 10;",
];

export function SqlReveal() {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    if (visible >= SQL_LINES.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 400);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a12] font-mono text-sm">
      <div className="border-b border-white/5 px-4 py-2 text-xs text-slate-500">Generated SQL</div>
      <pre className="p-4 text-emerald-300/90">
        {SQL_LINES.slice(0, visible).map((line, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
            {line}
          </motion.div>
        ))}
      </pre>
    </div>
  );
}

const chartData = [
  { name: "Jan", value: 42 },
  { name: "Feb", value: 58 },
  { name: "Mar", value: 71 },
  { name: "Apr", value: 65 },
  { name: "May", value: 89 },
];

export function ChartReveal() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={show ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="my-8 h-64 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
    >
      <p className="mb-2 text-xs font-semibold text-slate-500">Revenue by month</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData}>
          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function DashboardMock() {
  const widgets = [
    { title: "Total Revenue", value: "$1.24M", trend: "+12.4%" },
    { title: "Active Users", value: "8,432", trend: "+3.1%" },
    { title: "Orders Today", value: "342", trend: "+18.7%" },
  ];
  return (
    <div className="my-8 grid gap-4 sm:grid-cols-3">
      {widgets.map((w, i) => (
        <motion.div
          key={w.title}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        >
          <p className="text-xs text-slate-500">{w.title}</p>
          <p className="mt-1 text-2xl font-bold text-white">{w.value}</p>
          <p className="mt-1 text-xs font-semibold text-emerald-400">{w.trend}</p>
        </motion.div>
      ))}
    </div>
  );
}
