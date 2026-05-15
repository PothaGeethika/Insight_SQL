"use client";

import React from "react";
import { Bookmark, Search, Filter, MoreHorizontal, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const savedQueries = [
  { id: 1, title: "Quarterly Revenue Growth", sql: "SELECT date_trunc('quarter', created_at)...", database: "Ecommerce DB", date: "May 18, 2025" },
  { id: 2, title: "Churn Rate Calculation", sql: "WITH active_users AS (SELECT count(*)...", database: "User Analytics", date: "May 16, 2025" },
  { id: 3, title: "Inventory Low Stock Alert", sql: "SELECT product_name, stock_level FROM...", database: "Ecommerce DB", date: "May 14, 2025" },
  { id: 4, title: "Customer Segment Analysis", sql: "SELECT segment, avg(lifetime_value)...", database: "Ecommerce DB", date: "May 12, 2025" },
];

export default function SavedQueriesPage() {
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
              className="w-64 bg-[var(--surface-1)] border-slate-800 focus:border-indigo-500/50 h-10 pl-10 text-sm rounded-xl"
            />
          </div>
          <Button variant="outline" className="bg-[var(--surface-1)] border-slate-800 rounded-xl gap-2 text-xs font-black uppercase tracking-widest h-10">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest h-10 px-6">
            New Query
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="grid grid-cols-1 gap-4 pb-20">
          {savedQueries.map((q) => (
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
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600 hover:text-white rounded-xl">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                    <Button className="h-9 px-5 bg-[var(--surface-2)] hover:bg-indigo-600 border border-slate-800 hover:border-indigo-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest gap-2 transition-all">
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
        </div>
      </ScrollArea>
    </div>
  );
}
