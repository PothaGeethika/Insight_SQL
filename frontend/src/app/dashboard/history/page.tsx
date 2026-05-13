"use client";

import { motion } from "framer-motion";
import { History, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const history = [
  { query: "How many orders did we receive this week?", db: "PostgreSQL", time: "10 min ago" },
  { query: "Top 5 customers by total revenue", db: "MySQL", time: "2 hours ago" },
  { query: "Show monthly sales trend for 2025", db: "PostgreSQL", time: "6 hours ago" },
  { query: "List products with stock below 10", db: "PostgreSQL", time: "1 day ago" },
  { query: "Active users in the last 7 days", db: "MongoDB", time: "2 days ago" },
];

export default function HistoryPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-muted-foreground text-sm mt-1">Your recent queries and conversations.</p>
      </motion.div>

      <div className="space-y-3">
        {history.map((h, i) => (
          <motion.div key={h.query} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="hover:shadow-md transition-all cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <History className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{h.query}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{h.db}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {h.time}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
