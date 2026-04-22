import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByUsername,
} from "./db";

console.log("[Auth] Loading auth-utils.ts - getSessionUser exported.");

const JWT_SECRET = process.env.JWT_SECRET || "mexc-ultimate-secret-key-2026";

interface User {
  id: number;
  email: string;
  username: string;
  is_admin?: boolean;
}

interface JwtPayload {
  id: number;
  email: string;
  username: string;
  is_admin?: boolean;
}

export async function getSessionUser(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    console.warn("[Auth] getSessionUser: Invalid Authorization header format");
    return null;
  }

  const token = authHeader.split(" ")[1];
  const result = await getCurrentUser(token);

  if (result.success && result.user) {
    return result.user;
  }

  console.warn(`[Auth] getSessionUser: Authentication failed - ${result.message}`);
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      is_admin: user.is_admin,
    },
    JWT_SECRET,
    { expiresIn: "30d" },
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    // P3.2 Optimization: Check for JWT format before attempting verify
    // Prevents 'jwt malformed' noise when CRON_SECRET or other non-jwt strings are used in Bearer header.
    if (!token || typeof token !== "string" || token.split(".").length !== 3) {
      if (token !== process.env.CRON_SECRET) {
         console.warn(`[Auth] verifyToken: Invalid JWT format received (Not a JWT)`);
      }
      return null;
    }
    
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (err: any) {
    // Only log actual verification failures (expired, bad signature etc.) as warnings
    console.warn(`[Auth] verifyToken Failed: ${err.message}`);
    return null;
  }
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
) {
  const existingEmail = await getUserByEmail(email);
  if (existingEmail) {
    return { success: false, message: "Email already registered" };
  }

  const existingUser = await getUserByUsername(username);
  if (existingUser) {
    return { success: false, message: "Username already taken" };
  }

  const passwordHash = await hashPassword(password);
  const userId = (await createUser({
    username,
    email,
    password_hash: passwordHash,
  })) as number;

  // Initialize multi-tenant defaults for the new user
  const { initializeUserSettings } = await import("./db");
  await initializeUserSettings(userId);

  const user = (await getUserById(userId)) as unknown as User;
  const token = generateToken(user);

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin,
    },
    token,
  };
}

export async function authenticateUser(email: string, password: string) {
  const user = (await getUserByEmail(email)) as unknown as
    | (User & { password_hash: string })
    | undefined;
  if (!user) {
    return { success: false, message: "Invalid email or password" };
  }

  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    return { success: false, message: "Invalid email or password" };
  }

  const token = generateToken(user as User);

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin,
    },
    token,
  };
}

export async function getCurrentUser(token: string) {
  const decoded = verifyToken(token);
  if (!decoded) {
    return { success: false, message: "Invalid token" };
  }

  const user = (await getUserById(decoded.id)) as unknown as User;
  if (!user) {
    return { success: false, message: "User not found" };
  }

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin,
    },
  };
}
