import bcrypt from 'bcrypt';
import { sql } from '@vercel/postgres';
import 'dotenv/config';

async function test() {
    try {
        console.log('Testing bcrypt...');
        const hash = await bcrypt.hash('test', 10);
        console.log('Bcrypt hash successful:', hash);
        const match = await bcrypt.compare('test', hash);
        console.log('Bcrypt compare successful:', match);

        console.log('Testing DB connection...');
        const result = await sql`SELECT NOW()`;
        console.log('DB connection successful:', result.rows[0]);
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        process.exit(0);
    }
}

test();
