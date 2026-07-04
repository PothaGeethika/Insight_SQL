export interface DatabaseBrand {
  id: string;
  name: string;
  icon: string;
}

/** Canonical database brand logos — mirrors backend/db_types_config.json */
export const DATABASE_BRANDS: DatabaseBrand[] = [
  { id: "postgresql", name: "PostgreSQL", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postgresql/postgresql-original.svg" },
  { id: "mysql", name: "MySQL", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg" },
  { id: "mariadb", name: "MariaDB", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mariadb/mariadb-original.svg" },
  { id: "oracle", name: "Oracle", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/oracle/oracle-original.svg" },
  { id: "sqlserver", name: "SQL Server", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/microsoftsqlserver/microsoftsqlserver-plain-wordmark.svg" },
  { id: "sqlite", name: "SQLite", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg" },
  { id: "cockroachdb", name: "CockroachDB", icon: "https://cdn.simpleicons.org/cockroachlabs/6933FF" },
  { id: "planetscale", name: "PlanetScale", icon: "https://cdn.simpleicons.org/planetscale/f35815" },
  { id: "tidb", name: "TiDB", icon: "https://cdn.simpleicons.org/tidb/E63F2B" },
  { id: "mongodb", name: "MongoDB", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg" },
  { id: "couchdb", name: "CouchDB", icon: "https://cdn.simpleicons.org/apachecouchdb/E42528" },
  { id: "dynamodb", name: "DynamoDB", icon: "https://api.iconify.design/logos:aws-dynamodb.svg" },
  { id: "redis", name: "Redis", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redis/redis-original.svg" },
  { id: "cassandra", name: "Cassandra", icon: "https://cdn.simpleicons.org/apachecassandra/1287B1" },
  { id: "pinecone", name: "Pinecone", icon: "https://techicons.dev/api/pinecone" },
  { id: "elasticsearch", name: "Elasticsearch", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/elasticsearch/elasticsearch-original.svg" },
  { id: "neo4j", name: "Neo4j", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/neo4j/neo4j-original.svg" },
  { id: "snowflake", name: "Snowflake", icon: "https://cdn.simpleicons.org/snowflake/29B5E8" },
  { id: "databricks", name: "Databricks", icon: "https://cdn.simpleicons.org/databricks/FF3621" },
  { id: "bigquery", name: "BigQuery", icon: "https://cdn.simpleicons.org/googlebigquery/4285F4" },
  { id: "redshift", name: "Redshift", icon: "https://api.iconify.design/logos:aws-redshift.svg" },
  { id: "clickhouse", name: "ClickHouse", icon: "https://cdn.simpleicons.org/clickhouse/FFCC01" },
  { id: "influxdb", name: "InfluxDB", icon: "https://api.iconify.design/logos:influxdb.svg" },
  { id: "supabase", name: "Supabase", icon: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/supabase/supabase-original.svg" },
];
