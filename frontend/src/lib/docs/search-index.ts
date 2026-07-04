import { flattenNavItems } from "./navigation";

export interface SearchEntry {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
}

export const DOCS_SEARCH_INDEX: SearchEntry[] = [
  {
    slug: "introduction",
    title: "Overview",
    description: "What InsightSQL is and how natural language becomes SQL",
    keywords: ["overview", "what is", "product", "natural language", "analytics"],
  },
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Your first query in five minutes",
    keywords: ["start", "quickstart", "first query", "tutorial"],
  },
  {
    slug: "installation",
    title: "Installation",
    description: "Run InsightSQL locally with Docker or Node",
    keywords: ["install", "docker", "setup", "env", "backend", "frontend"],
  },
  {
    slug: "connecting-database",
    title: "Connecting a Database",
    description: "Add PostgreSQL, MongoDB, Snowflake, and more",
    keywords: ["connection", "postgres", "mysql", "mongodb", "snowflake", "credentials"],
  },
  {
    slug: "authentication",
    title: "Authentication",
    description: "Users, JWT sessions, and workspaces",
    keywords: ["login", "signup", "jwt", "session", "auth", "security"],
  },
  {
    slug: "asking-questions",
    title: "Asking Questions",
    description: "Natural language chat interface",
    keywords: ["chat", "prompt", "question", "ask", "natural language"],
  },
  {
    slug: "ai-sql-generation",
    title: "AI SQL Generation",
    description: "How the LLM builds and heals queries",
    keywords: ["sql", "llm", "groq", "gemini", "deepseek", "generation", "agent"],
  },
  {
    slug: "visualizations",
    title: "Visualizations",
    description: "Charts and auto-detected graph types",
    keywords: ["chart", "bar", "pie", "line", "graph", "recharts"],
  },
  {
    slug: "dashboards",
    title: "Dashboards",
    description: "Auto-generated analytics widgets",
    keywords: ["dashboard", "widgets", "kpi", "metrics"],
  },
  {
    slug: "exporting-data",
    title: "Exporting Data",
    description: "CSV, Excel, PNG, and sharing",
    keywords: ["export", "csv", "excel", "png", "download"],
  },
  {
    slug: "api",
    title: "API",
    description: "REST endpoints and streaming",
    keywords: ["api", "rest", "endpoint", "ask", "stream"],
  },
  {
    slug: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    description: "Power-user shortcuts",
    keywords: ["keyboard", "shortcut", "hotkey", "cmd", "ctrl"],
  },
  {
    slug: "faq",
    title: "FAQ",
    description: "Common questions answered",
    keywords: ["faq", "questions", "pricing", "limits"],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Fix connection and LLM issues",
    keywords: ["error", "fix", "429", "connection failed", "debug"],
  },
  {
    slug: "release-notes",
    title: "Release Notes",
    description: "What's new in InsightSQL",
    keywords: ["changelog", "release", "version", "new"],
  },
];

export function searchDocs(query: string): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return flattenNavItems().map((item) => {
    const entry = DOCS_SEARCH_INDEX.find((e) => e.slug === item.slug);
    return {
      slug: item.slug,
      title: item.title,
      description: entry?.description ?? item.description ?? "",
      keywords: entry?.keywords ?? [],
    };
  });
  return DOCS_SEARCH_INDEX.filter((entry) => {
    const haystack = [entry.title, entry.description, ...entry.keywords].join(" ").toLowerCase();
    return q.split(/\s+/).every((term) => haystack.includes(term));
  });
}

export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(re, "<mark>$1</mark>");
}
