"use client";

import { motion } from "framer-motion";
import { History, Clock, MessageSquare, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/apiClient";
import { useWorkspace } from "@/lib/workspace";
import type { ChatSession } from "@/types";

function normalizeSession(s: any): ChatSession {
  return {
    id: s.id,
    title: s.title || "Untitled",
    active: false,
    messages: (s.messages || []).map((m: any) => ({
      ...m,
      sql: m.sql || m.sql_query,
      tableData: m.tableData || undefined,
    })),
    isFavorite: Boolean(s.isFavorite ?? s.is_favorite),
    updatedAt: s.updatedAt ?? s.updated_at,
  };
}

export default function HistoryPage() {
  const { activeOrgId } = useWorkspace();
  const [historyItems, setHistoryItems] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.history.list(activeOrgId);
      setHistoryItems(Array.isArray(data) ? data.map(normalizeSession) : []);
    } catch (e) {
      console.error("Error loading history", e);
      setHistoryItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-muted-foreground text-sm mt-1">Your recent conversations and query sessions.</p>
      </motion.div>

      {loading && (
        <div className="flex justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading history…
        </div>
      )}

      <div className="space-y-3">
        {!loading && historyItems.length > 0 ? (
          historyItems.map((h, i) => (
            <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link
                href="/dashboard/chat"
                onClick={() => localStorage.setItem("current_session_id", h.id)}
              >
                <Card className="hover:shadow-md transition-all cursor-pointer group border-l-4 border-l-blue-500 hover:border-l-blue-600">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                      <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {h.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {h.messages?.length || 0} messages • Conversation
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {h.updatedAt
                          ? new Date(
                              h.updatedAt < 1e12 ? h.updatedAt * 1000 : h.updatedAt
                            ).toLocaleDateString()
                          : "Recently"}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))
        ) : !loading ? (
          <div className="text-center py-20 border-2 border-dashed rounded-2xl">
            <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No history yet. Start a chat to see your conversations here.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
