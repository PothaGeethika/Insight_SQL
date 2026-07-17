"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CreditCard, Check, Zap, Shield, ArrowRight, Loader2,
  ExternalLink, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individuals exploring their data.",
    features: [
      "1 database connection",
      "100 queries / month",
      "CSV export",
      "3 AI providers",
      "Community support",
    ],
    cta: "Current plan",
    color: "border-slate-800",
    badge: null,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/ month",
    description: "For analysts and data professionals.",
    features: [
      "10 database connections",
      "5,000 queries / month",
      "CSV, Excel, PDF export",
      "All AI providers",
      "Query history & saved queries",
      "Charts & visualizations",
      "Priority support",
    ],
    cta: "Upgrade to Pro",
    color: "border-indigo-500/50",
    badge: "Most Popular",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For teams that need scale and control.",
    features: [
      "Unlimited connections",
      "Unlimited queries",
      "Team workspaces & roles",
      "SSO / SAML",
      "Audit logs",
      "Dedicated support",
    ],
    cta: "Contact sales",
    color: "border-slate-800",
    badge: null,
  },
];

interface UsageInfo {
  year_month?: string;
  queries_this_month?: number;
  queries_limit?: number | null;
  connections_used?: number;
  connections_limit?: number | null;
}

interface Subscription {
  plan: string;
  status: string;
  current_period_end?: number;
  stripe_customer?: string;
  usage?: UsageInfo;
  limits?: {
    max_connections?: number | null;
    max_queries_per_month?: number | null;
  };
}

function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null | undefined;
}) {
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="space-y-1.5 min-w-[160px] flex-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={nearLimit ? "text-amber-500 font-semibold" : "text-foreground font-semibold"}>
          {used.toLocaleString()}
          {unlimited ? " / ∞" : ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            nearLimit ? "bg-amber-500" : "bg-indigo-500"
          }`}
          style={{ width: unlimited ? "8%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    // Check for Stripe redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      toast.success("Subscription activated! Welcome to Pro.");
    } else if (params.get("canceled") === "1") {
      toast.info("Checkout canceled. No charges were made.");
    }

    fetch("/api/backend/billing/subscription", { credentials: "include" })
      .then((r) => r.json())
      .then(setSubscription)
      .catch(() => setSubscription({ plan: "free", status: "active" }))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === "enterprise") {
      toast.info("Contact us at hello@insightsql.com for Enterprise pricing.");
      return;
    }
    setCheckoutLoading(planId);
    try {
      const res = await fetch("/api/backend/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Checkout failed");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/backend/billing/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const currentPlan = subscription?.plan ?? "free";
  const renewalDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const usage = subscription?.usage;
  const queriesUsed = usage?.queries_this_month ?? 0;
  const queriesLimit =
    usage?.queries_limit ?? subscription?.limits?.max_queries_per_month ?? null;
  const connectionsUsed = usage?.connections_used ?? 0;
  const connectionsLimit =
    usage?.connections_limit ?? subscription?.limits?.max_connections ?? null;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-indigo-500" />
          Billing
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and billing details.</p>
      </motion.div>

      {/* Current plan banner */}
      {!loading && subscription && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className={`border ${currentPlan === "pro" ? "border-indigo-500/40 bg-indigo-500/5" : "border-border"}`}>
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${currentPlan === "pro" ? "bg-indigo-500/15" : "bg-muted"}`}>
                    {currentPlan === "pro" ? <Zap className="h-5 w-5 text-indigo-400" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-base capitalize">{currentPlan} Plan</p>
                      {subscription.status === "active" && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">Active</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {renewalDate ? `Renews on ${renewalDate}` : "No active subscription"}
                      {usage?.year_month ? ` · Usage for ${usage.year_month}` : ""}
                    </p>
                  </div>
                </div>
                {currentPlan !== "free" && subscription.stripe_customer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="text-sm"
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Manage subscription
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-1">
                <UsageMeter label="Queries this month" used={queriesUsed} limit={queriesLimit} />
                <UsageMeter label="Connections" used={connectionsUsed} limit={connectionsLimit} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Separator />

      {/* Plans */}
      <div>
        <h2 className="text-lg font-bold mb-6">Choose your plan</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => {
            const isCurrent = currentPlan === plan.id;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border p-6 space-y-6 ${
                  plan.highlight
                    ? "border-indigo-500/40 bg-indigo-500/[0.04] shadow-lg shadow-indigo-500/5"
                    : "border-border bg-card"
                } ${isCurrent ? "ring-2 ring-indigo-500/30" : ""}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 className="h-5 w-5 text-indigo-500" />
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground text-sm">{plan.period}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <div className={`h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0 ${plan.highlight ? "bg-indigo-500/20" : "bg-muted"}`}>
                        <Check className={`h-2.5 w-2.5 ${plan.highlight ? "text-indigo-400" : "text-muted-foreground"}`} />
                      </div>
                      <span className={plan.highlight ? "text-foreground" : "text-muted-foreground"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full h-10 font-semibold ${
                    isCurrent
                      ? "bg-muted text-muted-foreground cursor-default hover:bg-muted"
                      : plan.highlight
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                  disabled={isCurrent || checkoutLoading !== null}
                  onClick={() => !isCurrent && handleUpgrade(plan.id)}
                >
                  {checkoutLoading === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : isCurrent ? (
                    <CheckCircle2 className="h-4 w-4 mr-2 text-indigo-500" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {isCurrent ? "Current plan" : plan.cta}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <Separator className="my-2" />
        <div className="pt-4 text-xs text-muted-foreground space-y-1">
          <p>• All plans include a 14-day free trial. No credit card required to start.</p>
          <p>• Upgrade, downgrade, or cancel anytime from the billing portal.</p>
          <p>• For Enterprise pricing, contact <span className="text-indigo-400">hello@insightsql.com</span></p>
        </div>
      </motion.div>
    </div>
  );
}
