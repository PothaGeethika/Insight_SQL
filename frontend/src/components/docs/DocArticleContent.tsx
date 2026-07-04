"use client";

import Link from "next/link";
import {
  Callout, CodeBlock, DocHeading, DocImage, DocParagraph, DocsAccordion, DocsReveal, DocsTabs,
  InfoBox, Step, Terminal, Tip, Timeline, Warning,
} from "@/components/docs/primitives";
import { DocsTOC, type TocItem } from "@/components/docs/DocsTOC";
import {
  ChartReveal, DashboardMock, FlowDiagram, SqlReveal, TypingDemo,
} from "@/components/docs/walkthrough";

export interface DocArticleMeta {
  title: string;
  description: string;
  toc: TocItem[];
}

function ArticleLayout({ toc, children }: { toc: TocItem[]; children: React.ReactNode }) {
  return (
    <div className="flex gap-12">
      <article className="min-w-0 flex-1 max-w-3xl">{children}</article>
      <DocsTOC items={toc} />
    </div>
  );
}

function DocHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-10 border-b border-white/5 pb-8">
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-slate-400">{description}</p>
    </header>
  );
}

const ARTICLES: Record<string, { meta: DocArticleMeta; body: React.ReactNode }> = {
  introduction: {
    meta: {
      title: "Overview",
      description: "InsightSQL turns natural language into SQL, executes it against your databases, and returns tables and charts — securely and at scale.",
      toc: [
        { id: "what-is", title: "What is InsightSQL?" },
        { id: "how-it-works", title: "How it works" },
        { id: "architecture", title: "Architecture" },
        { id: "who-its-for", title: "Who it's for" },
      ],
    },
    body: (
      <>
        <DocHeader title="Overview" description="InsightSQL turns natural language into SQL, executes it against your databases, and returns tables and charts — securely and at scale." />
        <FlowDiagram />
        <DocHeading id="what-is">What is InsightSQL?</DocHeading>
        <DocParagraph>
          InsightSQL is an AI-native analytics workspace. Connect PostgreSQL, MongoDB, Snowflake, or any supported engine,
          then ask questions in plain English. The platform introspects your schema, generates dialect-correct SQL,
          runs it through a read-only execution layer, and streams back results with auto-selected visualizations.
        </DocParagraph>
        <DocImage src="/docs/ai-flow.svg" alt="InsightSQL AI workflow" caption="From question to chart in a single conversation." />
        <DocHeading id="how-it-works">How it works</DocHeading>
        <Step number={1} title="Connect your database">
          Add a connection string or credentials. InsightSQL encrypts secrets at rest and never logs raw passwords.
        </Step>
        <Step number={2} title="Ask a question">
          Type what you want to know — revenue by region, churn cohorts, inventory levels. No SQL required.
        </Step>
        <Step number={3} title="Review and explore">
          Inspect the generated SQL, refine with follow-ups, export results, or pin charts to a dashboard.
        </Step>
        <DocHeading id="architecture">Architecture</DocHeading>
        <DocParagraph>
          The stack is a Next.js App Router frontend proxied to a FastAPI backend. LLM agents synthesize prompts from live
          schema metadata, with multi-provider fallback (Groq, Gemini, DeepSeek). Query execution flows through a connection
          manager with per-user isolation and rate limiting.
        </DocParagraph>
        <DocImage src="/docs/architecture.svg" alt="InsightSQL architecture diagram" caption="Frontend, API layer, LLM agents, and database connectors." />
        <Callout title="Security by default">
          Queries run with read-only enforcement where configured. JWT sessions gate the API. Credentials are encrypted and scoped per workspace.
        </Callout>
        <DocHeading id="who-its-for">Who it&apos;s for</DocHeading>
        <DocParagraph>
          Product managers validating hypotheses, ops teams monitoring KPIs, analysts accelerating ad-hoc exploration,
          and engineers debugging production data — without switching between BI tools and SQL clients.
        </DocParagraph>
      </>
    ),
  },

  "getting-started": {
    meta: {
      title: "Getting Started",
      description: "Go from zero to your first chart in about five minutes.",
      toc: [
        { id: "prerequisites", title: "Prerequisites" },
        { id: "create-account", title: "Create an account" },
        { id: "first-connection", title: "First connection" },
        { id: "first-query", title: "Your first query" },
      ],
    },
    body: (
      <>
        <DocHeader title="Getting Started" description="Go from zero to your first chart in about five minutes." />
        <DocHeading id="prerequisites">Prerequisites</DocHeading>
        <DocParagraph>
          You need a running InsightSQL instance (local or hosted), a database you can connect to, and an API key for at least one LLM provider configured in your environment.
        </DocParagraph>
        <DocHeading id="create-account">Create an account</DocHeading>
        <Step number={1} title="Sign up">
          Visit <Link href="/signup" className="text-indigo-400 hover:underline">/signup</Link> and create your workspace. You&apos;ll land on the dashboard after email verification.
        </Step>
        <Step number={2} title="Open Chat">
          From the sidebar, select <strong className="text-white">Chat</strong> to open the natural language query interface.
        </Step>
        <DocHeading id="first-connection">First connection</DocHeading>
        <DocParagraph>
          Navigate to <strong className="text-white">Connections</strong> and click <strong className="text-white">Add database</strong>.
          Choose your engine, paste a connection URI, and test the connection. Schema metadata syncs automatically.
        </DocParagraph>
        <DocImage src="/docs/database-connect.svg" alt="Database connection screen" caption="Add PostgreSQL, MySQL, MongoDB, and more from one panel." />
        <DocHeading id="first-query">Your first query</DocHeading>
        <TypingDemo />
        <Tip>Start with aggregations — &ldquo;top 10 products by revenue&rdquo; — so the AI has clear columns to chart.</Tip>
        <SqlReveal />
        <ChartReveal />
      </>
    ),
  },

  installation: {
    meta: {
      title: "Installation",
      description: "Run InsightSQL locally with Docker or from source.",
      toc: [
        { id: "requirements", title: "Requirements" },
        { id: "clone", title: "Clone the repository" },
        { id: "env", title: "Environment variables" },
        { id: "run", title: "Start services" },
      ],
    },
    body: (
      <>
        <DocHeader title="Installation" description="Run InsightSQL locally with Docker or from source." />
        <DocHeading id="requirements">Requirements</DocHeading>
        <DocParagraph>Node.js 20+, Python 3.11+, and a supported LLM API key (Groq, Gemini, or DeepSeek).</DocParagraph>
        <DocHeading id="clone">Clone the repository</DocHeading>
        <Terminal lines={["$ git clone https://github.com/your-org/insightsql.git", "$ cd insightsql"]} />
        <DocHeading id="env">Environment variables</DocHeading>
        <DocParagraph>
          Copy <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-indigo-300">backend/.env.example</code> to{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-indigo-300">backend/.env</code> and{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-indigo-300">frontend/.env.local</code> for the Next.js app.
          All runtime config is loaded from environment — no hardcoded secrets.
        </DocParagraph>
        <CodeBlock
          language="env"
          code={`# backend/.env
LLM_PROVIDER=groq
GROQ_API_KEY=your_key
GROQ_MODEL=llama-3.3-70b-versatile
JWT_SECRET=your_secret

# frontend/.env.local
BACKEND_URL=http://localhost:8000
JWT_SECRET=your_secret`}
        />
        <Warning>Never commit <code className="text-amber-200">.env</code> files. Use your secrets manager in production.</Warning>
        <DocHeading id="run">Start services</DocHeading>
        <DocsTabs
          items={[
            {
              value: "local",
              label: "Local dev",
              content: (
                <Terminal
                  lines={[
                    "$ cd backend && pip install -r requirements.txt",
                    "$ uvicorn main:app --reload --port 8000",
                    "$ cd frontend && npm install && npm run dev",
                  ]}
                />
              ),
            },
            {
              value: "docker",
              label: "Docker",
              content: <Terminal lines={["$ docker compose up --build"]} />,
            },
          ]}
        />
      </>
    ),
  },

  "connecting-database": {
    meta: {
      title: "Connecting a Database",
      description: "Add and manage data sources across SQL and NoSQL engines.",
      toc: [
        { id: "supported", title: "Supported databases" },
        { id: "add-connection", title: "Add a connection" },
        { id: "schema-sync", title: "Schema sync" },
        { id: "security", title: "Security" },
      ],
    },
    body: (
      <>
        <DocHeader title="Connecting a Database" description="Add and manage data sources across SQL and NoSQL engines." />
        <FlowDiagram />
        <DocHeading id="supported">Supported databases</DocHeading>
        <DocParagraph>
          PostgreSQL, MySQL, MariaDB, SQLite, Microsoft SQL Server, Oracle, Snowflake, BigQuery, Redshift,
          MongoDB, Elasticsearch, Neo4j, Cassandra, and more via the unified connection manager.
        </DocParagraph>
        <DocImage src="/docs/database-connect.svg" alt="Database connectors" caption="Replace with your connection settings screenshot." />
        <DocHeading id="add-connection">Add a connection</DocHeading>
        <Step number={1} title="Open Connections">From the dashboard sidebar, click Connections → Add database.</Step>
        <Step number={2} title="Select engine">Pick your database type. URI templates adapt to each dialect.</Step>
        <Step number={3} title="Test and save">Run a connectivity test. On success, schema introspection begins in the background.</Step>
        <DocHeading id="schema-sync">Schema sync</DocHeading>
        <DocParagraph>
          Table names, column types, and relationships are cached and sent to the LLM as context. Re-sync after migrations
          from the connection detail page.
        </DocParagraph>
        <DocHeading id="security">Security</DocHeading>
        <InfoBox>
          Use read-only database users in production. Connection strings are encrypted at rest and scoped to your workspace.
        </InfoBox>
      </>
    ),
  },

  authentication: {
    meta: {
      title: "Authentication",
      description: "JWT sessions, workspaces, and secure API access.",
      toc: [
        { id: "sessions", title: "Sessions" },
        { id: "workspaces", title: "Workspaces" },
        { id: "api-auth", title: "API authentication" },
      ],
    },
    body: (
      <>
        <DocHeader title="Authentication" description="JWT sessions, workspaces, and secure API access." />
        <DocHeading id="sessions">Sessions</DocHeading>
        <DocParagraph>
          Users sign in with email and password. The frontend issues HTTP-only cookies backed by JWT signed with your{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">JWT_SECRET</code>. Sessions expire per your policy.
        </DocParagraph>
        <DocHeading id="workspaces">Workspaces</DocHeading>
        <DocParagraph>
          Each account belongs to a workspace. Database connections, chat history, and dashboards are isolated per workspace.
          Team features allow inviting collaborators with role-based access.
        </DocParagraph>
        <DocHeading id="api-auth">API authentication</DocHeading>
        <CodeBlock
          language="bash"
          code={`curl -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"question":"top customers by revenue"}' \\
  https://api.insightsql.com/ask`}
        />
      </>
    ),
  },

  "asking-questions": {
    meta: {
      title: "Asking Questions",
      description: "Master the natural language chat interface.",
      toc: [
        { id: "chat-ui", title: "Chat interface" },
        { id: "prompting", title: "Prompting tips" },
        { id: "follow-ups", title: "Follow-up questions" },
        { id: "streaming", title: "Streaming responses" },
      ],
    },
    body: (
      <>
        <DocHeader title="Asking Questions" description="Master the natural language chat interface." />
        <DocImage src="/docs/query-builder.svg" alt="InsightSQL chat interface" caption="The chat panel with schema-aware suggestions." />
        <DocHeading id="chat-ui">Chat interface</DocHeading>
        <DocParagraph>
          Select an active database connection, then type your question in the input at the bottom of the chat.
          InsightSQL shows schema hints and recent queries in the sidebar for faster iteration.
        </DocParagraph>
        <TypingDemo />
        <DocHeading id="prompting">Prompting tips</DocHeading>
        <Callout title="Be specific about time ranges and metrics">
          Instead of &ldquo;sales data&rdquo;, try &ldquo;monthly revenue by product category for 2025, as a bar chart&rdquo;.
        </Callout>
        <DocHeading id="follow-ups">Follow-up questions</DocHeading>
        <DocParagraph>
          Context carries across the thread. Ask &ldquo;now filter to EMEA only&rdquo; or &ldquo;show that as a line chart&rdquo;
          without restating the full query.
        </DocParagraph>
        <DocHeading id="streaming">Streaming responses</DocHeading>
        <DocParagraph>
          Answers stream token-by-token. SQL and result tables appear as soon as execution completes, so you&apos;re never
          staring at a blank screen during long-running queries.
        </DocParagraph>
      </>
    ),
  },

  "ai-sql-generation": {
    meta: {
      title: "AI SQL Generation",
      description: "How InsightSQL builds, validates, and heals SQL with LLMs.",
      toc: [
        { id: "pipeline", title: "Generation pipeline" },
        { id: "providers", title: "LLM providers" },
        { id: "self-healing", title: "Self-healing queries" },
        { id: "dialects", title: "Dialect awareness" },
      ],
    },
    body: (
      <>
        <DocHeader title="AI SQL Generation" description="How InsightSQL builds, validates, and heals SQL with LLMs." />
        <DocImage src="/docs/ai-flow.svg" alt="AI SQL generation flow" />
        <DocHeading id="pipeline">Generation pipeline</DocHeading>
        <DocParagraph>
          1. Schema context is assembled from cached metadata. 2. A synthesis prompt maps your question to tables and columns.
          3. The LLM emits SQL. 4. The executor runs it. 5. Errors trigger a repair pass with the database error message.
        </DocParagraph>
        <SqlReveal />
        <DocHeading id="providers">LLM providers</DocHeading>
        <DocParagraph>
          Configure <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">LLM_PROVIDER</code> and fallback chain via{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">LLM_FALLBACK_PROVIDERS</code>.
          If Gemini hits rate limits, Groq or DeepSeek take over automatically.
        </DocParagraph>
        <DocHeading id="self-healing">Self-healing queries</DocHeading>
        <Tip>
          When execution fails, the agent receives the error text and regenerates SQL — fixing typos, wrong column names, or dialect issues.
        </Tip>
        <DocHeading id="dialects">Dialect awareness</DocHeading>
        <DocParagraph>
          PostgreSQL <code className="text-indigo-300">DATE_TRUNC</code>, Snowflake <code className="text-indigo-300">QUALIFY</code>,
          MongoDB aggregation pipelines — the prompt includes engine-specific guidance.
        </DocParagraph>
      </>
    ),
  },

  visualizations: {
    meta: {
      title: "Visualizations",
      description: "Automatic chart selection and customization.",
      toc: [
        { id: "auto-detect", title: "Auto-detection" },
        { id: "chart-types", title: "Chart types" },
        { id: "customize", title: "Customization" },
      ],
    },
    body: (
      <>
        <DocHeader title="Visualizations" description="Automatic chart selection and customization." />
        <DocImage src="/docs/charts.svg" alt="Chart visualizations" caption="Bar, line, and pie charts generated from query results." />
        <DocHeading id="auto-detect">Auto-detection</DocHeading>
        <DocParagraph>
          InsightSQL analyzes result shape — row count, numeric vs categorical columns, time series — and picks bar, line,
          pie, or table views. You can override in follow-up messages.
        </DocParagraph>
        <ChartReveal />
        <DocHeading id="chart-types">Chart types</DocHeading>
        <DocParagraph>Bar, grouped bar, line, area, pie, scatter, and raw data tables powered by Recharts.</DocParagraph>
        <DocHeading id="customize">Customization</DocHeading>
        <DocParagraph>Ask to change colors, sort order, axis labels, or switch chart types without re-running SQL.</DocParagraph>
        <DocImage src="/docs/results.svg" alt="Query results with chart" />
      </>
    ),
  },

  dashboards: {
    meta: {
      title: "Dashboards",
      description: "Pin queries and build live analytics boards.",
      toc: [
        { id: "widgets", title: "Widgets" },
        { id: "layout", title: "Layout" },
        { id: "refresh", title: "Refresh" },
      ],
    },
    body: (
      <>
        <DocHeader title="Dashboards" description="Pin queries and build live analytics boards." />
        <DocImage src="/docs/dashboard.svg" alt="InsightSQL dashboard" caption="KPI cards and charts on a unified board." />
        <DashboardMock />
        <DocHeading id="widgets">Widgets</DocHeading>
        <DocParagraph>
          Save any chat result as a widget. KPI cards show single aggregates; chart widgets re-query on refresh.
        </DocParagraph>
        <DocHeading id="layout">Layout</DocHeading>
        <DocParagraph>Drag and resize widgets on a responsive grid. Share read-only links with stakeholders.</DocParagraph>
        <DocHeading id="refresh">Refresh</DocHeading>
        <DocParagraph>Set auto-refresh intervals per widget or refresh the entire dashboard manually.</DocParagraph>
      </>
    ),
  },

  "exporting-data": {
    meta: {
      title: "Exporting Data",
      description: "Download and share results in multiple formats.",
      toc: [
        { id: "formats", title: "Export formats" },
        { id: "charts", title: "Chart exports" },
        { id: "sharing", title: "Sharing" },
      ],
    },
    body: (
      <>
        <DocHeader title="Exporting Data" description="Download and share results in multiple formats." />
        <DocHeading id="formats">Export formats</DocHeading>
        <DocParagraph>CSV and Excel for tabular data. Exports respect row limits configured for your plan.</DocParagraph>
        <DocHeading id="charts">Chart exports</DocHeading>
        <DocParagraph>Download charts as PNG for slides and reports. Vector export is on the roadmap.</DocParagraph>
        <DocHeading id="sharing">Sharing</DocHeading>
        <DocParagraph>Generate shareable links with expiration. Recipients see results without account access when permitted.</DocParagraph>
      </>
    ),
  },

  api: {
    meta: {
      title: "API Reference",
      description: "REST endpoints for programmatic access.",
      toc: [
        { id: "base-url", title: "Base URL" },
        { id: "ask", title: "POST /ask" },
        { id: "connections", title: "Connections" },
        { id: "streaming", title: "Streaming" },
      ],
    },
    body: (
      <>
        <DocHeader title="API Reference" description="REST endpoints for programmatic access." />
        <DocHeading id="base-url">Base URL</DocHeading>
        <CodeBlock code="https://your-instance.com/api/backend" language="text" />
        <DocHeading id="ask">POST /ask</DocHeading>
        <CodeBlock
          language="json"
          code={`{
  "question": "monthly active users last 6 months",
  "connection_id": "conn_abc123",
  "stream": true
}`}
        />
        <DocHeading id="connections">Connections</DocHeading>
        <DocParagraph>CRUD endpoints under <code className="text-indigo-300">/connections</code> manage data sources.</DocParagraph>
        <DocHeading id="streaming">Streaming</DocHeading>
        <DocParagraph>Set <code className="text-indigo-300">stream: true</code> for Server-Sent Events with token chunks and final result payload.</DocParagraph>
      </>
    ),
  },

  faq: {
    meta: {
      title: "FAQ",
      description: "Answers to common questions about InsightSQL.",
      toc: [{ id: "questions", title: "Common questions" }],
    },
    body: (
      <>
        <DocHeader title="FAQ" description="Answers to common questions about InsightSQL." />
        <DocHeading id="questions">Common questions</DocHeading>
        <DocsAccordion
          items={[
            { title: "Does InsightSQL store my data?", content: "No. We store connection metadata and encrypted credentials. Query results are transient unless you save them to a dashboard." },
            { title: "Can I use read-only database users?", content: "Yes — strongly recommended. Create a dedicated read-only role for InsightSQL in production." },
            { title: "Which LLM is used?", content: "Configurable via environment. Groq, Gemini, and DeepSeek are supported with automatic fallback on errors or rate limits." },
            { title: "Is SQL always shown before execution?", content: "Generated SQL is visible in the chat. You can copy, edit, or ask the AI to revise before re-running." },
            { title: "Can I self-host?", content: "Yes. Run the open-source stack on your infrastructure with your own LLM keys and database connections." },
          ]}
        />
      </>
    ),
  },

  troubleshooting: {
    meta: {
      title: "Troubleshooting",
      description: "Resolve connection, LLM, and query errors.",
      toc: [
        { id: "connection-errors", title: "Connection errors" },
        { id: "llm-errors", title: "LLM errors" },
        { id: "empty-results", title: "Empty results" },
      ],
    },
    body: (
      <>
        <DocHeader title="Troubleshooting" description="Resolve connection, LLM, and query errors." />
        <DocHeading id="connection-errors">Connection errors</DocHeading>
        <Warning>Verify firewall rules allow your InsightSQL server IP. Test with <code className="text-amber-200">psql</code> or your DB client first.</Warning>
        <DocHeading id="llm-errors">LLM errors</DocHeading>
        <DocParagraph>
          HTTP 429 from Gemini? Set <code className="text-indigo-300">LLM_FALLBACK_PROVIDERS=groq,deepseek,gemini</code> and ensure API keys are valid.
        </DocParagraph>
        <DocHeading id="empty-results">Empty results</DocHeading>
        <DocParagraph>Check date filters and table names in the generated SQL. Ask a follow-up: &ldquo;show the SQL and row count.&rdquo;</DocParagraph>
      </>
    ),
  },

  "keyboard-shortcuts": {
    meta: {
      title: "Keyboard Shortcuts",
      description: "Work faster with these shortcuts.",
      toc: [{ id: "shortcuts", title: "Shortcuts" }],
    },
    body: (
      <>
        <DocHeader title="Keyboard Shortcuts" description="Work faster with these shortcuts." />
        <DocHeading id="shortcuts">Shortcuts</DocHeading>
        <div className="my-6 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-white">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-white">Shortcut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-400">
              <tr><td className="px-4 py-3">Search docs</td><td className="px-4 py-3"><kbd className="rounded border border-white/10 px-2 py-0.5">/</kbd></td></tr>
              <tr><td className="px-4 py-3">Send message</td><td className="px-4 py-3"><kbd className="rounded border border-white/10 px-2 py-0.5">Enter</kbd></td></tr>
              <tr><td className="px-4 py-3">New line in chat</td><td className="px-4 py-3"><kbd className="rounded border border-white/10 px-2 py-0.5">Shift</kbd> + <kbd className="rounded border border-white/10 px-2 py-0.5">Enter</kbd></td></tr>
              <tr><td className="px-4 py-3">Focus chat input</td><td className="px-4 py-3"><kbd className="rounded border border-white/10 px-2 py-0.5">⌘</kbd> + <kbd className="rounded border border-white/10 px-2 py-0.5">K</kbd></td></tr>
              <tr><td className="px-4 py-3">Copy last SQL</td><td className="px-4 py-3"><kbd className="rounded border border-white/10 px-2 py-0.5">⌘</kbd> + <kbd className="rounded border border-white/10 px-2 py-0.5">⇧</kbd> + <kbd className="rounded border border-white/10 px-2 py-0.5">C</kbd></td></tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },

  "release-notes": {
    meta: {
      title: "Release Notes",
      description: "What's new in InsightSQL.",
      toc: [{ id: "releases", title: "Recent releases" }],
    },
    body: (
      <>
        <DocHeader title="Release Notes" description="What's new in InsightSQL." />
        <DocHeading id="releases">Recent releases</DocHeading>
        <Timeline
          items={[
            { date: "Jul 2026", title: "Documentation portal", body: "Premium docs with interactive walkthroughs, search, and sidebar navigation." },
            { date: "Jun 2026", title: "LLM fallback chain", body: "Automatic provider failover when Gemini, Groq, or DeepSeek rate-limit or error." },
            { date: "May 2026", title: "Database logo marquee", body: "Landing page showcase of 24+ supported database brands." },
            { date: "Apr 2026", title: "Env-only configuration", body: "Removed hardcoded secrets; all runtime config from environment variables." },
            { date: "Mar 2026", title: "Dashboard widgets", body: "Pin chat results to auto-refreshing KPI and chart widgets." },
          ]}
        />
      </>
    ),
  },
};

export function getDocArticle(slug: string) {
  return ARTICLES[slug];
}

export function DocArticleContent({ slug }: { slug: string }) {
  const article = ARTICLES[slug];
  if (!article) return null;

  return (
    <DocsReveal>
      <ArticleLayout toc={article.meta.toc}>{article.body}</ArticleLayout>
    </DocsReveal>
  );
}
