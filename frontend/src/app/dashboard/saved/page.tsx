"use client";

import { motion } from "framer-motion";
import { BookmarkCheck, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Legacy mock Saved page — demoted in favor of /dashboard/saved-queries
 * which is wired to the backend /saved-queries API.
 */
export default function SavedQueriesRedirectPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Saved Queries</h1>
        <p className="text-muted-foreground text-sm mt-1">
          This mock page has been replaced by the live Saved Queries library.
        </p>
      </motion.div>

      <Card>
        <CardContent className="p-8 flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <BookmarkCheck className="h-6 w-6 text-indigo-500" />
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Your bookmarked queries now sync via the backend. Open the Saved Queries page to manage them.
          </p>
          <Link href="/dashboard/saved-queries">
            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2">
              Go to Saved Queries
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
