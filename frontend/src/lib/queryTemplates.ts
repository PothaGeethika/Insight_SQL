/**
 * Static NL / SQL query template chips filtered by database type.
 */

export interface QueryTemplate {
  id: string;
  label: string;
  prompt: string;
  /** db_type values this template applies to; empty = all */
  dbTypes?: string[];
}

const ALL_SQL = ["postgresql", "mysql", "sqlite", "snowflake", "redshift", "bigquery", "clickhouse", "oracle", "mssql", "sqlserver"];

export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: "list-tables",
    label: "List tables",
    prompt: "Show me the list of tables in this database.",
    dbTypes: ALL_SQL,
  },
  {
    id: "describe-schema",
    label: "Describe schema",
    prompt: "Describe the schema and columns of the primary tables.",
    dbTypes: ALL_SQL,
  },
  {
    id: "recent-rows",
    label: "Recent rows",
    prompt: "Show the top 10 most recent records from the main table.",
    dbTypes: ALL_SQL,
  },
  {
    id: "row-counts",
    label: "Row counts",
    prompt: "What are the row counts for each table?",
    dbTypes: ALL_SQL,
  },
  {
    id: "relationships",
    label: "Relationships",
    prompt: "Explain the relationships between the tables in this schema.",
    dbTypes: ALL_SQL,
  },
  {
    id: "mongo-collections",
    label: "List collections",
    prompt: "List all collections in this database and approximate document counts.",
    dbTypes: ["mongodb"],
  },
  {
    id: "mongo-sample",
    label: "Sample docs",
    prompt: "Show a few sample documents from the largest collection.",
    dbTypes: ["mongodb"],
  },
  {
    id: "es-indices",
    label: "List indices",
    prompt: "List all indices and their document counts.",
    dbTypes: ["elasticsearch"],
  },
  {
    id: "es-mapping",
    label: "Index mapping",
    prompt: "Show the field mapping for the primary index.",
    dbTypes: ["elasticsearch"],
  },
  {
    id: "neo4j-labels",
    label: "Node labels",
    prompt: "What node labels and relationship types exist in this graph?",
    dbTypes: ["neo4j"],
  },
  {
    id: "neo4j-sample",
    label: "Sample graph",
    prompt: "Show a small sample of nodes and their relationships.",
    dbTypes: ["neo4j"],
  },
];

export function templatesForDbType(dbType?: string | null): QueryTemplate[] {
  if (!dbType) return QUERY_TEMPLATES.filter((t) => !t.dbTypes || t.dbTypes.some((d) => ALL_SQL.includes(d)));
  const normalized = dbType.toLowerCase();
  return QUERY_TEMPLATES.filter(
    (t) => !t.dbTypes || t.dbTypes.some((d) => d === normalized || normalized.includes(d))
  );
}
