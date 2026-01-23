import { NextResponse } from 'next/server';
import { getSessionUser, comparePassword, hashPassword } from '@/lib/auth-utils';
import { getUserById, updateUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Missing current or new password' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
        }

        // Get full user data (including password_hash) from DB
        // User object from session might not have hash for security
        const dbUser = await getUserById(user.id);

        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isMatch = await comparePassword(currentPassword, dbUser.password_hash);

        if (!isMatch) {
            return NextResponse.json({ error: 'Incorrect current password' }, { status: 400 });
        }

        const newHash = await hashPassword(newPassword);
        await updateUser(user.id, { password_hash: newHash });

        return NextResponse.json({ success: true, message: 'Password updated successfully' });

    } catch (error: any) {
        console.error('Password change error:', error);
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }
}
