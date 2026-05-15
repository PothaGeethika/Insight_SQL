"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Star,
  Database,
  MessageSquare,
  Folder,
  Search,
  MoreHorizontal,
  ArrowUpRight,
  Filter,
  LayoutGrid,
  List as ListIcon
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function FavoritesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [favDatabases, setFavDatabases] = useState<any[]>([]);
  const [favQuestions, setFavQuestions] = useState<any[]>([]);
  const [favFolders, setFavFolders] = useState<any[]>([]);

  useEffect(() => {
    // 1. Load Favorite Databases
    const savedDbIds = JSON.parse(localStorage.getItem("db_favorites") || "[]");
    fetch("http://localhost:8000/databases")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const favoritedDbs = data.filter(db => savedDbIds.includes(db.id));
          setFavDatabases(favoritedDbs);
        }
      })
      .catch(err => console.error("Error fetching databases for favorites:", err));

    // 2. Load Favorite Questions
    const savedFavQueries = JSON.parse(localStorage.getItem("favorite_queries") || "[]");
    setFavQuestions(savedFavQueries);

    // 3. Load Favorite History (Folders/Sessions)
    const savedSessions = JSON.parse(localStorage.getItem("chat_sessions") || "[]");
    const favoritedSessions = savedSessions.filter((s: any) => s.isFavorite);
    setFavFolders(favoritedSessions);
  }, []);

  const handleOpenChat = (sessionId: string) => {
    if (sessionId) {
      localStorage.setItem("current_session_id", sessionId);
      router.push("/dashboard/chat");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--surface-0)] text-slate-300 p-8 space-y-8 overflow-hidden">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shadow-2xl">
              <Star className="h-5 w-5 text-indigo-500 fill-indigo-500" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">Favorites</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium ml-1">Access your most important databases, questions, and folders.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Search favorites..."
              className="w-64 bg-[var(--surface-1)] border-slate-800 focus:border-indigo-500/50 h-10 pl-10 text-sm rounded-xl transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center bg-[var(--surface-1)] border border-slate-800 rounded-xl p-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("grid")}
              className={`h-8 w-8 rounded-lg ${viewMode === "grid" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("list")}
              className={`h-8 w-8 rounded-lg ${viewMode === "list" ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-white"}`}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" className="bg-[var(--surface-1)] border-slate-800 rounded-xl gap-2 text-xs font-black uppercase tracking-widest h-10">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-transparent border-b border-slate-900/50 w-full justify-start rounded-none h-12 p-0 mb-8">
          <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-8 text-sm font-black uppercase tracking-widest transition-all">All Favorites</TabsTrigger>
          <TabsTrigger value="databases" className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-8 text-sm font-black uppercase tracking-widest transition-all">Databases</TabsTrigger>
          <TabsTrigger value="questions" className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-8 text-sm font-black uppercase tracking-widest transition-all">Questions</TabsTrigger>
          <TabsTrigger value="folders" className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none px-8 text-sm font-black uppercase tracking-widest transition-all">History</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 -mx-2 px-2">
          <TabsContent value="all" className="mt-0 space-y-12 pb-20">

            {/* Databases Section */}
            {favDatabases.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Favorite Databases</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {favDatabases.map((db) => (
                    <motion.div key={db.id} whileHover={{ y: -5 }}>
                      <Card className="bg-[var(--surface-1)] border-slate-900 shadow-2xl rounded-3xl overflow-hidden group border-none">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-6">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                              <Database className="h-6 w-6" />
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-white rounded-lg">
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </div>
                          <div className="space-y-1 mb-6">
                            <h4 className="text-lg font-black text-white tracking-tight">{db.name}</h4>
                            <p className="text-xs text-slate-500 font-medium">{db.type} • {db.database}</p>
                          </div>
                          <div className="flex items-center justify-between pt-6 border-t border-slate-900/50">
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-none px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider">Connected</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Questions Section */}
            {favQuestions.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Saved Questions</h3>
                </div>
                <div className="space-y-3">
                  {favQuestions.map((q) => (
                    <Card
                      key={q.id}
                      className="bg-[var(--surface-1)] border-slate-900 hover:border-indigo-500/30 transition-all rounded-[24px] group border-none shadow-xl cursor-pointer"
                      onClick={() => handleOpenChat(q.sessionId)}
                    >
                      <CardContent className="p-5 flex items-center gap-5">
                        <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-indigo-500 transition-colors">
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">{q.question}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-600 font-bold">Added on {q.timestamp}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-600 hover:text-white rounded-xl">
                          <ArrowUpRight className="h-5 w-5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Folders/History Section */}
            {favFolders.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Favorite History</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {favFolders.map((folder) => (
                    <Card
                      key={folder.id}
                      className="bg-[var(--surface-1)] border-slate-900 rounded-3xl group border-none shadow-xl hover:bg-[var(--surface-2)] transition-all cursor-pointer"
                      onClick={() => handleOpenChat(folder.id)}
                    >
                      <CardContent className="p-6 flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-500">
                          <Folder className="h-7 w-7 fill-amber-500/20" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-base font-black text-white tracking-tight">{folder.title}</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{folder.messages?.length || 0} messages</p>
                        </div>
                        <ArrowUpRight className="h-5 w-5 text-slate-700 group-hover:text-white transition-colors" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {favDatabases.length === 0 && favQuestions.length === 0 && favFolders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Star className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-bold">No favorites added yet.</p>
                <p className="text-xs mt-1">Star databases, questions, or history sessions to see them here.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="databases">
            {/* Similar structure but only for databases */}
          </TabsContent>
          <TabsContent value="questions">
            {/* Similar structure but only for questions */}
          </TabsContent>
          <TabsContent value="folders">
            {/* Similar structure but only for folders */}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
