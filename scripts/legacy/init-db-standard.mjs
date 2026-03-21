import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

async function initDb() {
    if (!connectionString) {
        console.error('No connection string found. Set POSTGRES_URL or DATABASE_URL.');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const schemaPath = path.resolve('scripts/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema.sql on standard PG...');

        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await pool.query(statement);
        }

        console.log('Database initialized successfully!');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

initDb();
