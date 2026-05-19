"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Search, Filter, Trash2, ArrowRight, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function SavedQueriesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [dateFilter, setDateFilter] = useState("all");
  const [queries, setQueries] = useState<any[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("favorite_queries");
      if (saved) {
        const parsed = JSON.parse(saved);
        const mapped = parsed.map((item: any) => ({
          id: item.id,
          title: item.question || "Generated SQL Query",
          sql: item.sql || "",
          database: item.database || "PostgreSQL",
          sessionId: item.sessionId || null,
          date: new Date(item.timestamp || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        }));
        setQueries(mapped);
      }
    } catch (e) {
      console.error("Failed to load saved queries", e);
    }
  }, []);

  const handleDelete = (id: string) => {
    try {
      const saved = localStorage.getItem("favorite_queries");
      if (saved) {
        const parsed = JSON.parse(saved);
        const filtered = parsed.filter((item: any) => item.id !== id);
        localStorage.setItem("favorite_queries", JSON.stringify(filtered));
        setQueries(queries.filter((q) => q.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete query", e);
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
    <div className="h-full flex flex-col bg-[var(--surface-0)] text-slate-300 p-8 space-y-8 overflow-hidden">
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
                      className="h-9 w-9 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                      title="Delete Saved Query"
                    >
                      <Trash2 className="h-4 w-4" />
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
    </div>
  );
}
