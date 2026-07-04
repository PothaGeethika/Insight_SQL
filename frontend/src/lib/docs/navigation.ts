export interface DocNavItem {
  title: string;
  slug: string;
  description?: string;
  children?: DocNavItem[];
}

export interface DocNavSection {
  title: string;
  items: DocNavItem[];
}

export const DOCS_NAV: DocNavSection[] = [
  {
    title: "Introduction",
    items: [
      { title: "Overview", slug: "introduction", description: "What InsightSQL is and how it works" },
      { title: "Getting Started", slug: "getting-started", description: "Your first query in five minutes" },
    ],
  },
  {
    title: "Setup",
    items: [
      { title: "Installation", slug: "installation", description: "Run InsightSQL locally or with Docker" },
      { title: "Connecting a Database", slug: "connecting-database", description: "Add PostgreSQL, MongoDB, Snowflake, and more" },
      { title: "Authentication", slug: "authentication", description: "Users, JWT sessions, and workspaces" },
    ],
  },
  {
    title: "Core Workflow",
    items: [
      { title: "Asking Questions", slug: "asking-questions", description: "Natural language chat interface" },
      { title: "AI SQL Generation", slug: "ai-sql-generation", description: "How the LLM builds and heals queries" },
      { title: "Visualizations", slug: "visualizations", description: "Charts and auto-detected graph types" },
      { title: "Dashboards", slug: "dashboards", description: "Auto-generated analytics widgets" },
      { title: "Exporting Data", slug: "exporting-data", description: "CSV, Excel, PNG, and sharing" },
    ],
  },
  {
    title: "Reference",
    items: [
      { title: "API", slug: "api", description: "REST endpoints and streaming" },
      { title: "Keyboard Shortcuts", slug: "keyboard-shortcuts", description: "Power-user shortcuts" },
      { title: "FAQ", slug: "faq", description: "Common questions answered" },
      { title: "Troubleshooting", slug: "troubleshooting", description: "Fix connection and LLM issues" },
      { title: "Release Notes", slug: "release-notes", description: "What's new in InsightSQL" },
    ],
  },
];

export function flattenNavItems(): DocNavItem[] {
  return DOCS_NAV.flatMap((section) => section.items);
}

export function getDocBySlug(slug: string): DocNavItem | undefined {
  return flattenNavItems().find((item) => item.slug === slug);
}

export function getAllSlugs(): string[] {
  return flattenNavItems().map((item) => item.slug);
}
