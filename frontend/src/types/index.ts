// ── Database connections ──────────────────────────────────────────────────────

export interface DatabaseConnection {
  id: string;
  name: string;
  type: "postgresql" | "mysql" | "mongodb" | "snowflake" | "elasticsearch" | "neo4j" | "sqlite" | string;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  is_default: boolean;
  user_id?: string;
  // Snowflake
  account?: string;
  warehouse?: string;
  schema_name?: string;
  role?: string;
  // Elasticsearch
  api_key?: string;
  cloud_id?: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface MessageVersion {
  content: string;
  sql?: string;
  generated_query?: string;
  query_type?: string;
  tableData?: TableData;
  timestamp: string;
  response?: {
    content: string;
    sql?: string;
    generated_query?: string;
    query_type?: string;
    tableData?: TableData;
    timestamp: string;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  mql?: string;
  generated_query?: string;
  query_type?: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "video";
  timestamp: string;
  tableData?: TableData;
  results?: Array<{
    connection_id?: string;
    database?: string;
    headers: string[];
    rows: any[][];
    query?: string;
    dialect?: string;
  }>;
  visualization?: string | null;
  versions?: MessageVersion[];
  currentVersionIndex?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  active: boolean;
  messages: ChatMessage[];
  isFavorite?: boolean;
  updatedAt?: number;
}

// ── Saved queries ─────────────────────────────────────────────────────────────

export interface SavedQuery {
  id: string;
  question: string;
  answer?: string;
  sql?: string;
  tableData?: TableData;
  database?: string;
  timestamp: string | number;
  sessionId?: string;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  description?: string;
  databases: Array<{ id: string; name: string }>;
  isFavorite?: boolean;
  created_at?: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  name: string;
  email: string;
}
