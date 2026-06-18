"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MoreHorizontal, X, ChevronDown, CheckCircle2, AlertCircle, Loader2, Edit, Trash2, Link, Unlink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    id: "neo4j",
    name: "Neo4j",
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
  {
    id: "elasticsearch",
    name: "Elasticsearch",
    description: "Distributed search and analytics engine.",
    icon: (
      <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
        <span className="text-xl">🔍</span>
      </div>
    ),
  },
  {
    id: "snowflake",
    name: "SnowFlake",
    description: "Cloud-hosted data warehouse optimized for analytics.",
    icon: (
      <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
        <span className="text-xl">❄️</span>
      </div>
    ),
  },
];

export default function DatabasesPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [editingConnection, setEditingConnection] = useState<any | null>(null);
  const [dbFavorites, setDbFavorites] = useState<string[]>([]);

  // Form State
  const [dbType, setDbType] = useState("postgresql");
  const [connectionString, setConnectionString] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error', message: string } | null>(null);

  // Field Connection States
  const [connectionMethod, setConnectionMethod] = useState<'string' | 'params'>('string');
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Snowflake-specific States
  const [account, setAccount] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [schemaName, setSchemaName] = useState("");
  const [role, setRole] = useState("");

  // Elasticsearch-specific States
  const [apiKey, setApiKey] = useState("");
  const [cloudId, setCloudId] = useState("");

  const clearForm = () => {
    setConnectionString("");
    setDisplayName("");
    setHost("");
    setPort("");
    setDatabase("");
    setUsername("");
    setPassword("");
    setAccount("");
    setWarehouse("");
    setSchemaName("");
    setRole("");
    setApiKey("");
    setCloudId("");
    setTestResult(null);
  };

  const getDefaultPort = (type: string) => {
    switch (type) {
      case 'postgresql': return 5432;
      case 'mysql': return 3306;
      case 'mongodb': return 27017;
      case 'elasticsearch': return 9200;
      case 'vector': return 6333;
      case 'neo4j': return 7687;
      default: return 5432;
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/backend/databases");
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (e) {
      console.error("Failed to fetch connections", e);
    }
  };

  const handleToggleFavoriteDb = (dbId: string) => {
    const favs = JSON.parse(localStorage.getItem("db_favorites") || "[]");
    let updated;
    if (favs.includes(dbId)) {
      updated = favs.filter((id: string) => id !== dbId);
    } else {
      updated = [...favs, dbId];
    }
    localStorage.setItem("db_favorites", JSON.stringify(updated));
    setDbFavorites(updated);
  };

  useEffect(() => {
    fetchConnections();
    const favs = JSON.parse(localStorage.getItem("db_favorites") || "[]");
    setDbFavorites(favs);
  }, []);

  useEffect(() => {
    setTestResult(null);
  }, [dbType, connectionMethod, host, port, database, username, password, connectionString, account, warehouse, schemaName, role]);

  const parseConnectionString = (urlStr: string) => {
    try {
      const protocolMatch = urlStr.match(/^([^:]+):\/\/(.*)$/);
      if (!protocolMatch) return null;
      let type = protocolMatch[1].toLowerCase();
      if (type === 'postgres') type = 'postgresql';
      const rest = protocolMatch[2];
      let username = "";
      let password = "";
      let hostPortDb = rest;
      const lastAtIndex = rest.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const credentialsPart = rest.substring(0, lastAtIndex);
        hostPortDb = rest.substring(lastAtIndex + 1);
        const firstColonIndex = credentialsPart.indexOf(':');
        if (firstColonIndex !== -1) {
          username = decodeURIComponent(credentialsPart.substring(0, firstColonIndex));
          password = decodeURIComponent(credentialsPart.substring(firstColonIndex + 1));
        } else {
          username = decodeURIComponent(credentialsPart);
        }
      }
      if (type === 'snowflake') {
        let account = "";
        let database = "";
        let schemaName = "";
        let warehouse = "";
        let role = "";

        const qIndex = hostPortDb.indexOf('?');
        let pathPart = qIndex !== -1 ? hostPortDb.substring(0, qIndex) : hostPortDb;
        const queryPart = qIndex !== -1 ? hostPortDb.substring(qIndex + 1) : "";

        const pathParts = pathPart.split('/');
        account = pathParts[0] || "";
        database = pathParts[1] || "";
        schemaName = pathParts[2] || "";

        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          warehouse = params.get('warehouse') || "";
          role = params.get('role') || "";
        }
        return { type, username, password, account, database, schemaName, warehouse, role };
      }
      let hostPort = hostPortDb;
      let database = "";
      let apiKey = "";
      let cloudId = "";

      const qIndex = hostPortDb.indexOf('?');
      let pathPart = qIndex !== -1 ? hostPortDb.substring(0, qIndex) : hostPortDb;
      const queryPart = qIndex !== -1 ? hostPortDb.substring(qIndex + 1) : "";

      const firstSlashIndex = pathPart.indexOf('/');
      if (firstSlashIndex !== -1) {
        hostPort = pathPart.substring(0, firstSlashIndex);
        database = pathPart.substring(firstSlashIndex + 1);
      } else {
        hostPort = pathPart;
      }

      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        apiKey = params.get('api_key') || "";
        cloudId = params.get('cloud_id') || "";
      }

      let host = hostPort;
      let port = type === 'postgresql' ? 5432 : (type === 'mongodb' ? 27017 : (type === 'elasticsearch' ? 9200 : 3306));
      const lastColonIndex = hostPort.lastIndexOf(':');
      if (lastColonIndex !== -1) {
        const portStr = hostPort.substring(lastColonIndex + 1);
        if (/^\d+$/.test(portStr)) {
          host = hostPort.substring(0, lastColonIndex);
          port = parseInt(portStr);
        }
      }
      return { type, host, port, database, username, password, api_key: apiKey, cloud_id: cloudId };
    } catch (e) {
      return null;
    }
  };

  const startEdit = (conn: any) => {
    setEditingConnection(conn);
    setDbType(conn.type);
    setDisplayName(conn.name);
    setHost(conn.host || "");
    setPort(conn.port ? String(conn.port) : "");
    setDatabase(conn.database || "");
    setUsername(conn.username || "");
    setPassword(conn.password || "");
    setAccount(conn.account || "");
    setWarehouse(conn.warehouse || "");
    setSchemaName(conn.schema_name || "");
    setRole(conn.role || "");
    setApiKey(conn.api_key || "");
    setCloudId(conn.cloud_id || "");

    // Format connection string from connection object
    let connStr = "";
    if (conn.type === "sqlite") {
      connStr = `sqlite:///${conn.database}`;
    } else if (conn.type === "snowflake") {
      const user = conn.username ? decodeURIComponent(conn.username) : "";
      const pass = conn.password ? decodeURIComponent(conn.password) : "";
      const auth = (user || pass) ? `${user}:${pass}@` : "";
      const schema = conn.schema_name ? `/${conn.schema_name}` : "";
      let params = "";
      const pList = [];
      if (conn.warehouse) pList.push(`warehouse=${conn.warehouse}`);
      if (conn.role) pList.push(`role=${conn.role}`);
      if (pList.length > 0) params = `?${pList.join("&")}`;
      connStr = `snowflake://${auth}${conn.account || ""}/${conn.database || ""}${schema}${params}`;
    } else {
      const user = conn.username ? decodeURIComponent(conn.username) : "";
      const pass = conn.password ? decodeURIComponent(conn.password) : "";
      const auth = (user || pass) ? `${user}:${pass}@` : "";
      const portStr = conn.port ? `:${conn.port}` : "";
      let params = "";
      const pList = [];
      if (conn.type === "elasticsearch") {
        if (conn.api_key) pList.push(`api_key=${conn.api_key}`);
        if (conn.cloud_id) pList.push(`cloud_id=${conn.cloud_id}`);
      }
      if (pList.length > 0) params = `?${pList.join("&")}`;
      connStr = `${conn.type}://${auth}${conn.host || ""}${portStr}/${conn.database || ""}${params}`;
    }
    setConnectionString(connStr);

    if (conn.host || conn.username || conn.account) {
      setConnectionMethod("params");
    } else {
      setConnectionMethod("string");
    }

    setShowAddForm(true);
    setTestResult(null);
  };

  const handleDelete = async (connId: string) => {
    if (!confirm("Are you sure you want to delete this database connection?")) return;
    try {
      const res = await fetch(`/api/backend/databases/${connId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Database connection deleted.");
        fetchConnections();
      }
    } catch (e) {
      console.error("Failed to delete connection", e);
    }
  };

  const handleToggleConnect = async (conn: any) => {
    try {
      const res = await fetch(`/api/backend/databases/${conn.id}/default`, {
        method: "PUT",
      });
      if (res.ok) {
        fetchConnections();
      }
    } catch (e) {
      console.error("Failed to toggle connection state", e);
    }
  };

  const getConnectionPayload = () => {
    let payload: any = {};
    if (connectionMethod === 'string') {
      if (!connectionString) return null;
      const parsed = parseConnectionString(connectionString);
      if (!parsed) return null;
      payload = {
        name: displayName || `${parsed.type}_${parsed.database}`,
        type: parsed.type,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password
      };
      if (parsed.type === 'snowflake') {
        payload.account = (parsed as any).account;
        payload.warehouse = (parsed as any).warehouse;
        payload.schema_name = (parsed as any).schemaName;
        payload.role = (parsed as any).role;
      } else {
        payload.host = parsed.host;
        payload.port = parsed.port;
        if (parsed.type === 'elasticsearch') {
          payload.api_key = (parsed as any).api_key;
          payload.cloud_id = (parsed as any).cloud_id;
        }
      }
    } else {
      if (!database) return null;
      payload = {
        name: displayName || `${dbType}_${database}`,
        type: dbType,
        database: database,
        username: username,
        password: password
      };
      if (dbType === 'snowflake') {
        payload.account = account;
        payload.warehouse = warehouse;
        payload.schema_name = schemaName;
        payload.role = role;
      } else {
        payload.host = host || "localhost";
        payload.port = port ? parseInt(port) : getDefaultPort(dbType);
        if (dbType === 'elasticsearch') {
          payload.api_key = apiKey;
          payload.cloud_id = cloudId;
        }
      }
    }
    return payload;
  };

  const handleTestConnection = async () => {
    const payload = getConnectionPayload();
    if (!payload) {
      setTestResult({ status: 'error', message: "Please fill in all required fields first" });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/backend/databases/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setTestResult({ status: 'success', message: data.message || "Connection successful!" });
      } else {
        setTestResult({ status: 'error', message: data.message || "Connection failed." });
      }
    } catch (e) {
      setTestResult({ status: 'error', message: "Failed to connect to backend server." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConnection = async () => {
    const payload = getConnectionPayload();
    if (!payload) return;

    setIsSaving(true);

    try {
      const url = editingConnection
        ? `/api/backend/databases/${editingConnection.id}`
        : "/api/backend/databases";

      const method = editingConnection ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const successMsg = editingConnection ? "Successfully updated connection!" : "Successfully connected and saved!";
        setTestResult({ status: 'success', message: successMsg });
        toast.success(successMsg);
        fetchConnections();
        setTimeout(() => {
          setShowAddForm(false);
          setEditingConnection(null);
          clearForm();
        }, 1500);
      } else {
        setTestResult({
          status: 'error',
          message: editingConnection ? "Failed to update connection details." : "Failed to save connection details."
        });
      }
    } catch (e) {
      setTestResult({ status: 'error', message: "Failed to connect to backend server." });
    } finally {
      setIsSaving(false);
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
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)] dark:bg-transparent overflow-y-auto">
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
              setEditingConnection(null);
              clearForm();
              setDbType("postgresql");
              setConnectionMethod("string");
              setShowAddForm(true);
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
          {(() => {
            const cardsToRender = connections.map(conn => ({
              id: conn.id,
              type: conn.type,
              name: conn.name,
              dbType: conn.type,
              isPlaceholder: false,
              isConnected: conn.is_default,
              conn: conn
            }));

            if (cardsToRender.length === 0) {
              return (
                <div className="col-span-full flex flex-col items-center justify-center text-center py-20 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/10 max-w-xl mx-auto my-10">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/25">
                    <Plus className="h-8 w-8 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">No Databases Connected</h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-sm">
                    Connect and manage all your data sources. Add your first database connection to get started with natural language queries!
                  </p>
                  <Button
                    onClick={() => {
                      setDbType("postgresql");
                      setEditingConnection(null);
                      clearForm();
                      setConnectionMethod("string");
                      setShowAddForm(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center gap-2 animate-bounce"
                  >
                    <Plus className="h-4 w-4" /> Add First Database
                  </Button>
                </div>
              );
            }

            return cardsToRender.map((card) => {
              const dbInfo = DB_TYPES.find(d => d.id === card.dbType) || {
                id: card.dbType,
                name: card.dbType.toUpperCase(),
                description: `Connect to a ${card.dbType} database.`,
                icon: (
                  <div className="h-10 w-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                    <span className="text-xl">🔌</span>
                  </div>
                )
              };

              return (
                <motion.div
                  key={card.id}
                  variants={itemVariants}
                  className="bg-[var(--surface-1)] border border-slate-800/50 hover:border-slate-700 rounded-2xl p-6 transition-all duration-300 flex flex-col h-full"
                >
                  <div className="flex items-start justify-between mb-6">
                    {dbInfo.icon}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg -mr-2 -mt-2 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl shadow-xl p-1">
                        <DropdownMenuItem
                          onClick={() => handleToggleConnect(card.conn)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {card.isConnected ? (
                            <>
                              <Unlink className="h-4 w-4 text-amber-500" />
                              <span>Disconnect</span>
                            </>
                          ) : (
                            <>
                              <Link className="h-4 w-4 text-emerald-500" />
                              <span>Connect</span>
                            </>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleToggleFavoriteDb(card.id)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <Star className={`h-4 w-4 ${dbFavorites.includes(card.id) ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                          <span>{dbFavorites.includes(card.id) ? "Unfavorite" : "Favorite"}</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => startEdit(card.conn)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <Edit className="h-4 w-4 text-blue-500" />
                          <span>Edit</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleDelete(card.conn.id)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-red-500/10 hover:text-red-400 text-red-500 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                      {card.name}
                      {dbFavorites.includes(card.id) && (
                        <Star className="h-4.5 w-4.5 text-amber-400 fill-amber-400 filter drop-shadow-[0_0_6px_rgba(251,191,36,0.35)] shrink-0 animate-pulse" />
                      )}
                    </h3>
                    <p className="text-xs text-indigo-400 font-bold mb-2">Type: {dbInfo.name}</p>
                    <p className="text-sm text-slate-400 leading-relaxed mb-6">
                      {dbInfo.description}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center">
                    <button
                      type="button"
                      onClick={() => handleToggleConnect(card.conn)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${card.isConnected
                        ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 cursor-pointer shadow-md shadow-emerald-500/5'
                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-slate-400 cursor-pointer'
                        }`}
                      title={card.isConnected ? "Click to Disconnect" : "Click to Connect"}
                    >
                      <div className={`h-2 w-2 rounded-full ${card.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                      <span className="text-xs font-bold">
                        {card.isConnected ? 'Connected' : 'Not Connected'}
                      </span>
                    </button>
                  </div>
                </motion.div>
              );
            });
          })()}
        </motion.div>

        {/* Add/Edit Database Centered Popup Modal */}
        <AnimatePresence>
          {showAddForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Darkened Blurred Backdrop Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setShowAddForm(false);
                  setEditingConnection(null);
                  clearForm();
                }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />

              {/* Centered Modal Popup Window */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="relative bg-card border border-border w-full max-w-3xl rounded-2xl p-6 shadow-2xl z-10 flex flex-col max-h-[85vh] overflow-hidden text-foreground"
              >
                {/* Close X Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingConnection(null);
                    clearForm();
                  }}
                  className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800/50 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex flex-col gap-2 mb-6">
                  <h2 className="text-2xl font-black text-white">
                    {editingConnection ? "Edit Database Connection" : "Add Database"}
                  </h2>
                  <p className="text-slate-400 font-medium">
                    Provide credentials or a connection string to link your database.
                  </p>
                </div>

                <div className="space-y-6 overflow-y-auto pr-1 flex-1">
                  {/* Type Select & Display Name in a 2-Column Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Database Type Select */}
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-300">Select Database Type</label>
                      <Select value={dbType} onValueChange={(val) => val && setDbType(val)}>
                        <SelectTrigger className="w-full bg-[var(--surface-0)] border-slate-800 h-12 rounded-xl px-4 text-white hover:border-slate-700">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--surface-1)] border-slate-800 text-white">
                          {DB_TYPES.map(db => (
                            <SelectItem key={db.id} value={db.id} className="cursor-pointer hover:bg-slate-800">
                              <div className="flex items-center gap-3 py-1">
                                <span className="font-bold">{db.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Project Name Input */}
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-300">Project Name</label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., Sales Analysis Project"
                        className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-12 rounded-xl text-sm placeholder:text-slate-600 text-white"
                      />
                    </div>
                  </div>

                  {/* Connection Details Section */}
                  <div className="space-y-4 pt-4 border-t border-slate-800/50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Connection Details</h3>

                      {/* Method Toggle Tab */}
                      <div className="flex gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setConnectionMethod('string')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${connectionMethod === 'string'
                            ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                            : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          URI String
                        </button>
                        <button
                          type="button"
                          onClick={() => setConnectionMethod('params')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${connectionMethod === 'params'
                            ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10'
                            : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          Form Parameters
                        </button>
                      </div>
                    </div>

                    {connectionMethod === 'params' ? (
                      dbType === 'elasticsearch' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Cloud ID */}
                          <div className="col-span-3 space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cloud ID (Optional)</label>
                            <Input
                              value={cloudId}
                              onChange={(e) => setCloudId(e.target.value)}
                              placeholder="e.g., my-deployment:dXMtZWFzdC0xLmF3cy5mb3VuZC5pbyQ..."
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* API Key */}
                          <div className="col-span-3 space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">API Key (Optional)</label>
                            <Input
                              type="password"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="e.g., V1M2a0... (for Cloud/API Key authentication)"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* Host */}
                          <div className="col-span-2 space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Host / Endpoint</label>
                            <Input
                              value={host}
                              onChange={(e) => setHost(e.target.value)}
                              placeholder="e.g., localhost or my-es-project.es.asia-south1.gcp.elastic.cloud"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* Port */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Port</label>
                            <Input
                              value={port}
                              onChange={(e) => setPort(e.target.value)}
                              placeholder="9200"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* Database Name (Index) */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Index Name</label>
                            <Input
                              value={database}
                              onChange={(e) => setDatabase(e.target.value)}
                              placeholder="e.g., products"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* Username */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Username</label>
                            <Input
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="elastic"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* Password */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                            <Input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                        </div>
                      ) : dbType === 'snowflake' ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Account */}
                          <div className="col-span-2 space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account Identifier</label>
                            <Input
                              value={account}
                              onChange={(e) => setAccount(e.target.value)}
                              placeholder="e.g., xy12345.us-east-2.aws"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                          {/* Warehouse */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Warehouse</label>
                            <Input
                              value={warehouse}
                              onChange={(e) => setWarehouse(e.target.value)}
                              placeholder="e.g., COMPUTE_WH"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* Database Name */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Database Name</label>
                            <Input
                              value={database}
                              onChange={(e) => setDatabase(e.target.value)}
                              placeholder="e.g., SNOWFLAKE_SAMPLE_DATA"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                          {/* Schema Name */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Schema Name</label>
                            <Input
                              value={schemaName}
                              onChange={(e) => setSchemaName(e.target.value)}
                              placeholder="e.g., PUBLIC"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                          {/* Role */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role</label>
                            <Input
                              value={role}
                              onChange={(e) => setRole(e.target.value)}
                              placeholder="e.g., ACCOUNTADMIN"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* Username */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Username</label>
                            <Input
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="e.g., USERNAME"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                          {/* Password */}
                          <div className="col-span-2 space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                            <Input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Host */}
                          <div className="col-span-2 space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Host</label>
                            <Input
                              value={host}
                              onChange={(e) => setHost(e.target.value)}
                              placeholder="localhost"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                          {/* Port */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Port</label>
                            <Input
                              value={port}
                              onChange={(e) => setPort(e.target.value)}
                              placeholder={String(getDefaultPort(dbType))}
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>

                          {/* Database Name */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Database Name</label>
                            <Input
                              value={database}
                              onChange={(e) => setDatabase(e.target.value)}
                              placeholder="e.g., main_db"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                          {/* Username */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Username</label>
                            <Input
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="postgres"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                          {/* Password */}
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                            <Input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-sm text-white"
                            />
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connection String (URI)</label>
                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase tracking-wider">Required</span>
                        </div>
                        <Input
                          value={connectionString}
                          onChange={(e) => setConnectionString(e.target.value)}
                          placeholder={dbType === 'snowflake'
                            ? "snowflake://username:password@account/database/schema?warehouse=wh&role=rl"
                            : `${dbType}://username:password@host:port/database`}
                          className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-12 rounded-xl text-sm placeholder:text-slate-600 font-mono text-white"
                        />
                        <p className="text-xs text-slate-500 font-medium">Provide a valid {dbType} connection string.</p>
                      </div>
                    )}

                    {testResult && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-4 rounded-xl flex items-start gap-3 border ${testResult.status === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          }`}
                      >
                        {testResult.status === 'success' ? <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />}
                        <p className="text-sm font-medium">{testResult.message}</p>
                      </motion.div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-6 mt-4 border-t border-slate-800/50">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingConnection(null);
                        clearForm();
                      }}
                      className="text-slate-400 hover:text-white hover:bg-slate-800 h-11 px-6 rounded-xl font-bold cursor-pointer"
                    >
                      Cancel
                    </Button>

                    <div className="flex items-center gap-3">
                      {/* Test Connection Button */}
                      <Button
                        onClick={handleTestConnection}
                        disabled={isTesting || isSaving || (connectionMethod === 'string' ? !connectionString : (dbType === 'snowflake' ? (!database || !account) : !database))}
                        className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold h-11 px-6 rounded-xl cursor-pointer disabled:opacity-50"
                      >
                        {isTesting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          "Test Connection"
                        )}
                      </Button>

                      {/* Save & Connect Button (Only clickable if Test is successful) */}
                      <Button
                        onClick={handleSaveConnection}
                        disabled={isSaving || isTesting || !testResult || testResult.status !== 'success'}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-200"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          editingConnection ? "Update Connection" : "Save & Connect"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
