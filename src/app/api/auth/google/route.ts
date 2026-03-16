import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateToken } from "@/lib/auth-utils";

/**
 * GOOGLE AUTH BRIDGE - NEXT.JS API ROUTE
 * 
 * Handles Google user data provided by the client,
 * creates users in the Matrix DB if they don't exist,
 * and returns a backend JWT for session management.
 */
export async function POST(request: Request) {
  try {
    const { googleId, email, name, picture } = await request.json();

    if (!email) {
      return NextResponse.json({ success: false, message: "Email required" }, { status: 400 });
    }

    // 1. Check if user already exists in DB
    const { rows } = await sql`SELECT * FROM users WHERE email = ${email}`;
    let user = rows[0];

    if (!user) {
      // 2. Create new user for Google login
      // We generate a dummy password hash as they login via Google
      const username = name?.replace(/\s+/g, '_').toLowerCase() || email.split('@')[0];
      const now = Date.now();
      
      const insertResult = await sql`
        INSERT INTO users (username, email, password_hash, created_at, updated_at, is_admin)
        VALUES (${username}, ${email}, 'GOOGLE_OAUTH_LOGIN', ${now}, ${now}, false)
        RETURNING *
      `;
      user = insertResult.rows[0];
    }

    // 3. Generate Matrix System Token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
      is_admin: !!user.is_admin
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        is_admin: !!user.is_admin
      },
      token
    });

  } catch (error: unknown) {
    console.error("[GoogleAuth] Route Error:", error);
    return NextResponse.json({ success: false, message: "Google Auth Failed" }, { status: 500 });
  }
}
