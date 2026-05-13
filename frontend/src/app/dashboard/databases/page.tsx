"use client";

import { motion } from "framer-motion";
import {
  Plus,
  MoreHorizontal,
  Database,
  Eye,
  EyeOff,
  HelpCircle,
  ExternalLink,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const databases = [
  {
    name: "PostgreSQL",
    connectionName: "analytics-prod",
    description: "Powerful, open source object-relational database.",
    status: "connected",
    isDefault: true,
    enabled: true,
    icon: "🐘",
    color: "from-blue-500 to-blue-700",
    dbCount: 5,
  },
  {
    name: "MySQL",
    connectionName: "sales-db",
    description: "Fast, reliable, and widely used open source database engine.",
    status: "connected",
    isDefault: false,
    enabled: true,
    icon: "🐬",
    color: "from-orange-500 to-orange-700",
    dbCount: 3,
  },
  {
    name: "MongoDB",
    connectionName: "acme-nosql",
    description: "Document-oriented NoSQL database for modern apps.",
    status: "connected",
    isDefault: false,
    enabled: true,
    icon: "🍃",
    color: "from-emerald-500 to-emerald-700",
    dbCount: 2,
  },
  {
    name: "SQLite",
    connectionName: "local-dev",
    description: "Serverless, lightweight database engine.",
    status: "not_connected",
    isDefault: false,
    enabled: false,
    icon: "🪶",
    color: "from-sky-500 to-sky-700",
    dbCount: 0,
  },
  {
    name: "Snowflake",
    connectionName: "data_warehouse",
    description: "Cloud data platform for analytics workloads.",
    status: "not_connected",
    isDefault: false,
    enabled: false,
    icon: "❄️",
    color: "from-cyan-400 to-cyan-600",
    dbCount: 0,
  },
];

export default function DatabasesPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const connectedCount = databases.filter((db) => db.status === "connected").length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Databases</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and connect your data sources.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/20">
              <Plus className="h-4 w-4 mr-2" />
              Add Database
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Add Database</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Database Type</Label>
                <Select defaultValue="postgresql">
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">🐘 PostgreSQL</SelectItem>
                    <SelectItem value="mysql">🐬 MySQL</SelectItem>
                    <SelectItem value="mongodb">🍃 MongoDB</SelectItem>
                    <SelectItem value="sqlite">🪶 SQLite</SelectItem>
                    <SelectItem value="snowflake">❄️ Snowflake</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Connection Name</Label>
                  <Input placeholder="e.g. Production DB" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Host</Label>
                  <Input placeholder="localhost" className="h-11" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Port</Label>
                  <Input placeholder="5432" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Database</Label>
                  <Input placeholder="e.g. analytics" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Username</Label>
                  <Input placeholder="e.g. admin" className="h-11" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                <HelpCircle className="h-4 w-4 flex-shrink-0" />
                <span>Need help connecting?</span>
                <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
                  View our documentation <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950">
                  Test Connection
                </Button>
                <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md shadow-blue-500/20">
                  Save & Connect
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Database Cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {databases.map((db) => (
          <motion.div key={db.name + db.connectionName} variants={fadeInUp}>
            <Card className="hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {/* DB Icon */}
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${db.color} flex items-center justify-center shadow-md text-xl flex-shrink-0`}>
                    {db.icon}
                  </div>

                  {/* DB Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-base font-semibold">{db.name}</h3>
                      <span className="text-xs text-muted-foreground">{db.connectionName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {db.status === "connected" ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs px-2 py-0.5"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-xs px-2 py-0.5"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Not connected
                        </Badge>
                      )}
                      {db.isDefault && (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs px-2 py-0.5">
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <Switch checked={db.enabled} className="data-[state=checked]:bg-blue-600" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit Connection</DropdownMenuItem>
                        <DropdownMenuItem>Set as Default</DropdownMenuItem>
                        <DropdownMenuItem>Test Connection</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Add new database link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button
          onClick={() => setDialogOpen(true)}
          className="w-full p-4 border-2 border-dashed rounded-xl text-sm text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New Database
        </button>
      </motion.div>

      {/* Footer status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-center justify-between text-sm"
      >
        <span className="text-muted-foreground">
          {connectedCount} of {databases.length} databases connected
        </span>
        <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md shadow-blue-500/20">
          Save & Continue
        </Button>
      </motion.div>
    </div>
  );
}
