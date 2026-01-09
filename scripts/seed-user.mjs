import { sql } from '@vercel/postgres';
import bcrypt from 'bcrypt';
import 'dotenv/config';

async function seedUser() {
    const username = 'admin';
    const email = 'admin@example.com';
    const password = 'adminpassword123';

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const now = Date.now();

    try {
        console.log('Checking for existing admin user...');
        const result = await sql.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows && result.rows.length > 0) {
            console.log('Admin user already exists.');
            return;
        }

        console.log('Creating admin user...');
        await sql.query(
            'INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
            [username, email, hash, now, now]
        );
        console.log('Admin user created successfully!');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
    } catch (error) {
        console.error('Error seeding user:', error);
    } finally {
        process.exit(0);
    }
}

seedUser();
