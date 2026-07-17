"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Search, Filter, Trash2, ArrowRight, Clock, Plus, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisualExplain } from "@/components/VisualExplain";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/apiClient";
import { useWorkspace } from "@/lib/workspace";

function mapSavedQuery(item: any) {
  const ts = item.saved_at || item.timestamp || item.savedAt || Date.now();
  const ms = typeof ts === "number" && ts < 1e12 ? ts * 1000 : ts;
  return {
    id: item.id,
    title: item.question || item.title || "Generated SQL Query",
    sql: item.sql || item.sql_query || "",
    database: item.database || "PostgreSQL",
    connection_id: item.connection_id || null,
    sessionId: item.sessionId || item.session_id || null,
    date: new Date(ms).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

export default function SavedQueriesPage() {
  const router = useRouter();
  const { activeOrgId } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [dateFilter, setDateFilter] = useState("all");
  const [queries, setQueries] = useState<any[]>([]);

  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [explainData, setExplainData] = useState<any>(null);
  const [explainQuery, setExplainQuery] = useState("");
  const [isOptimizingExplain, setIsOptimizingExplain] = useState(false);
  const [explainOptimization, setExplainOptimization] = useState<any>(null);
  const [isFetchingExplain, setIsFetchingExplain] = useState(false);
  const [activeExplainConnectionId, setActiveExplainConnectionId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.savedQueries.list(activeOrgId);
        if (Array.isArray(data) && data.length > 0) {
          setQueries(data.map(mapSavedQuery));
          return;
        }
        // One-time migration from localStorage favorite_queries
        const migrated = localStorage.getItem("favorite_queries_migrated");
        const saved = localStorage.getItem("favorite_queries");
        if (!migrated && saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const item of parsed) {
              await api.savedQueries.save({
                id: item.id,
                question: item.question,
                answer: item.answer,
                sql: item.sql,
                tableData: item.tableData,
                database: item.database,
                saved_at: typeof item.timestamp === "number" ? item.timestamp : Date.now(),
                org_id: activeOrgId,
                connection_id: item.connection_id,
                sessionId: item.sessionId,
              }).catch(() => null);
            }
            localStorage.setItem("favorite_queries_migrated", "1");
            localStorage.removeItem("favorite_queries");
            const refreshed = await api.savedQueries.list(activeOrgId);
            setQueries(Array.isArray(refreshed) ? refreshed.map(mapSavedQuery) : []);
            return;
          }
        }
        setQueries([]);
      } catch (e) {
        console.error("Failed to load saved queries", e);
        setQueries([]);
      }
    };
    load();
  }, [activeOrgId]);

  const handleDelete = async (id: string) => {
    try {
      await api.savedQueries.delete(id);
      setQueries((prev) => prev.filter((q) => q.id !== id));
      toast.success("Saved query deleted");
    } catch (e) {
      console.error("Failed to delete query", e);
      toast.error("Failed to delete saved query");
    }
  };

  const handleAnalyzePerformance = async (query: string, connection_id?: string) => {
    if (!query) return;
    if (!connection_id) {
      toast.error("No database connection associated with this saved query.");
      return;
    }
    setIsExplainModalOpen(true);
    setExplainQuery(query);
    setExplainData(null);
    setExplainOptimization(null);
    setIsFetchingExplain(true);
    setActiveExplainConnectionId(connection_id);
    
    try {
      const res = await fetch("/api/backend/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, connection_id }),
      });
      const data = await res.json();
      if (res.ok) {
        setExplainData(data.plan);
      } else {
        toast.error("Failed to explain query: " + (data.detail || "Unknown error"));
        setIsExplainModalOpen(false);
      }
    } catch (e) {
      toast.error("Error analyzing performance.");
      setIsExplainModalOpen(false);
    } finally {
      setIsFetchingExplain(false);
    }
  };

  const handleOptimizeExplain = async () => {
    if (!activeExplainConnectionId || !explainQuery || !explainData) return;
    setIsOptimizingExplain(true);
    
    try {
      const res = await fetch("/api/backend/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: explainQuery, 
          explain_json: explainData,
          connection_id: activeExplainConnectionId,
          provider: "gemini",
          model: "gemini-2.0-flash"
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setExplainOptimization(data);
      } else {
        toast.error("Failed to optimize query: " + (data.detail || "Unknown error"));
      }
    } catch (e) {
      toast.error("Error optimizing performance.");
    } finally {
      setIsOptimizingExplain(false);
    }
  };

  const handleRunQuery = (q: any) => {
    if (q.sessionId) {
      localStorage.setItem("insight_current_session_id", q.sessionId);
    }
    if (q.id) {
      localStorage.setItem("insight_run_saved_query_msg_id", q.id);
    }
    router.push("/dashboard/chat");
  };

  const processItems = (items: any[]) => {
    let processed = items.map((item, idx) => ({ item, originalIndex: idx })).filter(({ item }) => 
      (item.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sql || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.database || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (dateFilter !== "all") {
      const now = new Date();
      processed = processed.filter(({ item }) => {
        const itemDateStr = item.date;
        if (!itemDateStr) return true; 
        
        let itemDate = new Date(itemDateStr);
        if (isNaN(itemDate.getTime())) return true; 

        const diffTime = Math.abs(now.getTime() - itemDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (dateFilter === "today") return diffDays <= 1;
        if (dateFilter === "week") return diffDays <= 7;
        return true;
      });
    }

    processed.sort((aObj, bObj) => {
      const a = aObj.item;
      const b = bObj.item;
      if (sortBy === "az") {
        const valA = (a.title || "").toLowerCase();
        const valB = (b.title || "").toLowerCase();
        return valA.localeCompare(valB);
      } else {
        const timeA = new Date(a.date || 0).getTime();
        const timeB = new Date(b.date || 0).getTime();
        
        const validTimeA = isNaN(timeA) || timeA === 0 ? aObj.originalIndex : timeA;
        const validTimeB = isNaN(timeB) || timeB === 0 ? bObj.originalIndex : timeB;

        if (sortBy === "newest") {
          return validTimeB - validTimeA;
        } else {
          return validTimeA - validTimeB;
        }
      }
    });

    return processed.map(obj => obj.item);
  };

  const filteredQueries = processItems(queries);

  return (
    <div className="h-full flex flex-col bg-[var(--surface-0)] dark:bg-transparent text-slate-300 p-8 space-y-8 overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shadow-2xl">
              <Bookmark className="h-5 w-5 text-indigo-500" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Saved Queries</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium ml-1">Manage and execute your curated SQL library.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
            <Input 
              placeholder="Search queries..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 bg-[var(--surface-1)] border-slate-800 focus:border-indigo-500/50 h-10 pl-10 text-sm rounded-xl text-white"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex shrink-0 items-center justify-center bg-[var(--surface-1)] border border-slate-800 hover:bg-[var(--surface-2)] hover:text-white rounded-xl gap-2 text-xs font-black uppercase tracking-widest h-10 px-4 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filter
              {(sortBy !== "newest" || dateFilter !== "all") && (
                <Badge className="ml-1 px-1.5 h-5 bg-indigo-500 hover:bg-indigo-600 text-white border-none rounded">1</Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[var(--surface-1)] border-slate-800 text-slate-300">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-black text-white text-xs uppercase tracking-widest">Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                  <DropdownMenuRadioItem value="newest" className="focus:bg-[var(--surface-2)] focus:text-white cursor-pointer">Newest First</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="oldest" className="focus:bg-[var(--surface-2)] focus:text-white cursor-pointer">Oldest First</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="az" className="focus:bg-[var(--surface-2)] focus:text-white cursor-pointer">Alphabetical (A-Z)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="bg-slate-800 my-1" />
              
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-black text-white text-xs uppercase tracking-widest">Date Added</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuRadioGroup value={dateFilter} onValueChange={setDateFilter}>
                  <DropdownMenuRadioItem value="all" className="focus:bg-[var(--surface-2)] focus:text-white cursor-pointer">All Time</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="today" className="focus:bg-[var(--surface-2)] focus:text-white cursor-pointer">Added Today</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="week" className="focus:bg-[var(--surface-2)] focus:text-white cursor-pointer">Last 7 Days</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="grid grid-cols-1 gap-4 pb-20">
          {filteredQueries.map((q) => (
            <Card key={q.id} className="bg-[var(--surface-1)] border-slate-900 hover:border-indigo-500/30 transition-all rounded-[24px] group border-none shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-white tracking-tight group-hover:text-indigo-400 transition-colors">{q.title}</h3>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-slate-900 text-slate-400 border-none px-2 py-0 rounded-md text-[9px] font-black uppercase tracking-wider">{q.database}</Badge>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                        <Clock className="h-3 w-3" />
                        {q.date}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(q.id)}
                      className="h-9 w-9 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer mr-2"
                      title="Delete Saved Query"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleAnalyzePerformance(q.sql, q.connection_id)}
                      className="h-9 px-4 border border-slate-800 text-slate-300 hover:text-blue-500 hover:border-blue-500/50 hover:bg-blue-500/10 text-[10px] font-black rounded-xl uppercase tracking-widest gap-2 transition-all cursor-pointer"
                    >
                      <Activity className="h-3.5 w-3.5" />
                      Analyze
                    </Button>
                    <Button 
                      onClick={() => handleRunQuery(q)}
                      className="h-9 px-5 bg-[var(--surface-2)] hover:bg-indigo-600 border border-slate-800 hover:border-indigo-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest gap-2 transition-all cursor-pointer"
                    >
                      Run Query
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="bg-[var(--surface-0)] rounded-xl p-4 border border-slate-900/50">
                  <code className="text-xs font-mono text-emerald-400/80 line-clamp-1">{q.sql}</code>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredQueries.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/10 max-w-xl mx-auto my-10">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/25">
                <Bookmark className="h-8 w-8 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">No Saved Queries</h3>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-sm">
                {searchQuery
                  ? "No saved queries match your search query. Try typing something else!"
                  : "You haven't saved any SQL queries yet. Save your favorite queries directly from the chat page to create your collection!"
                }
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={isExplainModalOpen} onOpenChange={setIsExplainModalOpen}>
        <DialogContent className="max-w-[90vw] w-[1200px] h-[90vh] flex flex-col p-6 border-slate-800 bg-[#0a0a0f] text-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <Activity className="h-6 w-6 text-blue-500" />
              Visual EXPLAIN PLAN
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Interactive query execution plan analysis
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden mt-4">
            {isFetchingExplain ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p>Generating execution plan...</p>
              </div>
            ) : explainData ? (
              <VisualExplain 
                plan={explainData} 
                query={explainQuery} 
                connectionId={activeExplainConnectionId}
                optimization={explainOptimization}
                isOptimizing={isOptimizingExplain}
                onOptimize={handleOptimizeExplain}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
