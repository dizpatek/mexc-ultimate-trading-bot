import { Pool, QueryResult } from 'pg';

// Standardize connection URL for Northflank/Generic Postgres
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URI;

const pool = new Pool({
    connectionString,
    ssl: connectionString?.includes('primary') ? { rejectUnauthorized: false } : false,
    max: 10, // Avoid Vercel/Northflank connection limits
    idleTimeoutMillis: 30000,
});

/**
 * Tagged template literal for SQL queries, compatible with @vercel/postgres
 */
export async function sql(strings: TemplateStringsArray, ...values: any[]): Promise<QueryResult<any>> {
    const query = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
    
    // Automatic JSON serialization for objects/arrays to match Vercel driver flavor
    const sanitizedValues = values.map(v => 
        (typeof v === 'object' && v !== null && !(v instanceof Date)) ? JSON.stringify(v) : v
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
if (process.env.NODE_ENV === 'development') {
    (global as any).pgPool = (global as any).pgPool || pool;
}
