import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, getUserByEmail, getUserById } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it';

export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function generateToken(user: any): string {
    return jwt.sign(
        { id: user.id, email: user.email, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

export function verifyToken(token: string): any {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

export async function registerUser(username: string, email: string, password: string) {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        return { success: false, message: 'Email already registered' };
    }

    const passwordHash = await hashPassword(password);
    const userId = await createUser({
        username,
        email,
        password_hash: passwordHash
    });

    const user = await getUserById(userId);
    const token = generateToken(user);

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

    const token = generateToken(user);

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
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    const result = await getCurrentUser(token);

    if (result.success && result.user) {
        return result.user;
    }

    return null;
}
