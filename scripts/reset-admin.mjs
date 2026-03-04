import bcrypt from 'bcryptjs';
import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function resetAdminPassword() {
    const password = 'adminpassword123';
    const email = 'admin@example.com';
    
    console.log(`[Reset] Target: ${email}`);
    console.log(`[Reset] New Password: ${password}`);

    const pool = new Pool({ connectionString });
    
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const now = Date.now();

        const res = await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = $2 WHERE email = $3 RETURNING id',
            [hash, now, email]
        );

        if (res.rowCount === 0) {
            console.log('[Reset] Admin user not found. Creating it instead...');
            await pool.query(
                'INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
                ['admin', email, hash, now, now]
            );
            console.log('[Reset] Admin user created successfully.');
        } else {
            console.log('[Reset] Admin password updated successfully.');
        }

    } catch (error) {
        console.error('[Reset] Error:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

resetAdminPassword();
