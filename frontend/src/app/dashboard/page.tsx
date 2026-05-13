"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Database,
  MessageSquare,
  Plus,
  BookmarkCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const stats = [
  {
    label: "Total Queries",
    value: "1,284",
    change: "+18.2%",
    trend: "up",
    sublabel: "vs last month",
    icon: BarChart3,
  },
  {
    label: "Success Rate",
    value: "98.6%",
    change: "+2.4%",
    trend: "up",
    sublabel: "vs last month",
    icon: TrendingUp,
  },
  {
    label: "Avg. Response Time",
    value: "1.2s",
    change: "-0.3s",
    trend: "up",
    sublabel: "vs last month",
    icon: Clock,
  },
  {
    label: "Databases",
    value: "8",
    change: "+1",
    trend: "up",
    sublabel: "vs last month",
    icon: Database,
  },
];

const recentConversations = [
  {
    title: "Top customers by revenue this month",
    db: "PostgreSQL",
    time: "2h ago",
    color: "bg-blue-500",
  },
  {
    title: "Monthly sales trend comparison",
    db: "MySQL",
    time: "6h ago",
    color: "bg-emerald-500",
  },
  {
    title: "Inactive users in the last 30 days",
    db: "PostgreSQL",
    time: "1d ago",
    color: "bg-purple-500",
  },
  {
    title: "Subscriptions expiring soon",
    db: "PostgreSQL",
    time: "2d ago",
    color: "bg-amber-500",
  },
];

const quickActions = [
  {
    icon: MessageSquare,
    title: "New Chat",
    description: "Ask a question or write SQL",
    href: "/dashboard/chat",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: Plus,
    title: "Add Database",
    description: "Connect a new database",
    href: "/dashboard/databases",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    icon: BookmarkCheck,
    title: "Saved Queries",
    description: "View your saved queries",
    href: "/dashboard/saved",
    color: "from-purple-500 to-purple-600",
  },
];

export default function DashboardHome() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl lg:text-3xl font-bold">
          Good morning, Jane 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening with your data today.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={fadeInUp}>
            <Card className="hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 border bg-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                    <stat.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <span className={`text-xs font-semibold flex items-center gap-0.5 ${
                    stat.trend === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                  }`}>
                    {stat.trend === "up" ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {stat.change}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.sublabel}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Recent + Quick Actions */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent Conversations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="lg:col-span-3"
        >
          <Card className="h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Conversations</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                  View all history
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentConversations.map((conv, i) => (
                <motion.div
                  key={conv.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${conv.color} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {conv.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {conv.db} · {conv.time}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action, i) => (
                <Link key={action.title} href={action.href}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    whileHover={{ x: 4 }}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-all cursor-pointer group"
                  >
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                      <action.icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/30 group-hover:text-blue-500 transition-all" />
                  </motion.div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
