"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MoreHorizontal, X, ChevronDown, CheckCircle2, AlertCircle, Loader2, Edit, Trash2, Link, Unlink, Star, Database, Cloud, Server, Search, ArrowLeft } from "lucide-react";
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

/**
 * DynamicIcon — renders either:
 *   • an <img> for http(s) icon URLs (with graceful onError fallback to Database icon)
 *   • a Lucide icon component for named string icons ("Link", "Cloud", "Server")
 *   • the generic <Database> icon for everything else / failures
 */
function DynamicIcon({ icon, className = "h-5 w-5" }: { icon: string; className?: string }) {
  const [imgError, setImgError] = React.useState(false);

  if (!icon || imgError) return <Database className={className} />;

  if (icon.startsWith("http")) {
    return (
      <img
        src={icon}
        alt="db icon"
        className={`object-contain ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  if (icon === "Cloud") return <Cloud className={className} />;
  if (icon === "Link" || icon === "__link__") return <Link className={className} />;
  if (icon === "Server") return <Server className={className} />;

  return <Database className={className} />;
}

/**
 * resolveCardDbInfo — dynamically resolves the display info (name, description, icon URL)
 * for a saved database connection, even for custom/unknown types.
 *
 * Resolution order:
 *  1. Exact catalog match by type ID
 *  2. If type is "other", extract protocol from custom_url and try again
 *  3. Fall back to Simple Icons CDN for any recognised or unknown protocol
 *     (the DynamicIcon onError handler handles 404s gracefully)
 */
function resolveCardDbInfo(card: any, catalog: any[]) {
  // 1. Direct catalog lookup
  let entry = catalog.find((d: any) => d.id === card.type);
  if (entry) return entry;

  // 2. Extract protocol from custom_url if type is "other" or not found
  let resolvedType = card.type as string;
  if (card.custom_url) {
    const m = (card.custom_url as string).match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\//);
    if (m) {
      const protocol = m[1].toLowerCase().replace(/\+.*$/, "");
      entry = catalog.find((d: any) => d.id === protocol);
      if (entry) return entry;
      resolvedType = protocol;
    }
  }

  // 3. Fully dynamic: try Simple Icons CDN for the resolved type
  const displayName =
    resolvedType.length > 0
      ? resolvedType.charAt(0).toUpperCase() + resolvedType.slice(1)
      : "Custom";
  return {
    name: displayName,
    description: "Custom Database Connection",
    icon: `https://cdn.simpleicons.org/${resolvedType}`,
  };
}

/**
 * FALLBACK_DB_TYPES — client-side catalog used while the backend response is loading
 * or if the /databases/types endpoint is unavailable.
 * Icons use Simple Icons CDN (https://cdn.simpleicons.org/{slug}) — official brand logos.
 * The canonical source of truth is backend/db_types_config.json.
 */
// ---------------------------------------------------------------------------
// Icon URLs — Strategy per database:
//   • Devicon (devicons/devicon CDN): full-color SVGs for widely-supported DBs
//   • Simple Icons CDN with explicit brand hex:  cdn.simpleicons.org/{slug}/{hex}
//     - Hex color appended so brand color is embedded in the SVG fill,
//       ensuring icons display correctly on both light and dark backgrounds.
//   • techicons.dev — fallback CDN for DBs missing from Simple Icons (Pinecone)
// ---------------------------------------------------------------------------
const FALLBACK_DB_TYPES = [
  // ── Relational ──────────────────────────────────────────────────────────
  { id: "postgresql",  name: "PostgreSQL",    description: "Robust, open-source relational database.",                              icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg" },
  { id: "mysql",       name: "MySQL",          description: "Fast, reliable open-source relational database.",                       icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg" },
  { id: "mariadb",     name: "MariaDB",        description: "Open-source relational database forked from MySQL.",                    icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mariadb/mariadb-original.svg" },
  { id: "oracle",      name: "Oracle",         description: "Enterprise-grade relational database management system.",               icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/oracle/oracle-original.svg" },
  { id: "sqlserver",   name: "SQL Server",     description: "Microsoft's enterprise relational database platform.",                  icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/microsoftsqlserver/microsoftsqlserver-plain-wordmark.svg" },
  { id: "sqlite",      name: "SQLite",         description: "Lightweight, serverless embedded SQL database engine.",                 icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg" },
  { id: "cockroachdb", name: "CockroachDB",    description: "Distributed SQL database built for cloud-native applications.",         icon: "https://cdn.simpleicons.org/cockroachlabs/6933FF" },
  { id: "planetscale", name: "PlanetScale",    description: "MySQL-compatible serverless database for developers.",                  icon: "https://cdn.simpleicons.org/planetscale/f35815" },
  { id: "tidb",        name: "TiDB",           description: "Distributed, MySQL-compatible HTAP database.",                          icon: "https://cdn.simpleicons.org/tidb/E63F2B" },
  // ── NoSQL / Document ────────────────────────────────────────────────────
  { id: "mongodb",     name: "MongoDB",        description: "Flexible, document-oriented NoSQL database.",                           icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg" },
  { id: "couchdb",     name: "CouchDB",        description: "Open-source document-oriented NoSQL database.",                        icon: "https://cdn.simpleicons.org/apachecouchdb/E42528" },
  { id: "dynamodb",    name: "DynamoDB",       description: "Amazon's fully managed key-value and document NoSQL database.",         icon: "https://api.iconify.design/logos:aws-dynamodb.svg" },
  { id: "redis",       name: "Redis",          description: "In-memory data structure store, cache, and message broker.",            icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg" },
  { id: "cassandra",   name: "Cassandra",      description: "Highly scalable, distributed wide-column NoSQL database.",              icon: "https://cdn.simpleicons.org/apachecassandra/1287B1" },
  { id: "pinecone",    name: "Pinecone",       description: "Managed vector database for AI and ML applications.",                   icon: "https://techicons.dev/api/pinecone" },
  // ── Search & Graph ──────────────────────────────────────────────────────
  { id: "elasticsearch", name: "Elasticsearch", description: "Distributed search and analytics engine.",                            icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/elasticsearch/elasticsearch-original.svg" },
  { id: "neo4j",       name: "Neo4j",          description: "Graph database for modeling connected data.",                           icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/neo4j/neo4j-original.svg" },
  // ── Cloud Warehouses ────────────────────────────────────────────────────
  { id: "snowflake",   name: "Snowflake",      description: "Cloud data platform and data warehouse for analytics.",                 icon: "https://cdn.simpleicons.org/snowflake/29B5E8" },
  { id: "databricks",  name: "Databricks",     description: "Unified analytics platform for big data and machine learning.",         icon: "https://cdn.simpleicons.org/databricks/FF3621" },
  { id: "bigquery",    name: "BigQuery",       description: "Google's fully managed, serverless data warehouse.",                    icon: "https://cdn.simpleicons.org/googlebigquery/4285F4" },
  { id: "redshift",    name: "Redshift",       description: "Amazon's fully managed petabyte-scale cloud data warehouse.",           icon: "https://api.iconify.design/logos:aws-redshift.svg" },
  // ── OLAP & Analytics ────────────────────────────────────────────────────
  { id: "clickhouse",  name: "ClickHouse",     description: "Fast, open-source column-oriented OLAP database.",                     icon: "https://cdn.simpleicons.org/clickhouse/FFCC01" },
  { id: "influxdb",    name: "InfluxDB",       description: "Purpose-built time series platform for metrics and events.",            icon: "https://api.iconify.design/logos:influxdb.svg" },
  // ── BaaS / Hosted ───────────────────────────────────────────────────────
  { id: "supabase",    name: "Supabase",       description: "Open-source Firebase alternative built on PostgreSQL.",                 icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/supabase/supabase-original.svg" },
  // ── Custom ──────────────────────────────────────────────────────────────
  { id: "other",       name: "Other / Custom", description: "Connect to any database using a custom connection URI string.",         icon: "__link__" },
];


export default function DatabasesPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [dbTypes, setDbTypes] = useState<any[]>(FALLBACK_DB_TYPES);
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
    setModalStep(1);
    setSearchQuery("");
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

  const fetchDbTypes = async () => {
    try {
      const res = await fetch("/api/backend/databases/types");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDbTypes(data);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to fetch DB types from backend, using local fallback", e);
    }
    setDbTypes(FALLBACK_DB_TYPES);
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
    fetchDbTypes();
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
        database: parsed.database || "",
        username: parsed.username || "",
        password: parsed.password || "",
        custom_url: connectionString
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
        {connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-4 border border-dashed border-slate-800 rounded-3xl bg-slate-900/10 max-w-xl mx-auto my-10">
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
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {connections.map((card) => {
              const dbInfo = resolveCardDbInfo(card, dbTypes);

              return (
                <motion.div
                  key={card.id}
                  variants={itemVariants}
                  className="bg-[var(--surface-1)] border border-slate-800/50 hover:border-slate-700 rounded-2xl p-6 transition-all duration-300 flex flex-col h-full"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                      <DynamicIcon icon={dbInfo.icon} className="h-6 w-6 text-indigo-400" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg -mr-2 -mt-2 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-slate-900 border border-slate-800 text-slate-200 rounded-xl shadow-xl p-1">
                        <DropdownMenuItem
                          onClick={() => handleToggleConnect(card)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          {card.is_default ? (
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
                          onClick={() => startEdit(card)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800 hover:text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <Edit className="h-4 w-4 text-blue-500" />
                          <span>Edit</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => handleDelete(card.id)}
                          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-red-500/10 hover:text-red-400 text-red-500 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex-1 mt-4">
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
                      onClick={() => handleToggleConnect(card)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${card.is_default
                        ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 cursor-pointer shadow-md shadow-emerald-500/5'
                        : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50 text-slate-400 cursor-pointer'
                        }`}
                      title={card.is_default ? "Click to Disconnect" : "Click to Connect"}
                    >
                      <div className={`h-2 w-2 rounded-full ${card.is_default ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                      <span className="text-xs font-bold">
                        {card.is_default ? 'Connected' : 'Not Connected'}
                      </span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

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
                    {modalStep === 1 && !editingConnection 
                      ? "Select a database type to connect." 
                      : "Provide credentials or a connection string to link your database."}
                  </p>
                </div>

                <div className="space-y-6 overflow-y-auto pr-1 flex-1">
                  {modalStep === 1 && !editingConnection ? (
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search databases (e.g. Postgres, Redis...)"
                          className="w-full bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-12 pl-10 rounded-xl text-sm placeholder:text-slate-600 text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {dbTypes.filter(db => db.name.toLowerCase().includes(searchQuery.toLowerCase()) || db.description.toLowerCase().includes(searchQuery.toLowerCase())).map(db => (
                          <button
                            key={db.id}
                            onClick={() => {
                              setDbType(db.id);
                              setModalStep(2);
                              if (db.id === 'other') {
                                setConnectionMethod('string');
                              }
                              setPort(getDefaultPort(db.id).toString());
                            }}
                            className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border border-slate-800/60 bg-[var(--surface-0)] hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all text-center group h-32"
                          >
                            <DynamicIcon icon={db.icon} className="h-10 w-10 text-slate-400 group-hover:text-white transition-colors" />
                            <span className="text-sm font-bold text-slate-300 group-hover:text-white">{db.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Back button if came from step 1 */}
                      {!editingConnection && (
                        <Button variant="ghost" className="mb-4 -ml-2 text-slate-400 hover:text-white" onClick={() => setModalStep(1)}>
                          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Catalog
                        </Button>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <label className="text-sm font-bold text-slate-300">Selected Database</label>
                          <div className="flex items-center gap-3 h-12 px-4 rounded-xl border border-slate-800 bg-[var(--surface-0)]">
                            <DynamicIcon icon={dbTypes.find(d => d.id === dbType)?.icon || ""} className="h-5 w-5" />
                            <span className="font-bold text-white">{dbTypes.find(d => d.id === dbType)?.name || dbType}</span>
                          </div>
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

                      {/* Method Toggle Tab — shown for ALL database types including Other/Custom */}
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
                          placeholder={
                            dbType === 'snowflake'
                              ? "snowflake://username:password@account/database/schema?warehouse=wh&role=rl"
                              : dbType === 'other'
                              ? "e.g., pinecone://api-key@controller.pinecone.io/my-index  or  databricks://token@workspace.net/sql"
                              : `${dbType}://username:password@host:port/database`
                          }
                          className="bg-[var(--surface-0)] border-slate-800 focus:border-indigo-500 h-12 rounded-xl text-sm placeholder:text-slate-600 font-mono text-white"
                        />
                        <p className="text-xs text-slate-500 font-medium">
                          {dbType === 'other'
                            ? "Enter a full connection URI — the protocol prefix (e.g. pinecone://, databricks://) determines the database driver used."
                            : `Provide a valid ${dbType} connection string.`}
                        </p>
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
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
