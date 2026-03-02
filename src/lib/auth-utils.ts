import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail, getUserById, getUserByUsername } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it';

interface User {
    id: number;
    email: string;
    username: string;
}

interface JwtPayload {
    id: number;
    email: string;
    username: string;
}

export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function generateToken(user: { id: number; email: string; username: string }): string {
    return jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
        return null;
    }
}

export async function registerUser(username: string, email: string, password: string) {
    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
        return { success: false, message: 'Email already registered' };
    }

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
        return { success: false, message: 'Username already taken' };
    }

    const passwordHash = await hashPassword(password);
    const userId = await createUser({
        username,
        email,
        password_hash: passwordHash
    });

    const user = await getUserById(userId);
    const token = generateToken(user as User);

    return {
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email
        },
        token
    };
}

export async function authenticateUser(email: string, password: string) {
    const user = await getUserByEmail(email);
    if (!user) {
        return { success: false, message: 'Invalid email or password' };
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
        return { success: false, message: 'Invalid email or password' };
    }

    const token = generateToken(user as User);

    return {
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email
        },
        token
    };
}

export async function getCurrentUser(token: string) {
    const decoded = verifyToken(token);
    if (!decoded) {
        return { success: false, message: 'Invalid token' };
    }

    const user = await getUserById(decoded.id);
    if (!user) {
        return { success: false, message: 'User not found' };
    }

    return {
        success: true,
        user: {
            id: user.id,
            username: user.username,
            email: user.email
        }
    };
}

export async function getSessionUser(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null; // Return null to enforce proper auth
        }

        const token = authHeader.split(' ')[1];
        const result = await getCurrentUser(token);

        if (result.success && result.user) {
            return result.user;
        }

        return null;
    } catch (error) {
        console.error('[Auth] getSessionUser Error:', error);
        return null;
    }
}
