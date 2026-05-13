"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

export default function FavoritesPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Favorites</h1>
        <p className="text-muted-foreground text-sm mt-1">Your favorite queries and databases.</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center justify-center py-20 text-center"
      >
        <div className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-4">
          <Star className="h-7 w-7 text-amber-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No favorites yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Star your most-used queries and databases for quick access. They&apos;ll appear here.
        </p>
      </motion.div>
    </div>
  );
}
