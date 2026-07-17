"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Network,
  Search,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Database,
  Loader2,
  RefreshCw,
  MessageSquare,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, tablesFromSchema, type SchemaResponse, type SchemaTable } from "@/lib/apiClient";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";

function parseSchemaText(text: string): SchemaTable[] {
  const tables: SchemaTable[] = [];
  const lines = text.split("\n");
  let current: SchemaTable | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const tableMatch =
      line.match(/^(?:Table|Collection|Label|Index)\s*[:\-]?\s*`?([\w.-]+)`?/i) ||
      line.match(/^#{1,3}\s+([\w.-]+)/) ||
      line.match(/^([\w.-]+)\s*\($/);
    if (tableMatch && !line.includes("→") && line.length < 80) {
      current = { name: tableMatch[1], columns: [] };
      tables.push(current);
      continue;
    }
    const colMatch = line.match(/^[-•*]?\s*`?([\w.-]+)`?\s*[:\-]?\s*([\w()\[\]\s,]+)?/);
    if (current && colMatch && !/^(table|collection)/i.test(colMatch[1])) {
      current.columns = current.columns || [];
      current.columns.push({
        name: colMatch[1],
        type: (colMatch[2] || "").trim() || undefined,
      });
    }
  }
  return tables;
}

function SchemaExplorerInner() {
  const searchParams = useSearchParams();
  const { activeOrgId } = useWorkspace();
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>(searchParams.get("db") || "");
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const data = await api.databases.list(activeOrgId);
      setConnections(Array.isArray(data) ? data : []);
      if (!selectedId && Array.isArray(data) && data.length > 0) {
        const def = data.find((d: any) => d.is_default) || data[0];
        setSelectedId(def.id);
      }
    } catch {
      setConnections([]);
    }
  }, [activeOrgId, selectedId]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const loadSchema = useCallback(async (id: string, refresh = false) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.schema.get(id, { refresh });
      setSchema(data);
      const tables =
        tablesFromSchema(data).length > 0
          ? tablesFromSchema(data)
          : parseSchemaText(data.schema_text || data.raw || "");
      if (tables.length > 0 && tables.length <= 8) {
        setExpanded(new Set(tables.map((t) => t.name)));
      }
    } catch (e: any) {
      setSchema(null);
      setError(e?.message || "Failed to load schema.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadSchema(selectedId);
  }, [selectedId, loadSchema]);

  const tables: SchemaTable[] = useMemo(() => {
    if (!schema) return [];
    const structured = tablesFromSchema(schema);
    if (structured.length) return structured;
    return parseSchemaText(schema.schema_text || schema.raw || "");
  }, [schema]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tables;
    return tables
      .map((t) => {
        const nameMatch = t.name.toLowerCase().includes(q);
        const cols = (t.columns || []).filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.type || "").toLowerCase().includes(q)
        );
        if (nameMatch) return t;
        if (cols.length) return { ...t, columns: cols };
        return null;
      })
      .filter(Boolean) as SchemaTable[];
  }, [tables, search]);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Copied");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectedConn = connections.find((c) => c.id === selectedId);
  const dialectLabel = schema?.dialect || schema?.db_type || selectedConn?.type;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-indigo-500" />
            Schema explorer
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse tables, collections, and columns for the selected connection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedId} onValueChange={(v) => setSelectedId(v ?? "")}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              {connections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => selectedId && loadSchema(selectedId, true)}
            disabled={!selectedId || loading}
            title="Refresh schema (bypass cache)"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          {selectedId && (
            <Link
              href={`/dashboard/chat?explore=${selectedId}`}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              <MessageSquare className="h-4 w-4" />
              Ask in Chat
            </Link>
          )}
        </div>
      </motion.div>

      {selectedConn && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5" />
          <span>{schema?.database || selectedConn.name}</span>
          {dialectLabel && (
            <Badge variant="secondary" className="text-[10px]">{dialectLabel}</Badge>
          )}
          {schema?.cached != null && (
            <Badge variant="outline" className="text-[10px]">
              {schema.cached ? "cached" : "fresh"}
            </Badge>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tables or columns…"
          className="pl-10 h-11"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !schema && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading schema…
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <Table2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            {selectedId ? "No tables found for this connection." : "Select a database to explore its schema."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((table) => {
          const isOpen = expanded.has(table.name);
          return (
            <div
              key={table.name}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-accent/50">
                <button
                  type="button"
                  onClick={() => toggle(table.name)}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left min-w-0"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <Table2 className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="font-semibold text-sm flex-1 truncate">{table.name}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {(table.columns || []).length} cols
                  </Badge>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyText(table.name, `t-${table.name}`)}
                  title={`Copy ${table.name}`}
                >
                  {copied === `t-${table.name}` ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              {isOpen && (
                <div className="border-t border-border">
                  {(table.columns || []).length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">No column details</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {(table.columns || []).map((col) => (
                        <li
                          key={col.name}
                          className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent/30"
                        >
                          <span className="font-mono text-xs flex-1 truncate">{col.name}</span>
                          {col.type && (
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                              {col.type}
                            </span>
                          )}
                          {col.primary_key && (
                            <Badge className="text-[9px] bg-amber-500/15 text-amber-600 border-0">PK</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyText(col.name, `c-${table.name}.${col.name}`)}
                          >
                            {copied === `c-${table.name}.${col.name}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SchemaExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      }
    >
      <SchemaExplorerInner />
    </Suspense>
  );
}
