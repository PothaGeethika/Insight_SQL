"use client";

import { motion } from "framer-motion";
import { Database, Eye, EyeOff, Mail, Lock, User, Loader2, Sparkles, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { useState, useEffect } from "react";

const STATS = [
  { value: "2,400+", label: "Data teams" },
  { value: "1M+", label: "Queries run" },
  { value: "99.9%", label: "Uptime" },
];

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (res.ok) window.location.href = "/dashboard";
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");
      window.location.href = "/login?registered=true";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColor = ["", "bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel — always dark ────────────────────────────────── */}
      <div className="dark hidden lg:flex lg:w-[48%] xl:w-[44%] flex-col bg-[#09090f] relative overflow-hidden">

        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 right-0 w-96 h-96 bg-violet-600/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 -left-20 w-80 h-80 bg-indigo-600/15 rounded-full blur-[80px]" />
        </div>

        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Database className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">InsightSQL</span>
          </Link>

          <div className="flex-1 flex flex-col justify-center space-y-10 mt-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-300 text-xs font-medium w-fit">
                <Sparkles className="h-3 w-3" />
                Free to get started
              </div>
              <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight">
                Start getting
                <br />
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  answers faster
                </span>
                <br />
                than ever.
              </h1>
              <p className="text-slate-400 text-base leading-relaxed max-w-sm">
                Join thousands of analysts who query their databases with plain English — zero SQL needed.
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="grid grid-cols-3 gap-4"
            >
              {STATS.map((s) => (
                <div key={s.label} className="space-y-0.5">
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                </div>
              ))}
            </motion.div>

            {/* Testimonial */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="p-4 rounded-2xl border border-white/8 bg-white/[0.03]"
            >
              <p className="text-sm text-slate-300 leading-relaxed italic">
                &ldquo;InsightSQL saved our team 20 hours a week. Anyone can answer data questions now without waiting on engineering.&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">SC</div>
                <div>
                  <p className="text-xs font-semibold text-white">Sarah Chen</p>
                  <p className="text-[10px] text-slate-500">Head of Growth, Acme Corp</p>
                </div>
              </div>
            </motion.div>
          </div>

          <p className="text-xs text-slate-600 relative z-10">© 2025 InsightSQL. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right panel — theme-aware form ─────────────────────────── */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="lg:hidden flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Database className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">InsightSQL</span>
          </Link>
          <div className="lg:ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">Already have an account?</span>
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-sm border-border">Sign in</Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[400px] space-y-7"
          >
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h2>
              <p className="text-muted-foreground text-sm">Free forever. No credit card required.</p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-medium"
              >
                {error}
              </motion.div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium text-foreground">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Cooper"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-11 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-indigo-500"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Work email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-indigo-500"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-11 h-11 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-indigo-500"
                    required
                    disabled={isLoading}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= passwordStrength ? strengthColor[passwordStrength] : "bg-muted"}`} />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{strengthLabel[passwordStrength]}</p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`pl-10 pr-11 h-11 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-indigo-500 ${confirmPassword && confirmPassword !== password ? "border-destructive focus:border-destructive" : ""}`}
                    required
                    disabled={isLoading}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {confirmPassword && confirmPassword === password && (
                    <Check className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                  )}
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20 mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Creating account…</span>
                ) : (
                  <span className="flex items-center gap-2">Create free account <ArrowRight className="h-4 w-4" /></span>
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              By creating an account you agree to our{" "}
              <Link href="#" className="text-indigo-500 hover:text-indigo-400">Terms</Link>{" "}
              and{" "}
              <Link href="#" className="text-indigo-500 hover:text-indigo-400">Privacy Policy</Link>.
            </p>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-indigo-500 hover:text-indigo-400 font-semibold">Sign in</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
