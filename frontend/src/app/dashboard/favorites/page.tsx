"use client";

import { useState, useEffect } from "react";
import * as React from "react";
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
  Clock,
  Trash2,
  Bookmark,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { toast } from "sonner";

export default function FavoritesPage() {
  const router = useRouter();
  const { activeOrgId } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [dateFilter, setDateFilter] = useState("all");

  const [favDatabases, setFavDatabases] = useState<any[]>([]);
  const [favQuestions, setFavQuestions] = useState<any[]>([]);
  const [favProjects, setFavProjects] = useState<any[]>([]);
  const [favFolders, setFavFolders] = useState<any[]>([]);

  const loadFavorites = async () => {
    // 1. Load Favorite Databases (still local preference list)
    const savedDbIds = JSON.parse(localStorage.getItem("db_favorites") || "[]");
    api.databases
      .list(activeOrgId)
      .then((data) => {
        if (Array.isArray(data)) {
          setFavDatabases(data.filter((db) => savedDbIds.includes(db.id)));
        }
      })
      .catch(() => setFavDatabases([]));

    // 2. Load Saved / Favorite Queries from backend
    try {
      const data = await api.savedQueries.list(activeOrgId);
      setFavQuestions(Array.isArray(data) ? data : []);
    } catch {
      setFavQuestions([]);
    }

    // 3. Load Favorite Projects
    try {
      const data = await api.projects.list(activeOrgId);
      if (Array.isArray(data)) {
        setFavProjects(data.filter((p: any) => p.isFavorite || p.is_favorite));
      }
    } catch {
      setFavProjects([]);
    }

    // 4. Load Favorite History (Sessions)
    try {
      const data = await api.history.list(activeOrgId);
      if (Array.isArray(data)) {
        setFavFolders(
          data.filter((s: any) => s.isFavorite || s.is_favorite).map((s: any) => ({
            ...s,
            isFavorite: true,
            title: s.title,
          }))
        );
      }
    } catch {
      setFavFolders([]);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [activeOrgId]);

  const handleOpenChat = (sessionId: string) => {
    if (sessionId) {
      localStorage.setItem("current_session_id", sessionId);
      router.push("/dashboard/chat");
    }
  };

  const handleOpenProject = (projectId: string) => {
    router.push("/dashboard/projects");
  };

  const handleOpenDatabase = (dbId: string) => {
    router.push("/dashboard/databases");
  };

  const handleRemoveFavoriteDb = (dbId: string) => {
    const saved = JSON.parse(localStorage.getItem("db_favorites") || "[]");
    const updated = saved.filter((id: string) => id !== dbId);
    localStorage.setItem("db_favorites", JSON.stringify(updated));
    setFavDatabases(favDatabases.filter((db: any) => db.id !== dbId));
  };

  const handleRemoveFavoriteQuestion = async (qId: string) => {
    try {
      await api.savedQueries.delete(qId);
      setFavQuestions((prev) => prev.filter((q: any) => q.id !== qId));
      toast.success("Removed from saved queries");
    } catch (e) {
      console.error("Error removing favorite query:", e);
      toast.error("Failed to remove");
    }
  };

  const handleRemoveFavoriteProject = async (projectId: string) => {
    const project = favProjects.find((p) => p.id === projectId);
    if (!project) return;
    try {
      await api.projects.update(projectId, { ...project, isFavorite: false });
      loadFavorites();
    } catch (e) {
      console.error("Error removing favorite project:", e);
    }
  };

  const handleRemoveFavoriteHistory = async (sessionId: string) => {
    const session = favFolders.find((s) => s.id === sessionId);
    if (!session) return;
    try {
      await api.history.upsert(sessionId, {
        title: session.title,
        isFavorite: false,
        updatedAt: Date.now(),
        org_id: activeOrgId,
        messages: session.messages,
      });
      setFavFolders((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (e) {
      console.error("Error removing favorite session:", e);
    }
  };

  // Filter and Sort logic
  const processItems = (items: any[], searchKey: string) => {
    // 1. Text Search & Attach Index for Fallback Sorting
    let processed = items.map((item, idx) => ({ item, originalIndex: idx })).filter(({ item }) => 
      (item[searchKey] || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // 2. Date Added Filter
    if (dateFilter !== "all") {
      const now = new Date();
      processed = processed.filter(({ item }) => {
        const itemDateStr = item.timestamp || item.updatedAt || item.createdAt;
        if (!itemDateStr) return true; 
        
        let itemDate = new Date(itemDateStr);
        if (isNaN(itemDate.getTime())) return true; // Keep items with unparseable dates

        const diffTime = Math.abs(now.getTime() - itemDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (dateFilter === "today") return diffDays <= 1;
        if (dateFilter === "week") return diffDays <= 7;
        return true;
      });
    }

    // 3. Sorting
    processed.sort((aObj, bObj) => {
      const a = aObj.item;
      const b = bObj.item;
      if (sortBy === "az") {
        const valA = (a[searchKey] || "").toLowerCase();
        const valB = (b[searchKey] || "").toLowerCase();
        return valA.localeCompare(valB);
      } else {
        const timeA = new Date(a.timestamp || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.timestamp || b.updatedAt || b.createdAt || 0).getTime();
        
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

  const filteredDbs = processItems(favDatabases, "name");
  const filteredQuestions = processItems(favQuestions, "question");
  const filteredProjects = processItems(favProjects, "title");
  const filteredHistory = processItems(favFolders, "title");

  const totalFavsCount = favDatabases.length + favQuestions.length + favProjects.length + favFolders.length;

  const sidebarItems = [
    { id: "all", label: "All Favorites", count: totalFavsCount, icon: Star, color: "text-amber-500 fill-amber-500 bg-amber-500/10" },
    { id: "databases", label: "Databases", count: favDatabases.length, icon: Database, color: "text-blue-500 bg-blue-500/10" },
    { id: "questions", label: "Questions", count: favQuestions.length, icon: MessageSquare, color: "text-indigo-500 bg-indigo-500/10" },
    { id: "projects", label: "Projects", count: favProjects.length, icon: Folder, color: "text-purple-500 bg-purple-500/10" },
    { id: "history", label: "History", count: favFolders.length, icon: Clock, color: "text-emerald-500 bg-emerald-500/10" },
  ];

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <div className="h-full flex flex-col bg-[var(--surface-0)] dark:bg-transparent text-slate-900 dark:text-slate-300 p-8 space-y-8 overflow-hidden">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center shadow-2xl">
              <Star className="h-5 w-5 text-indigo-500 fill-indigo-500 animate-pulse" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Favorites</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-500 text-sm font-medium ml-1">Access your favorited databases, projects, questions, and session history.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Search favorites..."
              className="w-64 bg-[var(--surface-1)] border-slate-200 dark:border-slate-800 focus:border-indigo-500/50 h-10 pl-10 text-sm rounded-xl transition-all text-slate-900 dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex shrink-0 items-center justify-center bg-[var(--surface-1)] border border-slate-200 dark:border-slate-800 hover:bg-[var(--surface-2)] text-slate-800 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl gap-2 text-xs font-black uppercase tracking-widest h-10 px-4 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filter
              {(sortBy !== "newest" || dateFilter !== "all") && (
                <Badge className="ml-1 px-1.5 h-5 bg-indigo-500 hover:bg-indigo-600 text-white border-none rounded">1</Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-[var(--surface-1)] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-300">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-widest">Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                  <DropdownMenuRadioItem value="newest" className="focus:bg-slate-100 dark:focus:bg-[var(--surface-2)] focus:text-slate-900 dark:focus:text-white cursor-pointer">Newest First</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="oldest" className="focus:bg-slate-100 dark:focus:bg-[var(--surface-2)] focus:text-slate-900 dark:focus:text-white cursor-pointer">Oldest First</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="az" className="focus:bg-slate-100 dark:focus:bg-[var(--surface-2)] focus:text-slate-900 dark:focus:text-white cursor-pointer">Alphabetical (A-Z)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="bg-slate-800 my-1" />
              
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-black text-slate-900 dark:text-white text-xs uppercase tracking-widest">Date Added</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuRadioGroup value={dateFilter} onValueChange={setDateFilter}>
                  <DropdownMenuRadioItem value="all" className="focus:bg-slate-100 dark:focus:bg-[var(--surface-2)] focus:text-slate-900 dark:focus:text-white cursor-pointer">All Time</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="today" className="focus:bg-slate-100 dark:focus:bg-[var(--surface-2)] focus:text-slate-900 dark:focus:text-white cursor-pointer">Added Today</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="week" className="focus:bg-slate-100 dark:focus:bg-[var(--surface-2)] focus:text-slate-900 dark:focus:text-white cursor-pointer">Last 7 Days</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex gap-8 min-h-0 overflow-hidden">
        
        {/* Left Side Bar Boxes */}
        <div className="w-64 flex flex-col gap-3 shrink-0">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                  isActive 
                    ? "bg-indigo-600/15 border-indigo-500/35 text-indigo-700 dark:text-white shadow-lg shadow-indigo-650/5" 
                    : "bg-white dark:bg-[var(--surface-1)] border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-[var(--surface-2)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                    isActive ? "bg-indigo-600 text-white" : item.color
                  }`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-sm font-bold tracking-tight">{item.label}</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`text-[10px] font-black rounded-lg px-2 py-0.5 border transition-all ${
                    isActive 
                      ? "bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border-indigo-550/20" 
                      : "bg-slate-100 dark:bg-slate-900/60 text-slate-500 border-slate-200 dark:border-slate-800/80 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                  }`}
                >
                  {item.count}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Right Scrollable Content Pane */}
        <ScrollArea className="flex-1 -mx-2 px-2 h-full">
          <div className="space-y-10 pb-20">
            
            {/* PROJECTS SECTION */}
            {(activeTab === "all" || activeTab === "projects") && filteredProjects.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <Folder className="h-4 w-4 text-purple-400" />
                    Favorite Projects
                  </h3>
                  <Badge className="bg-purple-500/10 text-purple-400 border-none rounded-md text-[10px] font-bold px-2">{filteredProjects.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredProjects.map((project) => (
                    <motion.div key={project.id} variants={itemVariants} initial="hidden" animate="show" whileHover={{ y: -4 }} className="h-full">
                      <Card 
                        className="bg-[var(--surface-1)] border border-slate-850 hover:border-slate-700/80 shadow-2xl rounded-3xl overflow-hidden group flex flex-col h-full cursor-pointer hover:bg-[var(--surface-2)] transition-all"
                        onClick={() => handleOpenProject(project.id)}
                      >
                        <CardContent className="p-6 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner group-hover:bg-purple-600 group-hover:text-white transition-all duration-500">
                              <Folder className="h-6 w-6" />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFavoriteProject(project.id);
                              }}
                              className="h-8 w-8 text-amber-400 hover:text-slate-500 rounded-lg cursor-pointer z-10"
                              title="Unfavorite"
                            >
                              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                            </Button>
                          </div>
                          <div className="space-y-1 mb-6 flex-1">
                            <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{project.title}</h4>
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{project.description}</p>
                          </div>
                          <div className="flex items-center gap-2 pt-4 border-t border-slate-900/60">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              {project.databases?.length || 0} Connected DBs
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* DATABASES SECTION */}
            {(activeTab === "all" || activeTab === "databases") && filteredDbs.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    Favorite Databases
                  </h3>
                  <Badge className="bg-blue-500/10 text-blue-400 border-none rounded-md text-[10px] font-bold px-2">{filteredDbs.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredDbs.map((db) => (
                    <motion.div key={db.id} variants={itemVariants} initial="hidden" animate="show" whileHover={{ y: -4 }}>
                      <Card 
                        className="bg-[var(--surface-1)] border border-slate-850 hover:border-slate-700/80 shadow-2xl rounded-3xl overflow-hidden group flex flex-col h-full border-none cursor-pointer hover:bg-[var(--surface-2)] transition-all"
                        onClick={() => handleOpenDatabase(db.id)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                              <Database className="h-6 w-6" />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFavoriteDb(db.id);
                              }}
                              className="h-8 w-8 text-amber-400 hover:text-slate-500 rounded-lg cursor-pointer z-10"
                              title="Unfavorite"
                            >
                              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                            </Button>
                          </div>
                          <div className="space-y-1 mb-6">
                            <h4 className="text-lg font-black text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{db.name}</h4>
                            <p className="text-xs text-slate-500 font-medium">{db.type} • {db.database || "Database"}</p>
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-slate-900/60">
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-none px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider">Connected</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* QUESTIONS SECTION */}
            {(activeTab === "all" || activeTab === "questions") && filteredQuestions.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-400" />
                    Saved Questions
                  </h3>
                  <Badge className="bg-indigo-500/10 text-indigo-400 border-none rounded-md text-[10px] font-bold px-2">{filteredQuestions.length}</Badge>
                </div>
                <div className="space-y-3">
                  {filteredQuestions.map((q) => (
                    <motion.div key={q.id} variants={itemVariants} initial="hidden" animate="show">
                      <Card
                        className="bg-[var(--surface-1)] border border-slate-850 hover:border-slate-700/80 hover:bg-[var(--surface-2)] transition-all rounded-[24px] group border-none shadow-xl cursor-pointer"
                      >
                        <CardContent className="p-5 flex items-center gap-5">
                          <div 
                            className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-indigo-550 transition-colors shrink-0"
                            onClick={() => handleOpenChat(q.sessionId)}
                          >
                            <MessageSquare className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0" onClick={() => handleOpenChat(q.sessionId)}>
                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">{q.question}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-slate-650 font-bold uppercase tracking-wider">Added on {q.timestamp}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRemoveFavoriteQuestion(q.id)}
                              className="h-9 w-9 text-amber-400 hover:text-slate-500 rounded-xl cursor-pointer"
                              title="Unfavorite"
                            >
                              <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleOpenChat(q.sessionId)}
                              className="h-9 w-9 text-slate-600 hover:text-white rounded-xl"
                            >
                              <ArrowUpRight className="h-5 w-5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* HISTORY SECTION */}
            {(activeTab === "all" || activeTab === "history") && filteredHistory.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    Favorite Sessions
                  </h3>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-none rounded-md text-[10px] font-bold px-2">{filteredHistory.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredHistory.map((folder) => (
                    <motion.div key={folder.id} variants={itemVariants} initial="hidden" animate="show" whileHover={{ y: -4 }}>
                      <Card className="bg-[var(--surface-1)] border border-slate-850 hover:border-slate-700/80 shadow-xl hover:bg-[var(--surface-2)] transition-all rounded-3xl overflow-hidden group flex flex-col h-full border-none">
                        <CardContent className="p-6 flex items-center gap-6 cursor-pointer">
                          <div 
                            className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-500 shrink-0"
                            onClick={() => handleOpenChat(folder.id)}
                          >
                            <Clock className="h-7 w-7" />
                          </div>
                          <div className="flex-1 min-w-0" onClick={() => handleOpenChat(folder.id)}>
                            <h4 className="text-base font-black text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">{folder.title}</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{folder.messages?.length || 0} messages</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFavoriteHistory(folder.id);
                              }}
                              className="h-9 w-9 text-amber-400 hover:text-slate-500 rounded-xl cursor-pointer"
                              title="Unfavorite"
                            >
                              <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
                            </Button>
                            <ArrowUpRight className="h-5 w-5 text-slate-750 group-hover:text-white transition-colors" onClick={() => handleOpenChat(folder.id)} />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* EMPTY STATE fallback for active Tab */}
            {((activeTab === "all" && totalFavsCount === 0) ||
              (activeTab === "databases" && filteredDbs.length === 0) ||
              (activeTab === "questions" && filteredQuestions.length === 0) ||
              (activeTab === "projects" && filteredProjects.length === 0) ||
              (activeTab === "history" && filteredHistory.length === 0)) && (
              <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/10 max-w-xl mx-auto my-10 text-center">
                <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/25">
                  <Star className="h-8 w-8 animate-pulse text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">No Favorites Found</h3>
                <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-sm">
                  {searchQuery 
                    ? "No favorited items match your current search query." 
                    : `You haven't added any favorited ${activeTab === "all" ? "items" : activeTab} yet! Star items across your dashboard to see them here.`
                  }
                </p>
              </div>
            )}

          </div>
        </ScrollArea>

      </div>
    </div>
  );
}
