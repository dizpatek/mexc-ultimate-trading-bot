import { sql } from '@vercel/postgres';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function updateDb() {
    try {
        const schemaPath = path.resolve('scripts/update-schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running update-schema.sql...');

        // Split by semicolon and execute
        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await sql.query(statement);
        }

        console.log('Database updated successfully!');
    } catch (error) {
        console.error('Error updating database:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

updateDb();
