"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  Copy,
  Check,
  Bot,
  Code,
  BarChart3,
  ChevronDown,
  Plus,
  Sparkles,
  ArrowRight,
  MoreVertical,
  Star,
  Trash2,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  Pencil,
  RefreshCw,
  MessageSquare,
  Mic,
  MicOff,
  MoreHorizontal,
  ShoppingCart,
  Database,
  FileText,
  PieChart as PieChartIcon,
  BarChart2,
  Table as TableIcon,
  ExternalLink,
  ArrowUpRight,
  Calendar,
  Download,
  Search,
  Bookmark,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  timestamp: string;
  tableData?: {
    headers: string[];
    rows: string[][];
  };
  versions?: {
    content: string;
    sql?: string;
    tableData?: any;
    timestamp: string;
    response?: {
      content: string;
      sql?: string;
      tableData?: any;
      timestamp: string;
    };
  }[];
  currentVersionIndex?: number;
}

const initialMessages: Message[] = [];

const dbSuggestions: Record<string, string[]> = {
  default: [
    "List all tables in the database",
    "Show the schema of the most active table",
    "How many records were added today?",
  ],
  postgresql: [
    "Show all active connections",
    "List the top 10 largest tables",
    "Show recent database locks",
  ],
  mysql: [
    "Show current process list",
    "List database indexes",
    "Show table status and sizes",
  ],
  demo: [
    "Top products by sales",
    "Users who signed up last week",
    "Revenue trend by month",
    "Total inventory value",
  ]
};

const chatHistory: { id: string; title: string; active: boolean }[] = [];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSQL, setShowSQL] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selection, setSelection] = useState<{ text: string, x: number, y: number } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [provider, setProvider] = useState<string>("gemini");
  const [model, setModel] = useState<string>("gemini-2.0-flash");
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [selectedDbs, setSelectedDbs] = useState<string[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [history, setHistory] = useState<{ id: string; title: string; active: boolean; messages: Message[]; isFavorite?: boolean }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isHistorySearchOpen, setIsHistorySearchOpen] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [savedQueryIds, setSavedQueryIds] = useState<Set<string>>(new Set());
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [activeResult, setActiveResult] = useState<any>(null);
  const [resultsTab, setResultsTab] = useState("results");

  const [showWarningModal, setShowWarningModal] = useState(false);

  // Database configuration states inside warning modal
  const [activeConfigDb, setActiveConfigDb] = useState<any | null>(null);
  const [dbType, setDbType] = useState("postgresql");
  const [connectionString, setConnectionString] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [connectionMethod, setConnectionMethod] = useState<'string' | 'params'>('string');
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{status: 'success' | 'error', message: string} | null>(null);

  const DB_TYPES = [
    { id: "postgresql", name: "PostgreSQL" },
    { id: "mysql", name: "MySQL" },
    { id: "mongodb", name: "MongoDB" },
  ];

  const getDefaultPort = (type: string) => {
    switch (type) {
      case 'postgresql': return 5432;
      case 'mysql': return 3306;
      case 'mongodb': return 27017;
      default: return 5432;
    }
  };

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
      let hostPort = hostPortDb;
      let database = "";
      const firstSlashIndex = hostPortDb.indexOf('/');
      if (firstSlashIndex !== -1) {
        hostPort = hostPortDb.substring(0, firstSlashIndex);
        database = hostPortDb.substring(firstSlashIndex + 1);
      }
      let host = hostPort;
      let port = type === 'postgresql' ? 5432 : (type === 'mongodb' ? 27017 : 3306);
      const lastColonIndex = hostPort.lastIndexOf(':');
      if (lastColonIndex !== -1) {
        const portStr = hostPort.substring(lastColonIndex + 1);
        if (/^\d+$/.test(portStr)) {
          host = hostPort.substring(0, lastColonIndex);
          port = parseInt(portStr);
        }
      }
      return { type, host, port, database, username, password };
    } catch (e) {
      return null;
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
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password
      };
    } else {
      if (!databaseName) return null;
      payload = {
        name: displayName || `${dbType}_${databaseName}`,
        type: dbType,
        host: host || "localhost",
        port: port ? parseInt(port) : getDefaultPort(dbType),
        database: databaseName,
        username: username,
        password: password
      };
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
      const res = await fetch("http://localhost:8000/databases/test", {
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
      const existing = databases.find(db => db.id === activeConfigDb?.id);
      const url = existing 
        ? `http://localhost:8000/databases/${existing.id}`
        : "http://localhost:8000/databases";
      const method = existing ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const savedConn = await res.json();
        
        // If not default/connected, set it to default/connected
        if (!savedConn.is_default) {
          await fetch(`http://localhost:8000/databases/${savedConn.id}/default`, {
            method: "PUT",
          });
        }

        setTestResult({ 
          status: 'success', 
          message: "Successfully connected and saved!" 
        });
        
        await fetchDatabases();
        
        setTimeout(() => {
          setActiveConfigDb(null);
          setTestResult(null);
        }, 1500);
      } else {
        setTestResult({ 
          status: 'error', 
          message: "Failed to save connection details." 
        });
      }
    } catch (e) {
      setTestResult({ status: 'error', message: "Failed to connect to backend server." });
    } finally {
      setIsSaving(false);
    }
  };

  const startConfigDb = (dbInfo: any) => {
    const existing = databases.find(db => db.id === dbInfo.id);
    setActiveConfigDb(dbInfo);
    setDbType(dbInfo.type?.toLowerCase().includes("mongo") ? "mongodb" : (dbInfo.type?.toLowerCase().includes("mysql") ? "mysql" : "postgresql"));
    setDisplayName(dbInfo.name || "");
    setTestResult(null);

    if (existing) {
      setHost(existing.host || "");
      setPort(existing.port ? String(existing.port) : "");
      setDatabaseName(existing.database || "");
      setUsername(existing.username || "");
      setPassword(existing.password || "");
      
      let connStr = "";
      if (existing.type === "sqlite") {
        connStr = `sqlite:///${existing.database}`;
      } else {
        const user = existing.username ? decodeURIComponent(existing.username) : "";
        const pass = existing.password ? decodeURIComponent(existing.password) : "";
        const auth = (user || pass) ? `${user}:${pass}@` : "";
        const portStr = existing.port ? `:${existing.port}` : "";
        connStr = `${existing.type}://${auth}${existing.host || ""}${portStr}/${existing.database || ""}`;
      }
      setConnectionString(connStr);
      setConnectionMethod(existing.host || existing.username ? "params" : "string");
    } else {
      setHost("localhost");
      setPort("");
      setDatabaseName("");
      setUsername("");
      setPassword("");
      setConnectionString("");
      setConnectionMethod("string");
    }
  };

  const handleConnectDbInModal = async (dbId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/databases/${dbId}/default`, {
        method: "PUT",
      });
      if (res.ok) {
        await fetchDatabases();
      }
    } catch (e) {
      console.error("Failed to connect database in modal", e);
    }
  };

  const currentProject = projects.find(p => p.id === selectedProject);

  const filteredDatabases = databases.filter(db => {
    // Only display connected databases
    if (!db.is_default) return false;
    if (!selectedProject) return true;
    return currentProject?.databases?.some((pdb: any) => pdb.id === db.id);
  });

  const [historyWidth, setHistoryWidth] = useState(256);
  const [isResizingHistory, setIsResizingHistory] = useState(false);

  const startResizingHistory = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizingHistory(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingHistory) return;
      setHistoryWidth((prev) => {
        const next = prev + e.movementX;
        if (next < 120) {
          setIsHistoryOpen(false);
          return 256;
        }
        setIsHistoryOpen(true);
        return next > 180 && next < 450 ? next : prev;
      });
    };

    const handleMouseUp = () => {
      setIsResizingHistory(false);
    };

    if (isResizingHistory) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingHistory]);

  const [summaryWidth, setSummaryWidth] = useState(500);
  const [isResizingSummary, setIsResizingSummary] = useState(false);

  const startResizingSummary = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizingSummary(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSummary) return;
      setSummaryWidth((prev) => {
        const next = prev - e.movementX;
        if (next < 150) {
          setIsResultsOpen(false);
          return 500;
        }
        setIsResultsOpen(true);
        return next > 250 && next < 900 ? next : prev;
      });
    };

    const handleMouseUp = () => {
      setIsResizingSummary(false);
    };

    if (isResizingSummary) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSummary]);

  useEffect(() => {
    // If a new assistant message with tableData arrives, auto-open results
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.tableData) {
      setActiveResult(lastMsg);
      setIsResultsOpen(true);
    }
  }, [messages]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");

  const getSuggestions = () => {
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return dbSuggestions.default;
    return dbSuggestions[db.name.toLowerCase()] || dbSuggestions[db.type] || dbSuggestions.default;
  };

  const fetchSuggestions = async (msgs: Message[]) => {
    if (msgs.length === 0) {
      setSuggestions(getSuggestions());
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: msgs.map(m => ({ role: m.role, content: m.content })),
          connection_id: selectedDb,
          provider,
          model
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.length > 0 ? data : getSuggestions());
      } else {
        setSuggestions(getSuggestions());
      }
    } catch (e) {
      setSuggestions(getSuggestions());
    }
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const msg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: `Attached file: ${file.name}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev, msg]);
    }
  };

  const handleGenerate = () => {
    const suggestions = getSuggestions();
    const random = suggestions[Math.floor(Math.random() * suggestions.length)];
    setInput(random);
  };

  const handleRegenerate = async (msgId: string) => {
    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const targetMsg = messages[msgIndex];
    let promptContent = "";
    let userMsgId = "";

    if (targetMsg.role === 'user') {
      promptContent = targetMsg.content;
      userMsgId = targetMsg.id;
    } else {
      const prevMsg = messages[msgIndex - 1];
      if (prevMsg && prevMsg.role === 'user') {
        promptContent = prevMsg.content;
        userMsgId = prevMsg.id;
      } else {
        return;
      }
    }

    setEditValue(promptContent);
    handleSaveEdit(userMsgId, promptContent);
  };

  const handleEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditValue(msg.content);
  };

  const handleVersionChange = (msgId: string, direction: 'prev' | 'next') => {
    setMessages(prev => {
      const newMessages = [...prev];
      const msgIndex = newMessages.findIndex(m => m.id === msgId);
      if (msgIndex === -1) return prev;

      const msg = newMessages[msgIndex];
      if (!msg.versions) return prev;

      const newIndex = direction === 'prev'
        ? Math.max(0, (msg.currentVersionIndex || 0) - 1)
        : Math.min(msg.versions.length - 1, (msg.currentVersionIndex || 0) + 1);

      const version = msg.versions[newIndex];

      newMessages[msgIndex] = {
        ...msg,
        currentVersionIndex: newIndex,
        content: version.content,
        timestamp: version.timestamp
      };

      const nextMsg = newMessages[msgIndex + 1];
      if (nextMsg && nextMsg.role === 'assistant' && version.response) {
        newMessages[msgIndex + 1] = {
          ...nextMsg,
          content: version.response.content,
          sql: version.response.sql,
          tableData: version.response.tableData,
          timestamp: version.response.timestamp
        };
      }

      return newMessages;
    });
  };

  const handleSaveEdit = async (msgId: string, overrideValue?: string) => {
    const finalValue = overrideValue || editValue;
    if (!finalValue.trim()) return;

    const userMsgIndex = messages.findIndex(m => m.id === msgId);
    if (userMsgIndex === -1) return;

    const originalMsg = messages[userMsgIndex];

    const newVersion = {
      content: finalValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedUserMsg = {
      ...originalMsg,
      content: finalValue,
      versions: [...(originalMsg.versions || [{
        content: originalMsg.content,
        sql: originalMsg.sql,
        tableData: originalMsg.tableData,
        timestamp: originalMsg.timestamp,
        response: messages[userMsgIndex + 1] ? {
          content: messages[userMsgIndex + 1].content,
          sql: messages[userMsgIndex + 1].sql,
          tableData: messages[userMsgIndex + 1].tableData,
          timestamp: messages[userMsgIndex + 1].timestamp
        } : undefined
      }]), newVersion],
      currentVersionIndex: (originalMsg.versions?.length || 1)
    };

    const baseMessages = messages.slice(0, userMsgIndex);
    const thinkingMessages = [...baseMessages, updatedUserMsg];

    if (messages[userMsgIndex + 1] && messages[userMsgIndex + 1].role === 'assistant') {
      thinkingMessages.push({
        ...messages[userMsgIndex + 1],
        content: "...",
        sql: undefined,
        tableData: undefined
      });
    } else {
      thinkingMessages.push({
        id: Date.now().toString() + "-assistant-thinking",
        role: "assistant",
        content: "...",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }

    setMessages(thinkingMessages);
    setEditingMessageId(null);
    setIsTyping(true);

    // Resolve connection_id the same way handleSend does
    let effectiveDb = selectedDb;
    if (!effectiveDb && selectedProject) {
      if (filteredDatabases && filteredDatabases.length > 0) {
        effectiveDb = filteredDatabases[0].id;
        setSelectedDb(filteredDatabases[0].id);
      }
    }

    if (!effectiveDb) {
      const warningMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Please select a database before regenerating.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages(prev => [...prev.slice(0, -1), warningMsg]);
      setIsTyping(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: finalValue,
          provider: provider,
          model: model,
          connection_id: effectiveDb,
          connection_ids: selectedDbs.length > 0 ? selectedDbs : [effectiveDb]
        }),
      });

      const data = await response.json();

      const assistantMsg: Message = {
        id: (messages[userMsgIndex + 1]?.id || Date.now().toString() + "-assistant"),
        role: "assistant",
        content: data.content,
        sql: data.sql,
        tableData: data.tableData,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const currentIdx = updatedUserMsg.currentVersionIndex!;
      (updatedUserMsg.versions![currentIdx] as any).response = {
        content: assistantMsg.content,
        sql: assistantMsg.sql,
        tableData: assistantMsg.tableData,
        timestamp: assistantMsg.timestamp
      };

      const finalMessages = [...baseMessages, updatedUserMsg, assistantMsg];

      setMessages(finalMessages);
      fetchSuggestions(finalMessages);

      setHistory(hPrev => hPrev.map(h =>
        h.id === currentSessionId ? { ...h, messages: finalMessages } : h
      ));
    } catch (error) {
      console.error("Edit failed:", error);
      setMessages(messages);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem("chat_sessions");
    const savedCurrentId = localStorage.getItem("current_session_id");

    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);

        if (savedCurrentId) {
          setCurrentSessionId(savedCurrentId);
          const currentSession = parsedHistory.find((s: any) => s.id === savedCurrentId);
          if (currentSession) {
            setMessages(currentSession.messages || []);
            fetchSuggestions(currentSession.messages || []);
          }
        }
      } catch (e) {
        console.error("Error parsing saved history", e);
      }
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem("chat_sessions", JSON.stringify(history));
    }
  }, [history]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem("current_session_id", currentSessionId);
    } else {
      localStorage.removeItem("current_session_id");
    }
  }, [currentSessionId]);

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setInput("");
    setSuggestions([]);
    setHistory(prev => prev.map(h => ({ ...h, active: false })));
  };

  const loadSession = (sessionId: string) => {
    const session = history.find(s => s.id === sessionId);
    if (session) {
      setMessages(session.messages || []);
      setCurrentSessionId(sessionId);
      fetchSuggestions(session.messages || []);
      setHistory(prev => prev.map(h => ({
        ...h,
        active: h.id === sessionId
      })));
    }
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h.id !== sessionId);
    setHistory(newHistory);
    if (currentSessionId === sessionId) {
      setMessages([]);
      setCurrentSessionId(null);
      setSuggestions([]);
    }
  };

  const toggleFavoriteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const newHistory = history.map(h =>
      h.id === sessionId ? { ...h, isFavorite: !h.isFavorite } : h
    );
    setHistory(newHistory);
  };

  const getCanonicalMsgId = (msg: Message) => {
    if (msg.role === "user") return msg.id;
    const idx = messages.findIndex(m => m.id === msg.id);
    if (idx > 0 && messages[idx - 1].role === "user") {
      return messages[idx - 1].id;
    }
    return msg.id;
  };

  const isMessageFavorited = (msg: Message) => {
    const canonicalId = getCanonicalMsgId(msg);
    return savedQueryIds.has(canonicalId);
  };

  const toggleFavoriteMessage = (msg: Message) => {
    const canonicalId = getCanonicalMsgId(msg);
    const savedFavs = localStorage.getItem("favorite_queries");
    let favs = savedFavs ? JSON.parse(savedFavs) : [];
    const isAlreadyFav = favs.some((f: any) => f.id === canonicalId);

    let updatedFavs;
    if (isAlreadyFav) {
      updatedFavs = favs.filter((f: any) => f.id !== canonicalId);
      setSavedQueryIds(prev => {
        const next = new Set(prev);
        next.delete(canonicalId);
        return next;
      });
    } else {
      // Find the user message and assistant message
      let userMsg = msg;
      let assistantMsg = msg;
      const idx = messages.findIndex(m => m.id === msg.id);
      
      if (msg.role === "user") {
        userMsg = msg;
        if (idx >= 0 && idx + 1 < messages.length) {
          assistantMsg = messages[idx + 1];
        }
      } else {
        if (idx > 0) {
          userMsg = messages[idx - 1];
        }
        assistantMsg = msg;
      }

      const dbName = databases.find(db => db.id === selectedDb)?.name || "PostgreSQL";

      favs.push({
        id: canonicalId,
        question: userMsg.content,
        answer: assistantMsg?.content || "",
        sql: assistantMsg?.sql || "",
        tableData: assistantMsg?.tableData || null,
        timestamp: userMsg.timestamp || Date.now(),
        sessionId: currentSessionId,
        database: dbName
      });
      updatedFavs = favs;
      setSavedQueryIds(prev => {
        const next = new Set(prev);
        next.add(canonicalId);
        return next;
      });
    }

    localStorage.setItem("favorite_queries", JSON.stringify(updatedFavs));
    setMessages([...messages]);
  };

  const handleToggleSave = (msg: Message) => {
    toggleFavoriteMessage(msg);
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    setHistory(prev => prev.map(h =>
      h.id === sessionId ? { ...h, title: newTitle } : h
    ));
    setEditingSessionId(null);
  };

  const fetchDatabases = async () => {
    try {
      const response = await fetch("http://localhost:8000/databases");
      const data = await response.json();
      if (Array.isArray(data)) {
        setDatabases(data);
        const connectedDbs = data.filter((db: any) => db.is_default);
        if (connectedDbs.length > 0) {
          setSelectedDb(connectedDbs[0].id);
        } else {
          setSelectedDb("");
        }
      } else {
        setDatabases([]);
      }
    } catch (error) {
      console.error("Error fetching databases:", error);
    }
  };

  useEffect(() => {
    fetchDatabases();
    try {
      const savedProjects = localStorage.getItem("insight_projects");
      if (savedProjects) {
        const parsed = JSON.parse(savedProjects);
        setProjects(parsed);
        setSelectedProject("");
      }
    } catch (error) {
      console.error("Error reading projects in chat mount:", error);
    }
    try {
      const saved = localStorage.getItem("favorite_queries");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSavedQueryIds(new Set(parsed.map((item: any) => item.id)));
      }
    } catch (e) {
      console.error("Error loading saved queries in chat mount:", e);
    }
  }, []);

  // Sync selectedDb whenever selectedProject, databases, or projects update
  useEffect(() => {
    if (selectedProject) {
      const proj = projects.find(p => p.id === selectedProject);
      if (proj && proj.databases && proj.databases.length > 0) {
        // Find the first connected database of the project
        const firstDb = databases.find(db => db.is_default && proj.databases.some((pdb: any) => pdb.id === db.id));
        if (firstDb) {
          setSelectedDb(firstDb.id);
          setSelectedDbs([firstDb.id]);
        } else {
          // If no database is default/connected, fall back to the first available database of the project
          const anyProjDb = databases.find(db => proj.databases.some((pdb: any) => pdb.id === db.id));
          if (anyProjDb) {
            setSelectedDb(anyProjDb.id);
            setSelectedDbs([anyProjDb.id]);
          } else {
            setSelectedDb("");
            setSelectedDbs([]);
          }
        }
      } else {
        setSelectedDb("");
        setSelectedDbs([]);
      }
    } else {
      setSelectedDb("");
      setSelectedDbs([]);
    }
  }, [selectedProject, databases, projects]);

  // Hook to show connection warning modal if databases of selected project are not connected
  useEffect(() => {
    if (selectedProject) {
      const proj = projects.find(p => p.id === selectedProject);
      if (proj && proj.databases && proj.databases.length > 0) {
        const hasDisconnected = proj.databases.some((pdb: any) => {
          const dbInList = databases.find(db => db.id === pdb.id);
          return !dbInList || !dbInList.is_default;
        });
        if (hasDisconnected) {
          setShowWarningModal(true);
          setActiveConfigDb(null);
        }
      }
    } else {
      setShowWarningModal(false);
      setActiveConfigDb(null);
    }
  }, [selectedProject]);

  // Derive connected/disconnected databases of the selected project
  const projectDbsInfo = currentProject?.databases || [];
  const disconnectedProjectDbs = projectDbsInfo.filter((pdb: any) => {
    const dbInList = databases.find(db => db.id === pdb.id);
    return !dbInList || !dbInList.is_default;
  });
  const connectedProjectDbs = projectDbsInfo.filter((pdb: any) => {
    const dbInList = databases.find(db => db.id === pdb.id);
    return dbInList && dbInList.is_default;
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const runMsgId = localStorage.getItem("insight_run_saved_query_msg_id");
    if (runMsgId) {
      setTimeout(() => {
        const element = document.getElementById(`msg-${runMsgId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("animate-pulse-highlight");
          localStorage.removeItem("insight_run_saved_query_msg_id");
        }
      }, 400);
    } else {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(prev => {
          const base = prev.trim();
          return base ? `${base} ${transcript}` : transcript;
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      const selectedText = window.getSelection()?.toString().trim();
      if (selectedText && selectedText.length > 0) {
        const range = window.getSelection()?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect) {
          setSelection({
            text: selectedText,
            x: rect.left + rect.width / 2,
            y: rect.top + window.scrollY - 40
          });
        }
      } else {
        setSelection(null);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleAskSelected = () => {
    if (!selection) return;
    const quoteText = `"${selection.text}"\n\n`;
    setInput(prev => quoteText + prev);
    setSelection(null);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    let updatedSessionId = currentSessionId;
    if (!currentSessionId) {
      updatedSessionId = userMsg.id;
      setCurrentSessionId(updatedSessionId);
      setHistory(prev => [
        {
          id: updatedSessionId!,
          title: input.substring(0, 30) + (input.length > 30 ? "..." : ""),
          active: true,
          messages: newMessages
        },
        ...prev.map(h => ({ ...h, active: false }))
      ]);
    } else {
      setHistory(prev => prev.map(h =>
        h.id === currentSessionId
          ? { ...h, messages: newMessages }
          : h
      ));
    }
    let effectiveDb = selectedDb;
    
    // Auto-resolve database from selected project if one is not explicitly selected
    if (!effectiveDb && selectedProject) {
      if (filteredDatabases && filteredDatabases.length > 0) {
        effectiveDb = filteredDatabases[0].id;
        setSelectedDb(filteredDatabases[0].id); // Auto-select it in the UI
      }
    }

    if (!effectiveDb) {
      const warningMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: selectedProject 
          ? "The selected project has no connected databases. Please add a database to the project or select one manually."
          : "Please select a database or project from the header before asking a question.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, warningMsg]);
      setIsTyping(false);
      return;
    }

    if (!provider) {
      const warningMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: "Please select an AI Provider (e.g. Gemini) from the header before asking a question.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, warningMsg]);
      setIsTyping(false);
      return;
    }
    setIsTyping(true);

    try {
      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: input,
          provider: provider,
          model: model,
          connection_id: effectiveDb,
          connection_ids: selectedDbs.length > 0 ? selectedDbs : [effectiveDb]
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to get response from backend");
      }

      setMessages((prev) => {
        const updated = [...prev, data];
        fetchSuggestions(updated);

        // Auto-summarize if this is the first interaction in the session
        if (updated.length === 2) {
          fetch("http://localhost:8000/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: input,
              response: data.content,
              provider,
              model
            }),
          }).then(res => res.json())
            .then(({ title }) => {
              if (title) {
                setHistory(hPrev => hPrev.map(h =>
                  h.id === updatedSessionId ? { ...h, title } : h
                ));
              }
            }).catch(e => console.error("Summarization failed:", e));
        }

        setHistory(hPrev => hPrev.map(h =>
          h.id === updatedSessionId
            ? { ...h, messages: updated }
            : h
        ));
        return updated;
      });
    } catch (error) {
      console.error("Error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Could not connect to backend. Make sure it's running."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Dynamic Results Logic for Right Panel
  const resultsData = activeResult?.results;
  const isResultsArray = Array.isArray(resultsData);
  const hasResults = isResultsArray && resultsData.length > 0;
  const firstRow = hasResults ? resultsData[0] : null;
  const isObjectRow = firstRow !== null && typeof firstRow === 'object' && !Array.isArray(firstRow);
  const resultColumns = isObjectRow ? Object.keys(firstRow) : [];
  const useBullets = hasResults && (!isObjectRow || resultColumns.length === 1);
  const useStatsCard = hasResults && isObjectRow && resultColumns.length === 1 && resultsData.length === 1;

  return (
    <div className="h-full flex overflow-hidden">
      <AnimatePresence mode="wait">
        {isHistoryOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: historyWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="hidden xl:flex border-r flex-col bg-muted/20 overflow-hidden h-full relative"
          >
            <div className="p-3.5 min-h-[57px] flex items-center justify-between transition-all duration-300">
              {isHistorySearchOpen ? (
                <div className="flex items-center gap-1.5 w-full relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    autoFocus
                    placeholder="Search history..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-800 text-xs rounded-xl h-8 pl-8 pr-7 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 hover:text-white"
                    onClick={() => {
                      setIsHistorySearchOpen(false);
                      setHistorySearchQuery("");
                    }}
                  >
                    <span className="text-sm font-bold">×</span>
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold">History</h3>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-white"
                      title="Search History"
                      onClick={() => setIsHistorySearchOpen(true)}
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-white"
                      title="New Session"
                      onClick={handleNewChat}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-white"
                      title="Close History Panel"
                      onClick={() => setIsHistoryOpen(false)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
            <Separator />
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-0.5">
                {history
                  .filter((chat) =>
                    chat.title.toLowerCase().includes(historySearchQuery.toLowerCase())
                  )
                  .map((chat) => (
                  <div
                    key={chat.id}
                    className={`group relative flex items-center rounded-lg transition-colors mb-0.5 ${chat.active ? "bg-accent" : "hover:bg-accent/50"}`}
                  >
                    <button
                      onClick={() => loadSession(chat.id)}
                      className={`flex-1 text-left px-3 py-2.5 min-w-0 ${chat.active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {editingSessionId === chat.id ? (
                        <input
                          autoFocus
                          className="w-full bg-background border rounded px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                          value={editingSessionTitle}
                          onChange={(e) => setEditingSessionTitle(e.target.value)}
                          onBlur={() => handleRenameSession(chat.id, editingSessionTitle)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSession(chat.id, editingSessionTitle);
                            if (e.key === 'Escape') setEditingSessionId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="block truncate text-sm">
                          {chat.title}
                        </span>
                      )}
                    </button>

                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(chat.id);
                            setEditingSessionTitle(chat.title);
                          }}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => toggleFavoriteSession(e, chat.id)}>
                            <Star className={`mr-2 h-3.5 w-3.5 ${chat.isFavorite ? "fill-current text-amber-500" : ""}`} />
                            {chat.isFavorite ? "Unfavorite" : "Favorite"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                            onClick={(e) => {
                               e.stopPropagation();
                               deleteSession(e as unknown as React.MouseEvent, chat.id);
                            }}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2">
                View all chats →
              </button>
            </ScrollArea>
            {/* Dynamic Drag Handle */}
            <div
              onMouseDown={startResizingHistory}
              className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/60 z-50 transition-all ${
                isResizingHistory ? "bg-indigo-650 w-[3px] border-r-2 border-indigo-400" : "bg-transparent hover:w-1.5"
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <AnimatePresence>
          {selection && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              style={{ left: selection.x, top: selection.y }}
              className="fixed z-[100] -translate-x-1/2 flex items-center bg-background border shadow-xl rounded-full px-1 py-1"
            >
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-full text-xs font-medium gap-1.5 px-3 hover:bg-muted"
                onClick={handleAskSelected}
              >
                <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                Ask Question
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="min-h-14 border-b flex flex-col md:flex-row md:items-center justify-between px-6 py-3 gap-3 flex-shrink-0 z-10 bg-slate-50 dark:bg-[var(--surface-0)]">
          <div className="flex items-center gap-3">
            {!isHistoryOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsHistoryOpen(true)}>
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}
            <h2 className="font-semibold text-sm">Chat</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-start md:justify-end w-full md:w-auto">
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="provider-select" className="text-xs text-muted-foreground hidden lg:inline">
                AI Provider:
              </Label>
              <Select value={provider} onValueChange={(val) => {
                setProvider(val);
                if (val === "gemini") setModel("gemini-2.0-flash");
                else if (val === "openai") setModel("gpt-4o");
                else if (val === "anthropic") setModel("claude-3-5-sonnet");
                else if (val === "deepseek") setModel("deepseek-v4-pro");
              }}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">✨ Gemini</SelectItem>
                  <SelectItem value="openai">🤖 OpenAI</SelectItem>
                  <SelectItem value="anthropic">🧠 Anthropic</SelectItem>
                  <SelectItem value="deepseek">🐋 DeepSeek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  {provider === "gemini" && (
                    <>
                      <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                      <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                    </>
                  )}
                  {provider === "openai" && (
                    <>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </>
                  )}
                  {provider === "anthropic" && (
                    <>
                      <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                    </>
                  )}
                  {provider === "deepseek" && (
                    <>
                      <SelectItem value="deepseek-v4-pro">DeepSeek V4 Pro</SelectItem>
                      <SelectItem value="deepseek-v4-flash">DeepSeek V4 Flash</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="project-select" className="text-xs text-muted-foreground hidden lg:inline">
                Project:
              </Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="Select Project">
                    {projects.find(p => p.id === selectedProject)?.title || "Select Project"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">🌐 Select Project</SelectItem>
                  {projects.filter((p: any) => p.status === "Active" || !p.status).map((proj) => (
                    <SelectItem key={proj.id} value={proj.id}>
                      📂 {proj.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="db-select" className="text-xs text-muted-foreground hidden lg:inline">
                Database:
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="outline" className="h-8 w-44 text-xs flex justify-between items-center px-3 border-slate-800 bg-slate-900 text-white hover:bg-slate-850 hover:text-white rounded-xl">
                    <span className="truncate max-w-[120px]">
                      {selectedDbs.length > 0 ? (
                        selectedDbs.map(id => databases.find(db => db.id === id)?.name).filter(Boolean).join(", ")
                      ) : selectedDb ? (
                        databases.find(db => db.id === selectedDb)?.name || "Select Database"
                      ) : (
                        "Select Database"
                      )}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-60 ml-1.5 flex-shrink-0" />
                  </Button>
                } />
                <DropdownMenuContent className="bg-slate-900 border-slate-800 text-white w-48">
                  {filteredDatabases.length > 0 && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedDbs.length === filteredDatabases.length) {
                          setSelectedDbs([]);
                          setSelectedDb("");
                        } else {
                          const allIds = filteredDatabases.map(db => db.id);
                          setSelectedDbs(allIds);
                          if (allIds.length > 0) setSelectedDb(allIds[0]);
                        }
                      }}
                      className="cursor-pointer hover:bg-slate-800 text-xs flex items-center justify-between py-2 px-3 rounded-lg transition-colors select-none text-white w-full"
                    >
                      <span className="font-semibold text-indigo-400">🌐 Select All</span>
                      <Switch 
                        checked={selectedDbs.length === filteredDatabases.length && filteredDatabases.length > 0}
                        className="pointer-events-none data-[state=checked]:bg-indigo-600 scale-75"
                      />
                    </div>
                  )}
                  {filteredDatabases.length > 0 && <DropdownMenuSeparator className="bg-slate-800" />}
                  {filteredDatabases.map((db) => {
                    const isChecked = selectedDbs.includes(db.id) || (selectedDbs.length === 0 && selectedDb === db.id);
                    return (
                      <div
                        key={db.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          let updated;
                          if (selectedDbs.includes(db.id)) {
                            updated = selectedDbs.filter(id => id !== db.id);
                          } else {
                            updated = [...selectedDbs, db.id];
                          }
                          setSelectedDbs(updated);
                          // Keep single selectedDb in sync for backward compatibility / fallback
                          if (updated.length > 0) {
                            setSelectedDb(updated[0]);
                          } else {
                            setSelectedDb("");
                          }
                        }}
                        className="cursor-pointer hover:bg-slate-800 text-xs flex items-center justify-between py-2 px-3 rounded-lg transition-colors select-none text-white w-full"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{db.type === 'postgresql' ? '🐘' : db.type === 'mysql' ? '🐬' : db.type === 'mongodb' ? '🍃' : '🪶'}</span>
                          <span>{db.name}</span>
                        </span>
                        <Switch 
                          checked={isChecked}
                          className="pointer-events-none data-[state=checked]:bg-indigo-600 scale-75"
                        />
                      </div>
                    );
                  })}
                  {filteredDatabases.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-500">
                      No connected databases
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="show-sql" className="text-xs text-muted-foreground hidden sm:inline">
                Show Generated SQL
              </Label>
              <Switch
                id="show-sql"
                checked={showSQL}
                onCheckedChange={setShowSQL}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0 border-t border-b bg-muted/5">
          <div className="max-w-3xl mx-auto p-6 space-y-6 pb-52">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3 group/msg ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 mt-1">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div className={`max-w-[80%] space-y-3 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`relative rounded-2xl px-4 py-3 ${msg.role === "user"
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-md ml-auto shadow-md shadow-blue-500/10"
                        : "bg-muted rounded-tl-md"
                        }`}
                    >
                      {editingMessageId === msg.id ? (
                        <div className="space-y-3 min-w-[240px]">
                          <Textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 text-sm focus-visible:ring-white/30"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-white hover:bg-white/10" onClick={() => setEditingMessageId(null)}>
                              Cancel
                            </Button>
                            <Button size="sm" className="h-7 text-xs bg-white text-blue-600 hover:bg-white/90" onClick={() => handleSaveEdit(msg.id)}>
                              Save & Submit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                    </div>

                    <div className={`flex items-center gap-3 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 px-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.versions && msg.versions.length > 1 && (
                        <div className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border">
                          <button
                            disabled={(msg.currentVersionIndex || 0) === 0}
                            onClick={() => handleVersionChange(msg.id, 'prev')}
                            className="hover:text-foreground disabled:opacity-30"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <span>{(msg.currentVersionIndex || 0) + 1} / {msg.versions.length}</span>
                          <button
                            disabled={(msg.currentVersionIndex || 0) === msg.versions.length - 1}
                            onClick={() => handleVersionChange(msg.id, 'next')}
                            className="hover:text-foreground disabled:opacity-30"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        {msg.role === "user" && editingMessageId !== msg.id && (
                          <button
                            onClick={() => handleEdit(msg)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-blue-500 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRegenerate(msg.id)}
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-blue-500 transition-colors"
                          title="Regenerate"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-blue-500 transition-colors"
                          title="Copy"
                        >
                          {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => toggleFavoriteMessage(msg)}
                          className={`p-1 hover:bg-muted rounded transition-colors ${
                            isMessageFavorited(msg)
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-muted-foreground hover:text-amber-500"
                          }`}
                          title={isMessageFavorited(msg) ? "Remove from Favourite" : "Save as Favourite"}
                        >
                          <Star className={`h-3.5 w-3.5 ${isMessageFavorited(msg) ? "fill-current" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {msg.sql && showSQL && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="rounded-xl overflow-hidden border bg-card"
                      >
                        <Tabs defaultValue="results" className="w-full bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden"
                          onValueChange={(val) => {
                            if (val === "results" && msg.tableData) {
                              setActiveResult(msg);
                              setIsResultsOpen(true);
                            }
                          }}
                        >
                          <TabsList className="bg-muted/30 w-full justify-start rounded-none border-b h-10 px-1">
                            <TabsTrigger value="results" className="text-xs h-8 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                              Results
                            </TabsTrigger>
                            <TabsTrigger value="sql" className="text-xs h-8 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                              SQL
                            </TabsTrigger>
                            <div className="flex-1" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 text-[10px] gap-1.5 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors ${
                                isMessageFavorited(msg)
                                  ? "text-indigo-500 font-black bg-indigo-500/10 hover:bg-indigo-500/15"
                                  : "text-muted-foreground hover:text-slate-900 dark:hover:text-white"
                              }`}
                              onClick={() => handleToggleSave(msg)}
                              title={isMessageFavorited(msg) ? "Saved to Queries" : "Save Query"}
                            >
                              <Bookmark className={`h-3.5 w-3.5 ${isMessageFavorited(msg) ? "fill-current" : ""}`} />
                              {isMessageFavorited(msg) ? "Saved" : "Save"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px] gap-1.5 px-2 hover:bg-background"
                              onClick={() => {
                                if (msg.sql) navigator.clipboard.writeText(msg.sql);
                              }}
                            >
                              <Copy className="h-3 w-3" />
                              Copy
                            </Button>
                          </TabsList>

                          <TabsContent value="results" className="p-0">
                            {msg.tableData ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="bg-muted/20">
                                      {msg.tableData.headers.slice(0, 3).map((h, i) => (
                                        <th key={i} className="px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wider border-b">
                                          {h}
                                        </th>
                                      ))}
                                      {msg.tableData.headers.length > 3 && (
                                        <th className="px-4 py-2 font-semibold text-muted-foreground uppercase tracking-wider border-b">...</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {msg.tableData.rows.slice(0, 3).map((row, i) => (
                                      <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                                        {row.slice(0, 3).map((cell, j) => (
                                          <td key={j} className="px-4 py-2.5 text-xs">
                                            {cell}
                                          </td>
                                        ))}
                                        {row.length > 3 && (
                                          <td className="px-4 py-2.5 text-xs text-muted-foreground italic">...</td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="p-2 border-t text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-[10px] h-6 text-blue-600 hover:text-blue-700"
                                    onClick={() => {
                                      setActiveResult(msg);
                                      setIsResultsOpen(true);
                                    }}
                                  >
                                    View Full Results & Analysis →
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground p-4">Query results will appear here.</p>
                            )}
                          </TabsContent>

                          <TabsContent value="sql" className="p-4 pt-3">
                            <pre className="text-xs font-mono bg-[#0f172a] dark:bg-black/50 text-emerald-400 rounded-lg p-4 overflow-x-auto leading-relaxed">
                              <code>{msg.sql}</code>
                            </pre>
                          </TabsContent>
                        </Tabs>
                      </motion.div>
                    )}

                    <p className="text-[10px] text-muted-foreground px-1">
                      {msg.timestamp}
                    </p>
                  </div>

                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-xs font-bold">JC</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 py-8">
                {databases.filter(db => db.is_default).length === 0 ? (
                  /* Case 1: No connected databases */
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md p-8 rounded-3xl bg-slate-900/40 border border-slate-800 shadow-2xl flex flex-col items-center"
                  >
                    <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-6 border border-indigo-500/20">
                      <Database className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">No Connected Databases</h3>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                      You need to connect and activate at least one database to start chatting with AI.
                    </p>
                    <Link href="/dashboard/databases">
                      <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center gap-2">
                        Connect Database <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </motion.div>
                ) : (
                  /* Case 2: Welcoming screen with active database selector hint */
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-2xl flex flex-col items-center"
                  >
                    <div className="h-16 w-16 rounded-[24px] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mb-6 shadow-xl shadow-indigo-500/10">
                      <Sparkles className="h-8 w-8" />
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-white mb-3">
                      Chat with Your Data
                    </h2>
                    <p className="text-sm text-slate-400 max-w-md mb-8 leading-relaxed">
                      Ask natural language questions to generate SQL queries and visualize your tables instantly.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
                      <div className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/80 hover:border-slate-700 transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 font-bold text-sm">1</div>
                        <h4 className="text-sm font-bold text-white mb-1">Select Database</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Choose an active connection from the dropdown in the header.
                        </p>
                      </div>
                      <div className="p-5 rounded-2xl bg-slate-900/30 border border-slate-800/80 hover:border-slate-700 transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-3 font-bold text-sm">2</div>
                        <h4 className="text-sm font-bold text-white mb-1">Ask Anything</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Type queries like "Show the top 5 products by revenue" or "Analyze active users".
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {isTyping && (
              <div className="flex items-start gap-3 animate-pulse">
                <Avatar className="h-10 w-10 rounded-2xl border-2 border-indigo-600/20">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-xs">
                    <Database className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-[var(--surface-1)] border border-slate-800 rounded-2xl rounded-tl-none px-5 py-4 shadow-2xl">
                  <div className="flex gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[var(--surface-0)] via-[var(--surface-0)] to-transparent z-10">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[28px] opacity-10 group-focus-within:opacity-30 blur-sm transition-opacity duration-500" />
              <div className="relative flex items-end bg-[var(--surface-1)] border border-slate-800 rounded-[24px] shadow-2xl transition-all duration-300 group-focus-within:border-indigo-500/50">
                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:text-indigo-500 m-2">
                  <Sparkles className="h-5 w-5" />
                </Button>
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your data..."
                  className="flex-1 min-h-[56px] max-h-48 resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none py-4 px-0 text-sm text-white placeholder:text-slate-600 font-medium"
                  rows={1}
                />
                <div className="flex items-center gap-2 p-2">
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:text-white rounded-xl">
                    <Paperclip className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    size="icon"
                    className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 text-white shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150 justify-center">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    className="px-4 py-1.5 rounded-full bg-[var(--surface-1)] border border-slate-800 text-[11px] font-bold text-slate-400 hover:border-indigo-500 hover:text-white hover:bg-indigo-600/10 transition-all duration-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-center text-slate-600 font-bold uppercase tracking-[0.2em]">
              InsightSQL can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>

      {/* Results View Panel (Right - Side-by-Side) */}
      <AnimatePresence>
        {isResultsOpen && activeResult && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: summaryWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-slate-900/50 bg-[var(--surface-0)] h-full overflow-hidden flex-shrink-0 flex flex-col relative z-20 shadow-2xl"
          >
            {/* Dynamic Drag Handle */}
            <div
              onMouseDown={startResizingSummary}
              className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/60 z-50 transition-all ${
                isResizingSummary ? "bg-indigo-650 w-[3px] border-l-2 border-indigo-400" : "bg-transparent hover:w-1.5"
              }`}
            />
            <div className="flex-1 overflow-auto p-8 space-y-10">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black tracking-tight text-white uppercase tracking-widest">Summary</h2>

                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-white">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-slate-500 hover:text-white bg-slate-900/30"
                    onClick={() => setIsResultsOpen(false)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Dynamic Results Display */}
              {!hasResults ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-6 pt-20">
                  <div className="h-24 w-24 rounded-full bg-slate-900/30 flex items-center justify-center border border-slate-800 shadow-inner">
                    <Database className="h-10 w-10 opacity-40 text-slate-400" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-black text-white">No Tabular Data</h3>
                    <p className="text-sm max-w-xs leading-relaxed">The selected response does not contain any structured database results to visualize.</p>
                  </div>
                </div>
              ) : useStatsCard ? (
                <Card className="bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-indigo-900/40 border border-indigo-500/20 shadow-2xl overflow-hidden rounded-[32px] relative group border-none">
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                  <CardContent className="p-8">
                    <div className="flex items-center gap-6 relative z-10">
                      <div className="h-16 w-16 rounded-[28px] bg-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20">
                        <Sparkles className="h-8 w-8 text-white" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-1 truncate" title={resultColumns[0]}>{resultColumns[0]}</p>
                        <div className="flex items-baseline gap-4">
                          <span className="text-5xl font-black tracking-tight text-white truncate max-w-full" title={String(resultsData[0][resultColumns[0]])}>
                            {String(resultsData[0][resultColumns[0]])}
                          </span>
                        </div>
                        <p className="text-sm text-indigo-200/60 mt-2 font-bold uppercase tracking-widest">Aggregated Result</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : useBullets ? (
                <Card className="p-8 bg-[var(--surface-1)] border-slate-900/50 shadow-2xl rounded-[28px] border-none">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800/50 pb-4">
                    {isObjectRow ? resultColumns[0] : "Items"} List
                  </h3>
                  <ul className="space-y-4 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                    {resultsData.map((row: any, i: number) => {
                      const val = isObjectRow ? row[resultColumns[0]] : row;
                      return (
                        <li key={i} className="flex items-center gap-4 text-sm text-slate-300 font-medium p-3 bg-slate-900/30 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors">
                          <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_var(--color-indigo-500)] flex-shrink-0" />
                          <span className="break-all">{String(val)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              ) : (
                <Card className="bg-[var(--surface-1)] border-slate-900/50 shadow-2xl rounded-[28px] overflow-hidden border-none flex flex-col h-full max-h-[80vh]">
                  <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800/50 flex-shrink-0">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Query Results</h3>
                    <Button variant="ghost" size="sm" className="h-8 text-[11px] font-black gap-2 px-4 text-slate-400 hover:text-white bg-[var(--surface-2)] border border-slate-800 rounded-xl">
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  <div className="overflow-x-auto flex-1 custom-scrollbar">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[var(--surface-1)] z-10 shadow-sm shadow-black/20">
                        <tr className="bg-slate-900/20 text-slate-500 uppercase tracking-[0.15em] text-[10px] font-black">
                          {resultColumns.map((col, i) => (
                            <th key={i} className="text-left px-8 py-5 whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {resultsData.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-white/5 transition-colors cursor-pointer group">
                            {resultColumns.map((col, j) => (
                              <td key={j} className="px-8 py-5 text-slate-300 font-medium whitespace-nowrap max-w-[300px] truncate" title={String(row[col])}>
                                {String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between px-8 py-6 border-t border-slate-800/50 flex-shrink-0 bg-slate-900/10">
                    <span className="text-[11px] text-slate-500 font-black uppercase tracking-wider">
                      Showing {resultsData.length} records
                    </span>
                  </div>
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Database Connection Warning Popup Modal */}
      <AnimatePresence>
        {showWarningModal && currentProject && disconnectedProjectDbs.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Blurry Backdrop Filter */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowWarningModal(false);
                setActiveConfigDb(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Dialog Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative bg-[var(--surface-1)] border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-8 z-55 flex flex-col max-h-[85vh] text-white"
            >
              {/* Close Button */}
              <button 
                onClick={() => {
                  setShowWarningModal(false);
                  setActiveConfigDb(null);
                }}
                className="absolute top-6 right-6 text-slate-500 hover:text-white bg-slate-900/30 hover:bg-slate-800/80 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              {activeConfigDb ? (
                // Database Configuration View
                <>
                  {/* Back button and title */}
                  <div className="mb-6 flex items-center gap-3">
                    <button 
                      onClick={() => setActiveConfigDb(null)}
                      className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                      <h3 className="text-xl font-bold text-white leading-tight">
                        Configure Database
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-medium">
                        Configure connection details for <span className="text-indigo-400 font-semibold">{displayName}</span>
                      </p>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-1 text-slate-350">
                    {/* Database Type Select */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-450 uppercase tracking-wider">Select Database Type</label>
                      <Select value={dbType} onValueChange={(val) => setDbType(val || "postgresql")}>
                        <SelectTrigger className="w-full bg-slate-900 border-slate-800 h-11 rounded-xl px-4 text-white hover:border-slate-700">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          {DB_TYPES.map(db => (
                            <SelectItem key={db.id} value={db.id} className="cursor-pointer hover:bg-slate-800">
                              {db.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Connection Method Toggle Tab */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-bold text-slate-455 uppercase tracking-wider">Connection Method</span>
                      <div className="flex gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setConnectionMethod('string')}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                            connectionMethod === 'string' 
                              ? 'bg-indigo-600 text-white' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          URI String
                        </button>
                        <button
                          type="button"
                          onClick={() => setConnectionMethod('params')}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                            connectionMethod === 'params' 
                              ? 'bg-indigo-600 text-white' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Form Parameters
                        </button>
                      </div>
                    </div>

                    {connectionMethod === 'params' ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        {/* Host */}
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Host</label>
                          <Input 
                            value={host}
                            onChange={(e) => setHost(e.target.value)}
                            placeholder="localhost"
                            className="bg-slate-900 border-slate-800 focus:border-indigo-500 h-10 rounded-xl text-xs text-white"
                          />
                        </div>
                        {/* Port */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Port</label>
                          <Input 
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                            placeholder={String(getDefaultPort(dbType))}
                            className="bg-slate-900 border-slate-800 focus:border-indigo-500 h-10 rounded-xl text-xs text-white"
                          />
                        </div>

                        {/* Database Name */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Database Name</label>
                          <Input 
                            value={databaseName}
                            onChange={(e) => setDatabaseName(e.target.value)}
                            placeholder="e.g., main_db"
                            className="bg-slate-900 border-slate-800 focus:border-indigo-500 h-10 rounded-xl text-xs text-white"
                          />
                        </div>
                        {/* Username */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Username</label>
                          <Input 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="postgres"
                            className="bg-slate-900 border-slate-800 focus:border-indigo-500 h-10 rounded-xl text-xs text-white"
                          />
                        </div>
                        {/* Password */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Password</label>
                          <Input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="bg-slate-900 border-slate-800 focus:border-indigo-500 h-10 rounded-xl text-xs text-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider">Connection String (URI)</label>
                        <Input 
                          value={connectionString}
                          onChange={(e) => setConnectionString(e.target.value)}
                          placeholder={`${dbType}://username:password@host:port/database`}
                          className="bg-slate-900 border-slate-800 focus:border-indigo-500 h-11 rounded-xl text-xs font-mono text-white"
                        />
                      </div>
                    )}

                    {testResult && (
                      <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                        testResult.status === 'success' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {testResult.status === 'success' ? <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" /> : <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />}
                        <p className="text-xs font-medium leading-relaxed">{testResult.message}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center gap-3 pt-6 mt-4 border-t border-slate-800/50">
                    <Button 
                      variant="ghost" 
                      onClick={() => setActiveConfigDb(null)}
                      className="w-1/3 text-slate-400 hover:text-white hover:bg-slate-805 h-11 rounded-xl font-bold cursor-pointer"
                    >
                      Back
                    </Button>
                    <Button 
                      onClick={handleTestConnection}
                      disabled={isTesting || isSaving || (connectionMethod === 'string' ? !connectionString : !databaseName)}
                      className="w-1/3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold h-11 rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test"
                      )}
                    </Button>
                    <Button 
                      onClick={handleSaveConnection}
                      disabled={isSaving || isTesting || !testResult || testResult.status !== 'success'}
                      className="w-1/3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-indigo-600/20 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-200"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save & Connect"
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                // Warning List View
                <>
                  {/* Title Header */}
                  <div className="mb-6 flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 border border-amber-500/20">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white leading-tight">
                        Database Connection Warning
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
                        Some databases in the project <span className="text-indigo-400 font-semibold">{currentProject.title}</span> are not connected.
                      </p>
                    </div>
                  </div>

                  {/* List of Databases */}
                  <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-1">
                    {/* Disconnected Databases */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disconnected Databases</label>
                      {disconnectedProjectDbs.map((db: any) => (
                        <div 
                          key={db.id}
                          className="flex items-center justify-between p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-slate-350"
                        >
                          <div className="flex items-center gap-3">
                            <Database className="h-4.5 w-4.5 text-rose-500 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white">{db.name}</span>
                              <span className="text-[10px] text-slate-500 font-bold mt-0.5">{db.type}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startConfigDb(db)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Configure Connection Details"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <Button
                              size="sm"
                              onClick={() => handleConnectDbInModal(db.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 px-3 rounded-lg text-xs cursor-pointer transition-all duration-200"
                            >
                              Connect
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Connected Databases */}
                    {connectedProjectDbs.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connected Databases</label>
                        {connectedProjectDbs.map((db: any) => (
                          <div 
                            key={db.id}
                            className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-slate-350"
                          >
                            <div className="flex items-center gap-3">
                              <Database className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-white">{db.name}</span>
                                <span className="text-[10px] text-slate-500 font-bold mt-0.5">{db.type}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startConfigDb(db)}
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                title="Configure Connection Details"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Connected
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-col gap-3 pt-6 mt-4 border-t border-slate-800/50">
                    <Button 
                      onClick={() => setShowWarningModal(false)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      {connectedProjectDbs.length > 0 
                        ? "Proceed with Connected Databases" 
                        : "Proceed Anyway"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        if (disconnectedProjectDbs.length > 0) {
                          startConfigDb(disconnectedProjectDbs[0]);
                        } else if (projectDbsInfo.length > 0) {
                          startConfigDb(projectDbsInfo[0]);
                        }
                      }}
                      className="w-full text-slate-400 hover:text-white hover:bg-slate-800 h-11 rounded-xl font-bold cursor-pointer"
                    >
                      Manage Databases
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
