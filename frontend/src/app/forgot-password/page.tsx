"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Database, Eye, EyeOff, Mail, Lock, ArrowLeft, Loader2, ShieldCheck, KeyRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (res.ok) window.location.href = "/dashboard";
    }).catch(() => {});
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setStep(2);
      setSuccess("Account found! Set your new password below.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setSuccess("Password reset! Redirecting to login…");
      setTimeout(() => { window.location.href = "/login"; }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel — always dark ─────────────────────────────── */}
      <div className="dark hidden lg:flex lg:w-[48%] xl:w-[44%] flex-col bg-[#09090f] relative overflow-hidden">

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/15 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-600/15 rounded-full blur-[80px]" />
        </div>

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

          <div className="flex-1 flex flex-col justify-center space-y-6 mt-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-4"
            >
              <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight">
                Don&apos;t worry.
                <br />
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  We&apos;ve got you
                </span>
                <br />
                covered.
              </h1>
              <p className="text-slate-400 text-base leading-relaxed max-w-sm">
                Reset your password in seconds and get back to querying your databases.
              </p>
            </motion.div>

            {/* Step indicators */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="space-y-3"
            >
              {[
                { n: 1, label: "Verify your email" },
                { n: 2, label: "Set new password" },
              ].map((s) => (
                <div key={s.n} className={`flex items-center gap-3 ${step >= s.n ? "opacity-100" : "opacity-30"}`}>
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${step > s.n ? "bg-emerald-500 text-white" : step === s.n ? "bg-indigo-500 text-white" : "border border-slate-700 text-slate-500"}`}>
                    {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
                  </div>
                  <span className={`text-sm font-medium ${step >= s.n ? "text-white" : "text-slate-500"}`}>{s.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          <p className="text-xs text-slate-600 relative z-10">© 2025 InsightSQL. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right panel — theme-aware form ────────────────────────── */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="lg:hidden flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Database className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">InsightSQL</span>
          </Link>
          <div className="lg:ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[400px] space-y-8"
          >
            {/* Progress dots */}
            <div className="flex items-center gap-2">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? "w-8 bg-indigo-500" : "w-3 bg-indigo-500"}`} />
              <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? "w-8 bg-indigo-500" : "w-3 bg-muted"}`} />
            </div>

            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-7"
                >
                  <div className="space-y-1.5">
                    <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                      <KeyRound className="h-6 w-6 text-indigo-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Forgot your password?</h2>
                    <p className="text-muted-foreground text-sm">Enter your email and we&apos;ll look up your account.</p>
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-medium">{error}</div>
                  )}

                  <form className="space-y-4" onSubmit={handleRequestReset}>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground">Email address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-11 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-indigo-500"
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20">
                      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</> : "Find my account"}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-7"
                >
                  <div className="space-y-1.5">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                      <ShieldCheck className="h-6 w-6 text-emerald-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Set new password</h2>
                    <p className="text-muted-foreground text-sm">Choose a strong password for <span className="font-medium text-foreground">{email}</span></p>
                  </div>

                  {success && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                      <Check className="h-4 w-4 flex-shrink-0" />{success}
                    </div>
                  )}
                  {error && (
                    <div className="p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 text-destructive text-sm font-medium">{error}</div>
                  )}

                  <form className="space-y-4" onSubmit={handleResetPassword}>
                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">New password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="newPassword" type={showNewPassword ? "text" : "password"} placeholder="Min. 6 characters"
                          value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10 pr-11 h-11 bg-background border-border text-foreground focus:border-indigo-500" required />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••"
                          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 pr-11 h-11 bg-background border-border text-foreground focus:border-indigo-500" required />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" disabled={isLoading} className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20">
                      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting…</> : "Reset password"}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />Back to sign in
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
