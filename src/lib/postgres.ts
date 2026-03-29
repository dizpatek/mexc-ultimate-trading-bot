import { Pool, QueryResult } from "pg";

// Standardize connection URL for Northflank/Generic Postgres
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URI;

const poolConfig: any = {
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
};

// Enable SSL if explicitly requested or if it's a Northflank/Neon primary DB
if (connectionString?.includes("primary") || 
    process.env.PGSSLMODE === 'require' || 
    connectionString?.includes("sslmode=require")) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);

// Debug Logging (Masked)
if (connectionString) {
  console.log(
    `[Postgres] Connecting to: ${connectionString.split("@")[1] || "URL"}`,
  );
} else {
  console.warn("[Postgres] No connection string provided in environment!");
}

/**
 * Tagged template literal for SQL queries, compatible with Northflank PostgreSQL
 */
export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<Record<string, unknown>>> {
  const query = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );

  // Automatic JSON serialization for objects/arrays to match pg driver flavor
  const sanitizedValues = values.map((v) =>
    typeof v === "object" && v !== null && !(v instanceof Date)
      ? JSON.stringify(v)
      : v,
  );

  const client = await pool.connect();
  try {
    const result = await client.query(query, sanitizedValues);
    return result;
  } finally {
    client.release();
  }
}

// Ensure pool is closed on hot reload/shutdown
if (process.env.NODE_ENV === "development") {
  const globalWithPool = global as typeof globalThis & { pgPool?: Pool };
  globalWithPool.pgPool = globalWithPool.pgPool || pool;
}
