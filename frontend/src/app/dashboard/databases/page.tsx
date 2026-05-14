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
  Star,
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
import { useState, useEffect } from "react";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

export default function DatabasesPage() {
  const [databases, setDatabases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "postgresql",
    host: "localhost",
    port: "5432",
    database: "",
    username: "",
    password: ""
  });

  const [favoriteDbs, setFavoriteDbs] = useState<string[]>([]);

  const fetchDatabases = async () => {
    try {
      const response = await fetch("http://localhost:8000/databases");
      const data = await response.json();
      setDatabases(data);
    } catch (error) {
      console.error("Error fetching databases:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
    const saved = localStorage.getItem("db_favorites");
    if (saved) setFavoriteDbs(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("db_favorites", JSON.stringify(favoriteDbs));
  }, [favoriteDbs]);

  const toggleFavoriteDatabase = (id: string) => {
    setFavoriteDbs(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{status: string, message: string} | null>(null);

  const handleEditClick = (db: any) => {
    setEditingId(db.id);
    setFormData({
      name: db.name,
      type: db.type,
      host: db.host || "localhost",
      port: db.port?.toString() || "5432",
      database: db.database,
      username: db.username || "",
      password: db.password || ""
    });
    setDialogOpen(true);
  };

  const handleTestConnection = async () => {
    setTestResult({ status: "testing", message: "Verifying credentials..." });
    try {
      const response = await fetch("http://localhost:8000/databases/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          port: parseInt(formData.port) || 0
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTestResult({
          status: data.status || (response.ok ? "success" : "error"),
          message: data.message || (response.ok ? "Connected successfully!" : "Unknown error occurred")
        });
      } else {
        // Handle FastAPI validation errors (422) or other non-OK responses
        const errorMessage = data.detail 
          ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail))
          : "Server error occurred";
        setTestResult({ status: "error", message: errorMessage });
      }
    } catch (error: any) {
      setTestResult({ status: "error", message: "Could not connect to backend server. Is it running?" });
    }
  };

  // Reset test status when form data changes
  useEffect(() => {
    setTestResult(null);
  }, [formData]);

  const handleSetDefault = async (id: string) => {
    console.log("Setting default for:", id);
    try {
      const res = await fetch(`http://localhost:8000/databases/${id}/default`, {
        method: "PUT"
      });
      if (res.ok) {
        console.log("Default set successfully");
        await fetchDatabases();
      } else {
        const err = await res.json();
        alert("Error: " + err.detail);
      }
    } catch (error) {
      console.error("Error setting default:", error);
      alert("Network Error: Could not connect to backend");
    }
  };

  const handleTestInList = async (db: any) => {
    setEditingId(db.id);
    setFormData({
      name: db.name,
      type: db.type,
      host: db.host || "localhost",
      port: db.port?.toString() || "5432",
      database: db.database,
      username: db.username || "",
      password: db.password || ""
    });
    setDialogOpen(true);
    // Delay slightly to ensure form data is set
    setTimeout(() => handleTestConnection(), 100);
  };

  const isFormValid = formData.name && formData.database && (formData.type === 'sqlite' || (formData.host && formData.port && formData.username && formData.password));
  const isTestPassed = testResult?.status === 'success';

  const handleAddDatabase = async () => {
    if (!isFormValid) return;
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId 
        ? `http://localhost:8000/databases/${editingId}`
        : "http://localhost:8000/databases";

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          port: parseInt(formData.port) || 0
        }),
      });
      if (response.ok) {
        setDialogOpen(false);
        setEditingId(null);
        fetchDatabases();
        // Reset form
        setFormData({
          name: "",
          type: "postgresql",
          host: "localhost",
          port: "5432",
          database: "",
          username: "",
          password: ""
        });
      } else {
        const err = await response.json();
        setTestResult({ status: "error", message: err.detail || "Failed to save" });
      }
    } catch (error: any) {
      setTestResult({ status: "error", message: error.message || "Failed to reach backend" });
    }
  };

  const handleDeleteDatabase = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/databases/${id}`, {
        method: "DELETE",
      });
      fetchDatabases();
    } catch (error) {
      console.error("Error deleting database:", error);
    }
  };

  const getDbIcon = (type: string) => {
    switch (type) {
      case "postgresql": return "🐘";
      case "mysql": return "🐬";
      case "mongodb": return "🍃";
      case "sqlite": return "🪶";
      default: return "💾";
    }
  };

  const getDbColor = (type: string) => {
    switch (type) {
      case "postgresql": return "from-blue-500 to-blue-700";
      case "mysql": return "from-orange-500 to-orange-700";
      case "mongodb": return "from-emerald-500 to-emerald-700";
      case "sqlite": return "from-sky-500 to-sky-700";
      default: return "from-slate-500 to-slate-700";
    }
  };

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

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setTestResult(null);
            setFormData({
              name: "",
              type: "postgresql",
              host: "localhost",
              port: "5432",
              database: "",
              username: "",
              password: ""
            });
          }
        }}>
          <DialogTrigger render={<Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/20" />}>
            <Plus className="h-4 w-4 mr-2" />
            Add Database
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">{editingId ? "Edit Database" : "Add Database"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Database Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData({...formData, type: v})}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgresql">🐘 PostgreSQL</SelectItem>
                    <SelectItem value="mysql">🐬 MySQL</SelectItem>
                    <SelectItem value="sqlite">🪶 SQLite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Connection Name</Label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. My Database" 
                    className="h-11" 
                  />
                </div>
                {formData.type !== 'sqlite' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Host</Label>
                    <Input 
                      value={formData.host}
                      onChange={(e) => setFormData({...formData, host: e.target.value})}
                      placeholder="localhost" 
                      className="h-11" 
                    />
                  </div>
                )}
              </div>

              <div className={`${formData.type === 'sqlite' ? 'grid-cols-1' : 'grid-cols-3'} grid gap-4`}>
                {formData.type !== 'sqlite' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Port</Label>
                    <Input 
                      value={formData.port}
                      onChange={(e) => setFormData({...formData, port: e.target.value})}
                      placeholder="5432" 
                      className="h-11" 
                    />
                  </div>
                )}
                <div className={`${formData.type === 'sqlite' ? '' : 'col-span-2'} space-y-2`}>
                  <Label className="text-sm font-medium">
                    {formData.type === 'sqlite' ? 'Database File Path' : 'Database Name'}
                  </Label>
                  <Input 
                    value={formData.database}
                    onChange={(e) => setFormData({...formData, database: e.target.value})}
                    placeholder={formData.type === 'sqlite' ? "e.g. data/my_db.sqlite" : "e.g. production_db"} 
                    className="h-11" 
                  />
                </div>
              </div>

              {formData.type !== 'sqlite' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Username</Label>
                    <Input 
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      placeholder="e.g. postgres" 
                      className="h-11" 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
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
                </>
              )}

              {testResult && (
                <div className={`p-3 rounded-lg text-xs min-h-[50px] flex flex-col justify-center border ${
                  testResult.status === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                  testResult.status === 'testing' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                  'bg-destructive/10 text-destructive border-destructive/20'
                }`}>
                  <p className="font-bold uppercase text-[10px] mb-1 opacity-70">{testResult.status}</p>
                  <p className="break-words leading-relaxed">{testResult.message}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); setTestResult(null); }}>
                  Cancel
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
                >
                  Test Connection
                </Button>
                <Button 
                  onClick={handleAddDatabase}
                  disabled={!isFormValid || !isTestPassed}
                  className={`bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md shadow-blue-500/20 ${(!isFormValid || !isTestPassed) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
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
          <motion.div key={db.id} variants={fadeInUp}>
            <Card className="hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300 group">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {/* DB Icon */}
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${getDbColor(db.type)} flex items-center justify-center shadow-md text-xl flex-shrink-0`}>
                    {getDbIcon(db.type)}
                  </div>

                  {/* DB Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-base font-semibold">{db.name}</h3>
                      <span className="text-xs text-muted-foreground">{db.database}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs px-2 py-0.5"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                      {db.is_default && (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs px-2 py-0.5">
                          Default
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-amber-500 transition-colors"
                      onClick={() => toggleFavoriteDatabase(db.id)}
                    >
                      <Star className={`h-4 w-4 ${favoriteDbs.includes(db.id) ? "fill-amber-500 text-amber-500" : ""}`} />
                    </Button>
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={db.is_default}
                          onChange={() => handleSetDefault(db.id)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-9 w-9" />}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClick(db)}>Edit Connection</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSetDefault(db.id)}>Set as Default</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTestInList(db)}>Test Connection</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteDatabase(db.id)} className="text-destructive">
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
