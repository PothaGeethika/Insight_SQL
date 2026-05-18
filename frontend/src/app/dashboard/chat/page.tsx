"use client";

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
} from "lucide-react";
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
  const [model, setModel] = useState<string>("gemini-1.5-pro");
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [history, setHistory] = useState<{ id: string; title: string; active: boolean; messages: Message[]; isFavorite?: boolean }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [activeResult, setActiveResult] = useState<any>(null);
  const [resultsTab, setResultsTab] = useState("results");

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

    try {
      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: finalValue,
          provider: provider,
          model: model,
          connection_id: selectedDb
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
      updatedUserMsg.versions![currentIdx].response = {
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

  const toggleFavoriteMessage = (msg: Message) => {
    const savedFavs = localStorage.getItem("favorite_queries");
    let favs = savedFavs ? JSON.parse(savedFavs) : [];

    const isAlreadyFav = favs.some((f: any) => f.id === msg.id);

    if (isAlreadyFav) {
      favs = favs.filter((f: any) => f.id !== msg.id);
    } else {
      const userIdx = messages.findIndex(m => m.id === msg.id);
      const assistantMsg = messages[userIdx + 1];

      favs.push({
        id: msg.id,
        question: msg.content,
        answer: assistantMsg?.content || "",
        sql: assistantMsg?.sql || "",
        tableData: assistantMsg?.tableData || null,
        timestamp: msg.timestamp,
        sessionId: currentSessionId
      });
    }

    localStorage.setItem("favorite_queries", JSON.stringify(favs));
    setMessages([...messages]);
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
        if (data.length > 0) {
          const defaultDb = data.find((db: any) => db.is_default) || data[0];
          setSelectedDb(defaultDb.id);
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
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
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
    if (!selectedDb) {
      const warningMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Please select a database from the header before asking a question.",
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
          connection_id: selectedDb
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

  return (
    <div className="h-full flex overflow-hidden">
      <AnimatePresence mode="wait">
        {isHistoryOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="hidden xl:flex w-64 border-r flex-col bg-muted/20 overflow-hidden h-full"
          >
            <div className="p-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">History</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsHistoryOpen(false)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Separator />
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-0.5">
                {history.map((chat) => (
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

        <div className="h-14 border-b flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {!isHistoryOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsHistoryOpen(true)}>
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            )}
            <h2 className="font-semibold text-sm">Chat</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="provider-select" className="text-xs text-muted-foreground">
                AI Provider:
              </Label>
              <Select value={provider} onValueChange={(val) => {
                setProvider(val);
                if (val === "gemini") setModel("gemini-1.5-pro");
                else if (val === "openai") setModel("gpt-4o");
                else if (val === "anthropic") setModel("claude-3-5-sonnet");
                else if (val === "deepseek") setModel("deepseek-v3");
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
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
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
                      <SelectItem value="deepseek-v3">DeepSeek V3</SelectItem>
                      <SelectItem value="deepseek-r1">DeepSeek R1</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="db-select" className="text-xs text-muted-foreground">
                Database:
              </Label>
              <Select value={selectedDb} onValueChange={setSelectedDb}>
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue placeholder="Select Database">
                    {databases.find(db => db.id === selectedDb)?.name || "Select Database"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {databases.map((db) => (
                    <SelectItem key={db.id} value={db.id}>
                      {db.type === 'postgresql' ? '🐘' : db.type === 'mysql' ? '🐬' : '🪶'} {db.name}
                    </SelectItem>
                  ))}
                  {databases.length === 0 && (
                    <SelectItem value="none" disabled>No databases connected</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Label htmlFor="show-sql" className="text-xs text-muted-foreground">
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
                          className={`p-1 hover:bg-muted rounded transition-colors ${(() => {
                              const favs = JSON.parse(localStorage.getItem("favorite_queries") || "[]");
                              return favs.some((f: any) => f.id === msg.id);
                            })()
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-muted-foreground hover:text-amber-500"
                            }`}
                          title={(() => {
                            const favs = JSON.parse(localStorage.getItem("favorite_queries") || "[]");
                            return favs.some((f: any) => f.id === msg.id);
                          })() ? "Remove from Favorite Queries" : "Save as Favorite Query"}
                        >
                          <Star className={`h-3.5 w-3.5 ${(() => {
                              const favs = JSON.parse(localStorage.getItem("favorite_queries") || "[]");
                              return favs.some((f: any) => f.id === msg.id);
                            })() ? "fill-current" : ""
                            }`} />
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
            animate={{ width: "45%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-slate-900/50 bg-[var(--surface-0)] h-full overflow-hidden flex-shrink-0 flex flex-col relative z-20 shadow-2xl"
          >
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

              {/* Main Summary Card (Gradient Style) */}
              <Card className="bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-indigo-900/40 border border-indigo-500/20 shadow-2xl overflow-hidden rounded-[32px] relative group border-none">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
                <CardContent className="p-8">
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="h-16 w-16 rounded-[28px] bg-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20">
                      <ShoppingCart className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-indigo-300 uppercase tracking-widest mb-1">You received</p>
                      <div className="flex items-baseline gap-4">
                        <span className="text-5xl font-black tracking-tight text-white">250</span>
                        <div className="flex flex-col">
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[11px] px-2 py-0.5 font-black rounded-lg">
                            <ArrowUpRight className="h-3 w-3 mr-1" /> 12.5%
                          </Badge>
                          <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">vs last week</span>
                        </div>
                      </div>
                      <p className="text-sm text-indigo-200/60 mt-2 font-bold uppercase tracking-widest">orders this week</p>
                    </div>
                  </div>
                  {/* Decorative chart line placeholder */}
                  <div className="absolute bottom-0 right-0 w-1/2 h-full opacity-30 pointer-events-none overflow-hidden">
                    <svg viewBox="0 0 100 100" className="w-full h-full stroke-indigo-400 stroke-[0.5] fill-none translate-y-10">
                      <path d="M0,80 Q25,20 50,70 T100,30" strokeLinecap="round" />
                    </svg>
                  </div>
                </CardContent>
              </Card>

              {/* Visualization Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="p-6 bg-[var(--surface-1)] border-slate-900/50 shadow-2xl rounded-[28px] flex flex-col border-none">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-black uppercase tracking-[0.15em] text-white">Orders Over Time</h3>
                    <Select defaultValue="week">
                      <SelectTrigger className="h-7 w-24 text-[10px] bg-[var(--surface-2)] border-slate-800 rounded-lg font-bold uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--surface-2)] border-slate-800 text-white">
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="h-44 flex items-end justify-between gap-3 px-2">
                    {[35, 60, 45, 90, 65, 55, 40].map((h, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full group">
                        <div className="flex-1 w-full bg-slate-900/30 rounded-full relative overflow-hidden h-full border border-white/5 transition-all group-hover:border-indigo-500/30">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            className="absolute bottom-0 w-full bg-gradient-to-t from-indigo-600 via-indigo-500 to-purple-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i].substring(0, 3)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-6 bg-[var(--surface-1)] border-slate-900/50 shadow-2xl rounded-[28px] flex flex-col border-none">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xs font-black uppercase tracking-[0.15em] text-white">Orders by Status</h3>
                    <MoreHorizontal className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6">
                    <div className="relative w-36 h-36 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface-2)" strokeWidth="14" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#f87171" strokeWidth="14" strokeDasharray="40 251.2" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="14" strokeDasharray="160 251.2" strokeDashoffset="-40" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="14" strokeDasharray="50 251.2" strokeDashoffset="-200" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#facc15" strokeWidth="14" strokeDasharray="30 251.2" strokeDashoffset="-250" strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-xl font-black text-white leading-none">250</span>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Total</span>
                      </div>
                    </div>
                    {/* Compact Legend */}
                    <div className="space-y-2.5">
                      {[
                        { label: "Completed", color: "bg-emerald-500", val: "160 (64%)" },
                        { label: "Processing", color: "bg-blue-500", val: "50 (20%)" },
                        { label: "Pending", color: "bg-amber-400", val: "30 (12%)" },
                        { label: "Cancelled", color: "bg-rose-500", val: "10 (4%)" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${item.color} shadow-[0_0_8px_currentColor]`} />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white leading-none tracking-tight">{item.label}</span>
                            <span className="text-[8px] font-bold text-slate-500 mt-0.5">{item.val}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Enhanced Orders Table */}
              <Card className="bg-[var(--surface-1)] border-slate-900/50 shadow-2xl rounded-[28px] overflow-hidden border-none">
                <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800/50">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Orders</h3>
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-black gap-2 px-4 text-slate-400 hover:text-white bg-[var(--surface-2)] border border-slate-800 rounded-xl">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-900/20 text-slate-500 uppercase tracking-[0.15em] text-[10px] font-black">
                        <th className="text-left px-8 py-5">Order ID</th>
                        <th className="text-left px-8 py-5">Customer</th>
                        <th className="text-left px-8 py-5">Status</th>
                        <th className="text-left px-8 py-5">Total Amount</th>
                        <th className="text-left px-8 py-5 whitespace-nowrap">Created At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {[
                        { id: "#ORD-10250", name: "Alice Johnson", status: "Completed", amount: "$125.00", date: "May 18, 2025 09:15 AM", color: "text-emerald-400 bg-emerald-500/10" },
                        { id: "#ORD-10249", name: "Bob Smith", status: "Processing", amount: "$89.99", date: "May 18, 2025 08:47 AM", color: "text-blue-400 bg-blue-500/10" },
                        { id: "#ORD-10248", name: "Carol Williams", status: "Completed", amount: "$210.00", date: "May 18, 2025 08:31 AM", color: "text-emerald-400 bg-emerald-500/10" },
                        { id: "#ORD-10247", name: "David Brown", status: "Pending", amount: "$75.50", date: "May 18, 2025 07:58 AM", color: "text-amber-400 bg-amber-500/10" },
                        { id: "#ORD-10246", name: "Eva Davis", status: "Cancelled", amount: "$49.99", date: "May 18, 2025 07:22 AM", color: "text-rose-400 bg-rose-500/10" },
                      ].map((row, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors cursor-pointer group">
                          <td className="px-8 py-5 text-white font-bold tracking-tight">{row.id}</td>
                          <td className="px-8 py-5 text-slate-300 font-medium">{row.name}</td>
                          <td className="px-8 py-5">
                            <Badge className={`border-none font-black text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-lg ${row.color}`}>
                              {row.status}
                            </Badge>
                          </td>
                          <td className="px-8 py-5 text-white font-black">{row.amount}</td>
                          <td className="px-8 py-5 text-slate-500 font-bold tabular-nums">{row.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between px-8 py-6 border-t border-slate-800/50">
                  <span className="text-[11px] text-slate-500 font-black uppercase tracking-wider">Showing 1 to 7 of 250 orders</span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-white bg-[var(--surface-2)] rounded-lg">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 mx-2">
                      <Button size="sm" className="h-8 w-8 bg-indigo-600 text-white font-black text-xs rounded-lg">1</Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 text-slate-500 hover:text-white font-black text-xs">2</Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 text-slate-500 hover:text-white font-black text-xs">3</Button>
                      <span className="text-slate-700 px-1">...</span>
                      <Button variant="ghost" size="sm" className="h-8 w-8 text-slate-500 hover:text-white font-black text-xs">36</Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-white bg-[var(--surface-2)] rounded-lg">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
