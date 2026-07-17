"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Save, Loader2, Check, ExternalLink } from "lucide-react";
import { ChartRenderer } from "./ChartRenderer";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiClient";
import { toast } from "sonner";

export interface DashboardWidget {
  title: string;
  chartType: "bar" | "line" | "pie" | "area";
  tableData: {
    headers: string[];
    rows: any[][];
  };
}

interface AutoDashboardProps {
  widgets: DashboardWidget[];
  title?: string;
  connectionId?: string;
  orgId?: string | null;
  onSaved?: (board: any) => void;
  /** Hide save controls when already viewing a saved board */
  readOnly?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.85, rotateX: -15 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    rotateX: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 18,
      mass: 1.1
    }
  }
} as const;

export function AutoDashboard({
  widgets,
  title = "Auto Dashboard",
  connectionId,
  orgId,
  onSaved,
  readOnly = false,
}: AutoDashboardProps) {
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  if (!widgets || widgets.length === 0) {
    return <div className="text-slate-400">No dashboard data available.</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const board = await api.dashboards.create({
        title: title || "Untitled dashboard",
        widgets,
        connection_id: connectionId || null,
        org_id: orgId || null,
      });
      setSavedId(board?.id || "ok");
      toast.success("Dashboard saved — open Dashboards to view it anytime.", {
        action: {
          label: "View",
          onClick: () => {
            window.location.href = "/dashboard/boards";
          },
        },
      });
      onSaved?.(board);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      className="w-full mt-2 mb-2 perspective-1000"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</p>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {savedId && (
              <Link
                href="/dashboard/boards"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open Dashboards
              </Link>
            )}
            <Button
              size="sm"
              variant={savedId ? "secondary" : "default"}
              onClick={handleSave}
              disabled={saving}
              className="gap-2 h-8 text-xs"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : savedId ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {savedId ? "Saved" : "Save dashboard"}
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {widgets.map((widget, index) => (
          <motion.div
            key={`widget-${index}`}
            variants={itemVariants}
            className="flex flex-col bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden will-change-transform"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="px-5 py-4 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent flex items-center justify-between">
              <h3 className="font-bold text-slate-100 text-sm tracking-widest uppercase">
                {widget.title}
              </h3>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
              </div>
            </div>
            <div className="p-5 h-[320px] relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 opacity-50 pointer-events-none"></div>
              <ChartRenderer 
                tableData={widget.tableData} 
                visualizationType={widget.chartType} 
                isWidget={true}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
