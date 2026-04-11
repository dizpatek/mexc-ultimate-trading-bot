import { Pool, QueryResult, PoolClient } from "pg";

// Standardize connection URL for Northflank/Generic Postgres
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URI;

// Nuclear fix for Northflank TLS mismatch in scripts and dev
if (process.env.NODE_ENV === "development" || connectionString?.includes("northflank.com")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const poolConfig: any = {
  connectionString,
  max: 15, // Artırıldı: Yoğun senkronizasyon araçları varken UI'ın beklemesini engeller
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Optimize edildi: Bozuk bağlantılar 5s içinde elenir
};

if (connectionString?.includes("primary") || 
    connectionString?.includes("lb.") || 
    process.env.PGSSLMODE === 'require' || 
    connectionString?.includes("sslmode=require")) {
  poolConfig.ssl = { 
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined 
  };
}

// NEXT.JS SINGLETON PATTERN
const globalWithPool = global as typeof globalThis & { pgPool?: Pool };
export const pool = globalWithPool.pgPool || new Pool(poolConfig);

if (process.env.NODE_ENV === "development") {
  globalWithPool.pgPool = pool;
}

/**
 * Bağlantı hatalarına (ECONNRESET vb.) karşı dirençli client alma fonksiyonu
 */
async function getResilientClient(retries = 3): Promise<PoolClient> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.connect();
    } catch (err: any) {
      lastError = err;
      if (err.code === 'ECONNRESET' || err.message.includes('terminated')) {
        console.warn(`[Postgres] Connection reset, retrying... (${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Katlanarak bekleme
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Tagged template literal for SQL queries with full resilient retry
 */
export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<Record<string, unknown>>> {
  const query = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""),
    "",
  );

  const sanitizedValues = values.map((v) =>
    typeof v === "object" && v !== null && !(v instanceof Date)
      ? JSON.stringify(v)
      : v,
  );

  let lastError: any;
  for (let i = 0; i < 3; i++) {
    let client;
    try {
      client = await getResilientClient();
      return await client.query(query, sanitizedValues);
    } catch (err: any) {
      lastError = err;
      if (err.code === 'ECONNRESET' || err.message.includes('terminated') || err.message.includes('read ECONNRESET')) {
        console.warn(`[Postgres] Query failed (reset), retrying... (${i + 1}/3)`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw err;
    } finally {
      if (client) client.release();
    }
  }
  throw lastError;
}

/**
 * Raw SQL execution with resilient retry
 */
sql.raw = async function(query: string, values: any[]) {
  const sanitizedValues = values.map((v) =>
    typeof v === "object" && v !== null && !(v instanceof Date)
      ? JSON.stringify(v)
      : v,
  );
  
  let lastError: any;
  for (let i = 0; i < 3; i++) {
    let client;
    try {
      client = await getResilientClient();
      return await client.query(query, sanitizedValues);
    } catch (err: any) {
      lastError = err;
      if (err.code === 'ECONNRESET' || err.message.includes('terminated') || err.message.includes('read ECONNRESET')) {
        console.warn(`[Postgres] Raw Query failed (reset), retrying... (${i + 1}/3)`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw err;
    } finally {
      if (client) client.release();
    }
  }
  throw lastError;
};

