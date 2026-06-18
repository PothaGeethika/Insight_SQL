"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  MoreHorizontal,
  RefreshCw,
  Lock,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Table2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

const tableData = {
  headers: ["order_id", "customer_id", "order_date", "status", "total_amount"],
  rows: [
    ["#001", "CUST_001", "2025-05-12", "Completed", "$129.99"],
    ["#002", "CUST_045", "2025-05-12", "Completed", "$89.00"],
    ["#003", "CUST_102", "2025-05-12", "Completed", "$210.50"],
    ["#004", "CUST_078", "2025-05-12", "Processing", "$45.80"],
    ["#005", "CUST_019", "2025-05-12", "Completed", "$74.20"],
    ["#006", "CUST_156", "2025-05-11", "Completed", "$315.00"],
    ["#007", "CUST_033", "2025-05-11", "Cancelled", "$62.40"],
    ["#008", "CUST_091", "2025-05-11", "Completed", "$189.99"],
  ],
};

const barChartData = [
  { label: "May 12", value: 85 },
  { label: "May 13", value: 65 },
  { label: "May 14", value: 90 },
  { label: "May 15", value: 55 },
  { label: "May 16", value: 78 },
  { label: "May 17", value: 70 },
  { label: "May 18", value: 60 },
];

const donutData = [
  { label: "Completed", value: 280, percent: "82%", color: "#3b82f6" },
  { label: "Processing", value: 12, percent: "5%", color: "#f59e0b" },
  { label: "Cancelled", value: 8, percent: "3%", color: "#ef4444" },
];

export default function ResultsPage() {
  const maxBarValue = Math.max(...barChartData.map((d) => d.value));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Link href="/dashboard/chat">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold">
              How many orders did we receive this week?
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-sm">
            <Download className="h-3.5 w-3.5 mr-2" />
            Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Save Query</DropdownMenuItem>
              <DropdownMenuItem>Share Results</DropdownMenuItem>
              <DropdownMenuItem>Download CSV</DropdownMenuItem>
              <DropdownMenuItem>Download PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="results" className="space-y-6">
        <TabsList className="bg-muted/50 h-10">
          <TabsTrigger value="results" className="text-sm px-4">
            <Table2 className="h-3.5 w-3.5 mr-1.5" />
            Results
          </TabsTrigger>
          <TabsTrigger value="sql" className="text-sm px-4">
            SQL
          </TabsTrigger>
          <TabsTrigger value="chart" className="text-sm px-4">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Chart
          </TabsTrigger>
          <TabsTrigger value="insight" className="text-sm px-4">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Insight
          </TabsTrigger>
        </TabsList>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {/* Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-100 dark:border-blue-900/50">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-300">Summary</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  You received <span className="font-bold text-blue-600 dark:text-blue-400">250 orders</span> this
                  week (May 12 – May 18, 2025), which is a{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">↑ 18.7% higher</span> than
                  last week (211 orders).
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Data Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                  <p className="text-sm font-semibold">
                    Results <span className="text-muted-foreground font-normal">(250)</span>
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30">
                        {tableData.headers.map((h) => (
                          <th
                            key={h}
                            className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.05 }}
                          className="border-t hover:bg-muted/20 transition-colors"
                        >
                          {row.map((cell, j) => (
                            <td key={j} className="px-5 py-3 text-sm">
                              {cell === "Completed" ? (
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs">
                                  {cell}
                                </Badge>
                              ) : cell === "Processing" ? (
                                <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-xs">
                                  {cell}
                                </Badge>
                              ) : cell === "Cancelled" ? (
                                <Badge variant="secondary" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs">
                                  {cell}
                                </Badge>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between px-5 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Showing 1 to 10 of 250 results
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    {[1, 2, 3, "...", 25].map((p, i) => (
                      <Button
                        key={i}
                        variant={p === 1 ? "default" : "ghost"}
                        size="icon"
                        className={`h-7 w-7 text-xs ${p === 1 ? "bg-blue-600 text-white hover:bg-blue-700" : ""}`}
                      >
                        {p}
                      </Button>
                    ))}
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold mb-4">Orders by Day</h3>
                  <div className="flex items-end gap-3 h-48">
                    {barChartData.map((d, i) => (
                      <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(d.value / maxBarValue) * 100}%` }}
                          transition={{ delay: 0.5 + i * 0.1, duration: 0.5, ease: "easeOut" }}
                          className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-md min-h-[4px]"
                        />
                        <span className="text-[10px] text-muted-foreground">{d.label.split(" ")[1]}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Donut Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold mb-4">Orders by Status</h3>
                  <div className="flex items-center gap-8">
                    {/* SVG Donut */}
                    <div className="relative w-32 h-32 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="3" />
                        <motion.circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                          strokeDasharray="72 88"
                          strokeLinecap="round"
                          initial={{ strokeDasharray: "0 88" }}
                          animate={{ strokeDasharray: "72 88" }}
                          transition={{ delay: 0.6, duration: 1 }}
                        />
                        <motion.circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="3"
                          strokeDasharray="4.4 88"
                          strokeDashoffset="-72"
                          strokeLinecap="round"
                          initial={{ strokeDasharray: "0 88" }}
                          animate={{ strokeDasharray: "4.4 88" }}
                          transition={{ delay: 0.8, duration: 0.5 }}
                        />
                        <motion.circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="3"
                          strokeDasharray="2.6 88"
                          strokeDashoffset="-76.4"
                          strokeLinecap="round"
                          initial={{ strokeDasharray: "0 88" }}
                          animate={{ strokeDasharray: "2.6 88" }}
                          transition={{ delay: 0.9, duration: 0.5 }}
                        />
                      </svg>
                    </div>

                    {/* Legend */}
                    <div className="space-y-3">
                      {donutData.map((d) => (
                        <div key={d.label} className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: d.color }}
                          />
                          <div>
                            <p className="text-sm font-medium">{d.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.value} ({d.percent})
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* SQL Tab */}
        <TabsContent value="sql">
          <Card>
            <CardContent className="p-5">
              <pre className="text-sm font-mono bg-muted dark:bg-[#0d0d14] text-emerald-600 dark:text-emerald-400 rounded-xl p-6 overflow-x-auto leading-relaxed border border-border">
                <code>{`SELECT
  order_id,
  customer_id,
  order_date,
  status,
  total_amount
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY order_date DESC;`}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart Tab */}
        <TabsContent value="chart">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 text-blue-500/50" />
              <p className="text-lg font-semibold mb-2">Interactive Charts</p>
              <p className="text-sm">Full interactive chart view coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insight Tab */}
        <TabsContent value="insight">
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-blue-500/50" />
              <p className="text-lg font-semibold mb-2">AI Insights</p>
              <p className="text-sm">AI-generated insights and recommendations coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-between text-xs text-muted-foreground pt-2"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-3 w-3" />
          <span>Data is cached. Last updated: May 18, 2025, 10:21 AM</span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-blue-600 dark:text-blue-400 h-7">
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </motion.div>
    </div>
  );
}
