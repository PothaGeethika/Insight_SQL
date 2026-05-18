"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MoreHorizontal, X, ChevronDown, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DB_TYPES = [
  {
    id: "postgresql",
    name: "PostgreSQL",
    description: "Robust, open-source relational database.",
    icon: (
      <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
        <span className="text-xl">🐘</span>
      </div>
    ),
  },
  {
    id: "mysql",
    name: "MySQL",
    description: "Fast, reliable relational database.",
    icon: (
      <div className="h-10 w-10 rounded-xl bg-sky-500/10 flex items-center justify-center">
        <span className="text-xl">🐬</span>
      </div>
    ),
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description: "Flexible, document-oriented database.",
    icon: (
      <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
        <span className="text-xl">🍃</span>
      </div>
    ),
  },
  {
    id: "vector",
    name: "Vector DB",
    description: "Store and query vector embeddings at scale.",
    icon: (
      <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-dashed border-purple-500 flex items-center justify-center">
          <div className="h-2 w-2 bg-purple-500 rounded-full" />
        </div>
      </div>
    ),
  },
  {
    id: "graph",
    name: "Graph DB",
    description: "Model and query data relationships.",
    icon: (
      <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
        <div className="flex items-center justify-center gap-1">
          <div className="h-2 w-2 bg-indigo-500 rounded-full" />
          <div className="h-[2px] w-2 bg-indigo-500/50" />
          <div className="h-2 w-2 bg-indigo-500 rounded-full" />
        </div>
      </div>
    ),
  },
];

export default function DatabasesPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  
  // Form State
  const [dbType, setDbType] = useState("postgresql");
  const [connectionString, setConnectionString] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{status: 'success' | 'error', message: string} | null>(null);

  const fetchConnections = async () => {
    try {
      const res = await fetch("http://localhost:8000/databases");
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (e) {
      console.error("Failed to fetch connections", e);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const parseConnectionString = (urlStr: string) => {
    try {
      // Basic extraction using URL API
      const url = new URL(urlStr);
      let type = url.protocol.replace(':', '');
      if (type === 'postgres') type = 'postgresql';
      
      return {
        type: type,
        host: url.hostname,
        port: url.port ? parseInt(url.port) : (type === 'postgresql' ? 5432 : 3306),
        database: url.pathname.replace('/', ''),
        username: url.username,
        password: url.password
      };
    } catch (e) {
      return null;
    }
  };

  const handleTestAndSave = async () => {
    if (!connectionString) {
      setTestResult({ status: 'error', message: "Connection string is required" });
      return;
    }

    const parsed = parseConnectionString(connectionString);
    if (!parsed) {
      setTestResult({ status: 'error', message: "Invalid connection string format" });
      return;
    }

    const payload = {
      name: displayName || `${parsed.type}_${parsed.database}`,
      type: parsed.type,
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      username: parsed.username,
      password: parsed.password
    };

    setIsTesting(true);
    setTestResult(null);

    try {
      // 1. Test Connection
      const testRes = await fetch("http://localhost:8000/databases/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const testData = await testRes.json();

      if (testData.status === 'success') {
        // 2. Save if test passes
        const saveRes = await fetch("http://localhost:8000/databases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        if (saveRes.ok) {
          setTestResult({ status: 'success', message: "Successfully connected and saved!" });
          fetchConnections();
          setTimeout(() => {
            setShowAddForm(false);
            setConnectionString("");
            setDisplayName("");
            setTestResult(null);
          }, 1500);
        } else {
          setTestResult({ status: 'error', message: "Tested OK, but failed to save." });
        }
      } else {
        setTestResult({ status: 'error', message: testData.message || "Connection failed." });
      }
    } catch (e: any) {
      setTestResult({ status: 'error', message: "Failed to connect to backend server." });
    } finally {
      setIsTesting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)] overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full p-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">Databases</h1>
            <p className="text-slate-400 mt-2 font-medium">
              Connect and manage all your data sources.
            </p>
          </div>
          <Button 
            onClick={() => {
              setShowAddForm(true);
              setTestResult(null);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Database
          </Button>
        </div>

        {/* Databases Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {DB_TYPES.map((db) => {
            const isConnected = connections.some(c => c.type === db.id);
            return (
              <motion.div
                key={db.id}
                variants={itemVariants}
                className="bg-[var(--surface-1)] border border-slate-800/50 hover:border-slate-700 rounded-2xl p-6 transition-all duration-300 flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-6">
                  {db.icon}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg -mr-2 -mt-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-2">{db.name}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    {db.description}
                  </p>
                </div>

                <div className="mt-auto flex items-center">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                    <span className={`text-xs font-bold ${isConnected ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {isConnected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Add Database Form (Bottom Panel) */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              className="mt-8 bg-[var(--surface-1)] border border-slate-800/50 rounded-2xl p-6 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-white">Add Database</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setShowAddForm(false)}
                  className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg absolute top-6 right-6"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-6 max-w-3xl">
                {/* Database Type Select */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-300">Select Database Type</label>
                  <Select value={dbType} onValueChange={setDbType}>
                    <SelectTrigger className="w-full bg-[var(--surface-0)] border-slate-800 h-14 rounded-xl px-4 text-white hover:border-slate-700">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--surface-1)] border-slate-800 text-white">
                      {DB_TYPES.map(db => (
                        <SelectItem key={db.id} value={db.id} className="cursor-pointer hover:bg-slate-800">
                          <div className="flex items-center gap-3 py-1">
                            {/* Render a tiny version of icon or just text */}
                            <span className="font-bold">{db.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Connection Details */}
                <div className="space-y-4 pt-4 border-t border-slate-800/50">
                  <h3 className="text-sm font-bold text-white">Connection Details</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connection String</label>
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase tracking-wider">Required</span>
                    </div>
                    <Input 
                      value={connectionString}
                      onChange={(e) => setConnectionString(e.target.value)}
                      placeholder={`${dbType}://username:password@host:port/database`}
                      className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-12 rounded-xl text-sm placeholder:text-slate-600 font-mono text-white"
                    />
                    <p className="text-xs text-slate-500 font-medium">Provide a valid {dbType} connection string.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Display Name (Optional)</label>
                    <Input 
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., Production Database"
                      className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-12 rounded-xl text-sm placeholder:text-slate-600 text-white"
                    />
                  </div>
                  
                  {testResult && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`p-4 rounded-xl flex items-start gap-3 border ${
                        testResult.status === 'success' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}
                    >
                      {testResult.status === 'success' ? <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />}
                      <p className="text-sm font-medium">{testResult.message}</p>
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between bg-[var(--surface-0)] border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-slate-700 transition-colors">
                    <span className="text-sm font-bold text-slate-300">Advanced Options</span>
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-4 pt-6 mt-4 border-t border-slate-800/50">
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowAddForm(false)}
                    className="text-slate-400 hover:text-white hover:bg-slate-800 h-11 px-6 rounded-xl font-bold"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleTestAndSave}
                    disabled={isTesting || !connectionString}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test & Save Connection"
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
