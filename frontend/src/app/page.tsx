"use client";

import { motion } from "framer-motion";
import {
  Database,
  MessageSquare,
  Zap,
  Shield,
  ArrowRight,
  Play,
  BarChart3,
  Table2,
  Bot,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

const fadeInUp: any = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
  { label: "Blog", href: "#blog" },
];

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language Queries",
    description: "Ask questions in plain English and get instant SQL-powered answers from your databases.",
  },
  {
    icon: Database,
    title: "Multi-Database Support",
    description: "Connect PostgreSQL, MySQL, MongoDB, SQLite, and more — all in one place.",
  },
  {
    icon: BarChart3,
    title: "Visual Analytics",
    description: "Automatic charts, graphs, and summaries that help you understand your data at a glance.",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SOC 2 compliant with end-to-end encryption. Your data never leaves your infrastructure.",
  },
  {
    icon: Table2,
    title: "Smart Results",
    description: "Get formatted tables, exportable reports, and actionable insights from every query.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Optimized query generation with sub-second response times on most databases.",
  },
];

const trustedLogos = ["Acme Corp", "Datatech", "QueryWorks", "StarMart", "InnovaAI"];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 glass"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Database className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">InsightSQL</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-sm">
                Log in
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 text-sm"
              >
                Try Now
              </Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative flex-1 flex items-center justify-center overflow-hidden gradient-bg">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-cyan-400/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-2 gap-16 items-center relative">
          {/* Left content */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            <motion.div variants={fadeInUp} className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                <Sparkles className="h-3 w-3 mr-1" />
                AI-Powered
              </Badge>
              <Badge variant="secondary" className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                <Shield className="h-3 w-3 mr-1" />
                Secure
              </Badge>
              <Badge variant="secondary" className="px-3 py-1 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                <Zap className="h-3 w-3 mr-1" />
                Fast
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight"
            >
              Ask Questions to{" "}
              <br className="hidden sm:block" />
              Your Database in{" "}
              <br className="hidden sm:block" />
              <span className="gradient-text">Plain English</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg text-muted-foreground max-w-lg leading-relaxed"
            >
              InsightSQL turns natural language into SQL, so you can get answers
              from your data instantly.
            </motion.p>

            <motion.div variants={fadeInUp} className="flex items-center gap-4">
              <Link href="/login">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-xl shadow-blue-500/25 h-12 px-8 text-base font-semibold"
                >
                  Try Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base font-semibold border-2"
              >
                <Play className="mr-2 h-4 w-4" />
                Watch Demo
              </Button>
            </motion.div>

            <motion.div variants={fadeInUp} className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">Trusted by data-driven teams</p>
              <div className="flex items-center gap-6 flex-wrap">
                {trustedLogos.map((name) => (
                  <span key={name} className="text-sm font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                    ● {name}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>

          {/* Right side - Chat preview */}
          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
            className="hidden lg:block relative"
          >
            <div className="relative">
              {/* Chat bubble card */}
              <div className="glass rounded-2xl p-6 shadow-2xl shadow-blue-500/5">
                {/* User message */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold">U</span>
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3 max-w-xs">
                    <p className="text-sm">How many orders did we receive this week?</p>
                  </div>
                </div>

                {/* AI response */}
                <div className="flex items-start gap-3 justify-end">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl rounded-tr-md px-4 py-3 max-w-sm text-white">
                    <p className="text-sm">You received 250 orders this week.</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Floating decorative elements */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-6 -right-6 h-14 w-14 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 shadow-lg flex items-center justify-center"
              >
                <Sparkles className="h-6 w-6 text-white" />
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-4 -left-4 h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg flex items-center justify-center"
              >
                <BarChart3 className="h-5 w-5 text-white" />
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-1/2 -right-10 h-10 w-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg flex items-center justify-center"
              >
                <Table2 className="h-4 w-4 text-white" />
              </motion.div>

              {/* Database icon decorative */}
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-8 right-8 h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 shadow-lg flex items-center justify-center"
              >
                <Database className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Badge variant="secondary" className="mb-4 px-3 py-1">
              Features
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need to query
              <br />
              <span className="gradient-text">your data effortlessly</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Powerful features designed for teams who want answers, not SQL headaches.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group relative bg-card rounded-2xl border p-6 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20 flex items-center justify-center mb-4 group-hover:from-blue-500/20 group-hover:to-blue-600/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                <ChevronRight className="absolute top-6 right-6 h-4 w-4 text-muted-foreground/30 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-12 md:p-16 text-white relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to talk to your data?
              </h2>
              <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of teams using InsightSQL to get instant answers from their databases.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="bg-white text-blue-700 hover:bg-blue-50 h-12 px-8 text-base font-semibold shadow-xl"
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <Database className="h-3 w-3 text-white" />
            </div>
            <span className="font-semibold text-foreground">InsightSQL</span>
          </div>
          <p>© 2025 InsightSQL. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
