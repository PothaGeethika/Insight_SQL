"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Status = "loading" | "success" | "error" | "auth_required";

export default function InvitePage() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("Invalid invite link — no token found.");
      return;
    }

    const accept = async () => {
      // First check if user is logged in
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        // Redirect to login with return URL
        setStatus("auth_required");
        return;
      }

      // Accept invite
      try {
        const res = await fetch("/api/backend/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to accept invite");
        setOrgId(data.org_id);
        setStatus("success");
        setMessage("You've joined the workspace!");
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message || "Invite is invalid or has expired.");
      }
    };

    accept();
  }, []);

  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token")
    : "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-8 text-center space-y-6"
      >
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mx-auto" />
            <div>
              <h1 className="text-xl font-bold">Accepting invite…</h1>
              <p className="text-muted-foreground text-sm mt-1">Just a moment.</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Welcome to the team!</h1>
              <p className="text-muted-foreground text-sm mt-1">{message}</p>
            </div>
            <Link href="/dashboard/team">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                Go to Team
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </>
        )}

        {status === "auth_required" && (
          <>
            <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Sign in to accept</h1>
              <p className="text-muted-foreground text-sm mt-1">
                You need to be signed in to accept this workspace invite.
              </p>
            </div>
            <Link href={`/login?redirect=/invite?token=${token}`}>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                Sign in and accept
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/signup?redirect=/invite?token=${token}`}>
              <Button variant="outline" className="w-full">
                Create an account
              </Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Invite failed</h1>
              <p className="text-muted-foreground text-sm mt-1">{message}</p>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
