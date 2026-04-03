import { sql } from './src/lib/postgres';
import bcrypt from 'bcryptjs';

async function resetPassword() {
    try {
        const hash = bcrypt.hashSync('123456', 10);
        await sql`UPDATE users SET password_hash = ${hash} WHERE email = 'tester@test.com'`;
        console.log("SUCCESS: Password for tester@test.com has been forced to '123456'");
    } catch (e) {
        console.error("DB Error:", e);
    }
}

resetPassword();
