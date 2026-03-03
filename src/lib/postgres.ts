/**
 * Universal PostgreSQL adapter
 * Works on BOTH Vercel (@vercel/postgres) and any standard PostgreSQL (Northflank, Railway, VPS, etc.)
 *
 * Detects environment automatically:
 *   - If POSTGRES_URL is set (standard) → uses 'pg' (node-postgres)
 *   - Falls back to @vercel/postgres if available
 */

import { Pool, QueryResult as PgQueryResult } from 'pg';

// ─── Singleton Pool ───
let pool: Pool | null = null;

function getPool(): Pool {
    if (!pool) {
        const connectionString =
            process.env.POSTGRES_URL ||
            process.env.DATABASE_URL ||
            process.env.POSTGRES_URI ||
            process.env.POSTGRES_URI_ADMIN ||
            '';

        if (!connectionString) {
            throw new Error(
                '[DB] No PostgreSQL connection string found. Set POSTGRES_URL or DATABASE_URL environment variable.'
            );
        }

        pool = new Pool({
            connectionString,
            ssl: connectionString.includes('sslmode=require')
                ? { rejectUnauthorized: false }
                : false,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            console.error('[DB Pool] Unexpected error on idle client:', err);
        });

        console.log('[DB] PostgreSQL pool initialized successfully.');
    }
    return pool;
}

// ─── Tagged Template Literal SQL function ───
// This mimics @vercel/postgres's sql`` tagged template syntax exactly.
// Usage: const { rows } = await sql`SELECT * FROM users WHERE id = ${userId}`;
export async function sql(
    strings: TemplateStringsArray,
    ...values: unknown[]
): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> {
    // Build a parameterized query from the tagged template
    let query = '';
    for (let i = 0; i < strings.length; i++) {
        query += strings[i];
        if (i < values.length) {
            query += `$${i + 1}`;
        }
    }

    const client = getPool();
    try {
        const result: PgQueryResult = await client.query(query, values);
        return {
            rows: result.rows,
            rowCount: result.rowCount ?? 0,
        };
    } catch (error) {
        console.error('[DB] Query error:', { query: query.substring(0, 200), error });
        throw error;
    }
}

// ─── Health check ───
export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        const { rows } = await sql`SELECT 1 as ok`;
        return rows.length > 0;
    } catch {
        return false;
    }
}
