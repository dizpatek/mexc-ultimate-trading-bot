import { sql } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function initDb() {
    try {
        const schemaPath = path.resolve('scripts/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running schema.sql...');

        // We need to split the SQL by semicolon to run each command separately, 
        // but vercel/postgres can sometimes handle multiple if we are careful.
        // However, it's safer to split or use a transaction.
        // For simplicity, let's try to run it.

        // vercel/postgres doesn't support running multiple statements in one call easily 
        // through the tagged template if they contain DDL.
        // Let's use the underlying client if possible or split.

        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await sql.query(statement);
        }

        console.log('Database initialized successfully!');
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
}

initDb();
