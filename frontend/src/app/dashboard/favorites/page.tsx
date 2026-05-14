"use client";

import { motion } from "framer-motion";
import { Star, MessageSquare, Database, ArrowRight, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FavoritesPage() {
  const [favoriteSessions, setFavoriteSessions] = useState<any[]>([]);
  const [favoriteDbs, setFavoriteDbs] = useState<any[]>([]);
  const [favoriteQueries, setFavoriteQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      // Load sessions
      const sessions = localStorage.getItem("chat_sessions");
      if (sessions) {
        const parsed = JSON.parse(sessions);
        setFavoriteSessions(parsed.filter((s: any) => s.isFavorite));
      }

      // Load databases (needs fetch to get names)
      const favoriteDbIds = localStorage.getItem("db_favorites");
      if (favoriteDbIds) {
        try {
          const ids = JSON.parse(favoriteDbIds);
          const response = await fetch("http://localhost:8000/databases");
          const allDbs = await response.json();
          setFavoriteDbs(allDbs.filter((db: any) => ids.includes(db.id)));
        } catch (e) {
          console.error("Error loading favorite databases", e);
        }
      }
      // Load individual favorite queries
      const queries = localStorage.getItem("favorite_queries");
      if (queries) {
        setFavoriteQueries(JSON.parse(queries));
      }
      setLoading(false);
    };

    loadFavorites();
  }, []);

  const hasFavorites = favoriteSessions.length > 0 || favoriteDbs.length > 0 || favoriteQueries.length > 0;

  if (loading) return <div className="p-8 text-center">Loading favorites...</div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-10">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Favorites</h1>
        <p className="text-muted-foreground text-sm mt-1">Your quick-access queries and data sources.</p>
      </motion.div>

      {!hasFavorites ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-3xl"
        >
          <div className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4">
            <Star className="h-7 w-7 text-amber-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm px-4">
            Star your most-used queries in Chat or databases in the Database section for quick access.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-8">
          {favoriteSessions.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Favorite Conversations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {favoriteSessions.map((s) => (
                  <Link key={s.id} href="/dashboard/chat" onClick={() => localStorage.setItem("current_session_id", s.id)}>
                    <Card className="hover:shadow-lg transition-all border-l-4 border-l-amber-500 group">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-medium truncate">{s.title}</p>
                            <p className="text-[10px] text-muted-foreground">{s.messages?.length || 0} messages</p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

           {favoriteDbs.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Database className="h-4 w-4" />
                Favorite Databases
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {favoriteDbs.map((db) => (
                  <Card key={db.id} className="hover:shadow-lg transition-all border-l-4 border-l-amber-500 group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                          <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{db.name}</p>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{db.type}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{db.database}</p>
                        </div>
                      </div>
                      <Link href="/dashboard/chat">
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                          Query <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {favoriteQueries.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Star className="h-4 w-4" />
                Favorite Queries
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {favoriteQueries.map((q) => (
                  <Card key={q.id} className="hover:shadow-md transition-all border-l-4 border-l-amber-500 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-4 bg-muted/30">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-semibold text-foreground leading-relaxed">
                              {q.question}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {q.timestamp}
                            </p>
                          </div>
                          <Link href="/dashboard/chat" onClick={() => q.sessionId && localStorage.setItem("current_session_id", q.sessionId)}>
                             <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-amber-500">
                               <ArrowRight className="h-4 w-4" />
                             </Button>
                          </Link>
                        </div>
                      </div>
                      <div className="p-4 border-t border-dashed bg-background">
                         <div className="flex items-center gap-2 mb-2">
                           <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">Response</Badge>
                         </div>
                         <p className="text-sm text-muted-foreground line-clamp-3 italic">
                           "{q.answer}"
                         </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
