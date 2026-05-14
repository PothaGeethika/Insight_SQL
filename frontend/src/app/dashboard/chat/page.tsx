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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const [provider, setProvider] = useState<string>("gemini");
  const [model, setModel] = useState<string>("gemini-1.5-pro");
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>("");
  const [history, setHistory] = useState<{ id: string; title: string; active: boolean; messages: Message[]; isFavorite?: boolean }[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSuggestions = () => {
    const db = databases.find(d => d.id === selectedDb);
    if (!db) return dbSuggestions.default;
    return dbSuggestions[db.name.toLowerCase()] || dbSuggestions[db.type] || dbSuggestions.default;
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

  // Load from localStorage on mount
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
          }
        }
      } catch (e) {
        console.error("Error parsing saved history", e);
      }
    }
  }, []);

  // Save to localStorage whenever history or currentSessionId changes
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
    setHistory(prev => prev.map(h => ({ ...h, active: false })));
  };

  const loadSession = (sessionId: string) => {
    const session = history.find(s => s.id === sessionId);
    if (session) {
      setMessages(session.messages || []);
      setCurrentSessionId(sessionId);
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
    }
  };

  const toggleFavoriteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    const newHistory = history.map(h => 
      h.id === sessionId ? { ...h, isFavorite: !h.isFavorite } : h
    );
    setHistory(newHistory);
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

    // Update history/sessions
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

    // Call real backend
    try {
      const response = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          question: input,
          provider: provider,
          connection_id: selectedDb
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to get response from backend");
      }

      setMessages((prev) => {
        const updated = [...prev, data];
        // Sync with history
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
      {/* Chat History Sidebar */}
      <AnimatePresence mode="wait">
        {isHistoryOpen && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="hidden xl:flex w-64 border-r flex-col bg-muted/20 overflow-hidden"
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
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-0.5">
            {history.map((chat) => (
              <div
                key={chat.id}
                className="group relative"
              >
                <button
                  onClick={() => loadSession(chat.id)}
                  className={`w-full text-left px-3 py-2.5 pr-8 rounded-lg text-sm transition-colors truncate ${
                    chat.active ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {chat.title}
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
                      <MoreVertical className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={(e) => toggleFavoriteSession(e, chat.id)}>
                        <Star className={`h-4 w-4 mr-2 ${chat.isFavorite ? "fill-amber-500 text-amber-500" : ""}`} />
                        {chat.isFavorite ? "Favorited" : "Favorite"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={(e) => deleteSession(e, chat.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
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
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">✨ Gemini</SelectItem>
                  <SelectItem value="openai">🤖 OpenAI</SelectItem>
                  <SelectItem value="anthropic">🧠 Anthropic</SelectItem>
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

        {/* Messages */}
        <ScrollArea className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20 mt-1">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div className={`max-w-[80%] space-y-3 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    {/* Message bubble */}
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-md ml-auto shadow-md shadow-blue-500/10"
                          : "bg-muted rounded-tl-md"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>

                    {/* SQL block */}
                    {msg.sql && showSQL && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="rounded-xl overflow-hidden border bg-card"
                      >
                        <Tabs defaultValue="results" className="w-full">
                          <div className="flex items-center justify-between px-4 pt-3">
                            <TabsList className="h-8 bg-muted/50">
                              <TabsTrigger value="results" className="text-xs h-7 px-3">
                                Results
                              </TabsTrigger>
                              <TabsTrigger value="sql" className="text-xs h-7 px-3">
                                <Code className="h-3 w-3 mr-1" />
                                SQL
                              </TabsTrigger>
                            </TabsList>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleCopy(msg.sql!, msg.id + "-sql")}
                            >
                              {copiedId === msg.id + "-sql" ? (
                                <Check className="h-3 w-3 mr-1 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3 mr-1" />
                              )}
                              {copiedId === msg.id + "-sql" ? "Copied!" : "Copy"}
                            </Button>
                          </div>

                          <TabsContent value="results" className="p-4 pt-3">
                            {msg.tableData ? (
                              <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50">
                                      {msg.tableData.headers.map((h) => (
                                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                                          {h}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {msg.tableData.rows.map((row, i) => (
                                      <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                                        {row.map((cell, j) => (
                                          <td key={j} className="px-4 py-2.5 text-xs">
                                            {cell}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Query results will appear here.</p>
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

            {/* Typing indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-blue-500 typing-dot" />
                    <div className="h-2 w-2 rounded-full bg-blue-500 typing-dot" />
                    <div className="h-2 w-2 rounded-full bg-blue-500 typing-dot" />
                    <span className="text-xs text-muted-foreground ml-2">AI is thinking…</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Suggested queries */}
        <div className="px-6 pb-2">
          <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap">
            {getSuggestions().map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="text-xs px-3 py-1.5 rounded-full border hover:bg-accent hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center gap-1 text-muted-foreground"
              >
                {q}
                <ArrowRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-muted/30 rounded-xl border p-2 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-300 dark:focus-within:border-blue-700 transition-all">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={onFileChange}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleAttachFile}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question or write SQL..."
                className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none p-2 text-sm"
                rows={1}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={handleGenerate}
                  title="Generate/Optimize query"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  size="icon"
                  className="h-9 w-9 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md shadow-blue-500/20 rounded-lg disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-center text-muted-foreground mt-2">
              InsightSQL can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
