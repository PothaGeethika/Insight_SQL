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
} from "lucide-react";
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

const initialMessages: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Show me the top 10 customers by total revenue for this month.",
    timestamp: "10:43 AM",
  },
  {
    id: "2",
    role: "assistant",
    content: "Here are the top 10 customers by total revenue for this month.",
    timestamp: "10:43 AM",
    sql: `SELECT
  c.id,
  c.name,
  SUM(o.total_amount) AS total_revenue
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month',
  CURRENT_DATE)
GROUP BY c.id, c.name
ORDER BY total_revenue DESC
LIMIT 10;`,
    tableData: {
      headers: ["#", "Customer", "Revenue"],
      rows: [
        ["1", "Acme Corp", "$42,850"],
        ["2", "TechVista Inc", "$38,920"],
        ["3", "GlobalDyne", "$35,100"],
        ["4", "NovaStar Labs", "$28,750"],
        ["5", "Pinnacle Group", "$24,300"],
      ],
    },
  },
];

const suggestedQueries = [
  "Top products by sales",
  "Users who signed up last week",
  "Revenue trend by month",
];

const chatHistory = [
  { id: "1", title: "How many orders did we rec...", active: false },
  { id: "2", title: "Top 5 customers by revenue", active: false },
  { id: "3", title: "Monthly sales trend", active: false },
  { id: "4", title: "Products with low stock", active: false },
  { id: "5", title: "Active users this month", active: false },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSQL, setShowSQL] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Based on your query, I found the relevant data. Here's a summary of the results from your connected PostgreSQL database.`,
        sql: `SELECT * FROM analytics\nWHERE created_at >= NOW() - INTERVAL '7 days'\nORDER BY created_at DESC\nLIMIT 20;`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 2000);
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
    <div className="h-full flex">
      {/* Chat History Sidebar */}
      <div className="hidden xl:flex w-64 border-r flex-col bg-muted/20">
        <div className="p-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">History</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-0.5">
            {chatHistory.map((chat) => (
              <button
                key={chat.id}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors truncate"
              >
                {chat.title}
              </button>
            ))}
          </div>
          <button className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2">
            View all chats →
          </button>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="h-14 border-b flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm">Chat</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Label htmlFor="db-select" className="text-xs text-muted-foreground">
                Database:
              </Label>
              <Select defaultValue="postgres-prod">
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postgres-prod">🐘 PostgreSQL – Production</SelectItem>
                  <SelectItem value="mysql-sales">🐬 MySQL – Sales</SelectItem>
                  <SelectItem value="mongo-nosql">🍃 MongoDB – NoSQL</SelectItem>
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
            {suggestedQueries.map((q) => (
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
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0 text-muted-foreground hover:text-foreground"
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
