"use client";

import { motion } from "framer-motion";
import { BookmarkCheck, Search, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const savedQueries = [
  {
    title: "Top customers by revenue this month",
    db: "PostgreSQL",
    savedAt: "2 hours ago",
    tags: ["revenue", "customers"],
  },
  {
    title: "Monthly sales trend comparison",
    db: "MySQL",
    savedAt: "1 day ago",
    tags: ["sales", "trends"],
  },
  {
    title: "Inactive users in the last 30 days",
    db: "PostgreSQL",
    savedAt: "3 days ago",
    tags: ["users", "activity"],
  },
  {
    title: "Low stock products alert",
    db: "PostgreSQL",
    savedAt: "5 days ago",
    tags: ["inventory"],
  },
];

export default function SavedQueriesPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Saved Queries</h1>
        <p className="text-muted-foreground text-sm mt-1">Your bookmarked queries for quick access.</p>
      </motion.div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search saved queries..." className="pl-10 h-11" />
      </div>

      <div className="space-y-3">
        {savedQueries.map((q, i) => (
          <motion.div
            key={q.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="hover:shadow-md transition-all group cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center flex-shrink-0">
                  <BookmarkCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {q.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{q.db}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{q.savedAt}</span>
                    {q.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Play className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
