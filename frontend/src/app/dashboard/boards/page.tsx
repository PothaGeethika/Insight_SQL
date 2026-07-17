"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Plus,
  Trash2,
  Loader2,
  Clock,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { useWorkspace } from "@/lib/workspace";
import { AutoDashboard, type DashboardWidget } from "@/components/AutoDashboard";
import { toast } from "sonner";

interface SavedBoard {
  id: string;
  title: string;
  widgets?: DashboardWidget[];
  connection_id?: string;
  org_id?: string;
  updated_at?: number;
  created_at?: number;
}

export default function BoardsPage() {
  const { activeOrgId, canEdit } = useWorkspace();
  const [boards, setBoards] = useState<SavedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBoard, setActiveBoard] = useState<SavedBoard | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.dashboards.list(activeOrgId);
      const list = Array.isArray(data) ? data : [];
      setBoards(
        list.map((b: any) => ({
          ...b,
          widgets:
            typeof b.widgets === "string"
              ? JSON.parse(b.widgets)
              : b.widgets || [],
        }))
      );
    } catch (e: any) {
      setBoards([]);
      setError(e?.message || "Failed to load dashboards.");
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!canEdit) {
      toast.error("Viewers cannot delete dashboards.");
      return;
    }
    if (!confirm("Delete this saved dashboard?")) return;
    try {
      await api.dashboards.delete(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
      if (activeBoard?.id === id) setActiveBoard(null);
      toast.success("Dashboard deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  };

  const filtered = boards.filter((b) =>
    (b.title || "").toLowerCase().includes(search.toLowerCase())
  );

  if (activeBoard) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setActiveBoard(null)} className="mb-2 -ml-2">
              ← Back to list
            </Button>
            <h1 className="text-2xl font-bold">{activeBoard.title}</h1>
          </div>
          <Link href="/dashboard/chat">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Chat
            </Button>
          </Link>
        </div>
        <AutoDashboard widgets={activeBoard.widgets || []} title={activeBoard.title} readOnly />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-indigo-500" />
            Saved dashboards
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reopen AutoDashboard boards saved from Chat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Link href="/dashboard/chat">
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
              <Plus className="h-4 w-4" />
              Generate in Chat
            </Button>
          </Link>
        </div>
      </motion.div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search dashboards…"
        className="h-11"
      />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <LayoutDashboard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No saved dashboards yet.</p>
          <Link href="/dashboard/chat">
            <Button variant="outline">Ask /dashboard in Chat</Button>
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((board, i) => (
          <motion.div
            key={board.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card
              className="hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setActiveBoard(board)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <LayoutDashboard className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-indigo-500">
                    {board.title || "Untitled dashboard"}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {(board.widgets || []).length} widgets
                    </Badge>
                    {(board.updated_at || board.created_at) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(
                          ((board.updated_at || board.created_at) as number) * (board.updated_at && board.updated_at < 1e12 ? 1000 : 1)
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(board.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
