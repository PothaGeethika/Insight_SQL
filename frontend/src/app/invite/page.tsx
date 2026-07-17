"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Status = "loading" | "success" | "error" | "auth_required";

function InvitePageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid invite link — no token found.");
      return;
    }

    let cancelled = false;

    const accept = async () => {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (cancelled) return;
        if (!meRes.ok) {
          setStatus("auth_required");
          return;
        }

        const res = await fetch("/api/backend/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Failed to accept invite"
          );
        }
        setOrgId(data.org_id || null);
        if (data.org_id) {
          try {
            localStorage.setItem("insight_active_org_id", data.org_id);
          } catch {
            /* ignore */
          }
        }
        setStatus("success");
        setMessage("You've joined the workspace!");
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          e instanceof Error ? e.message : "Invite is invalid or has expired."
        );
      }
    };

    void accept();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const redirect = encodeURIComponent(`/invite?token=${token}`);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-xl p-8 text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-indigo-400 mx-auto" />
            <div>
              <h1 className="text-xl font-bold text-white">Accepting invite…</h1>
              <p className="text-slate-400 text-sm mt-1">Just a moment.</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Welcome to the team!</h1>
              <p className="text-slate-400 text-sm mt-1">{message}</p>
            </div>
            <Link href="/dashboard/team">
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
                onClick={() => {
                  if (orgId) {
                    try {
                      localStorage.setItem("insight_active_org_id", orgId);
                    } catch {
                      /* ignore */
                    }
                  }
                }}
              >
                Go to Team
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </>
        )}

        {status === "auth_required" && (
          <>
            <div className="h-16 w-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Sign in to accept</h1>
              <p className="text-slate-400 text-sm mt-1">
                You need to be signed in to accept this workspace invite.
              </p>
            </div>
            <Link href={`/login?redirect=${redirect}`}>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                Sign in and accept
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/signup?redirect=${redirect}`}>
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-100 hover:bg-slate-800"
              >
                Create an account
              </Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Invite failed</h1>
              <p className="text-slate-400 text-sm mt-1">{message}</p>
            </div>
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full border-slate-600 text-slate-100 hover:bg-slate-800"
              >
                Go to Sign in
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
        </div>
      }
    >
      <InvitePageInner />
    </Suspense>
  );
}
