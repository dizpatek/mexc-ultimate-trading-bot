import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";
import { getSessionUser } from "@/lib/auth-utils";
import type { User } from "@/lib/db";

export async function GET(request: Request) {
  const user = (await getSessionUser(request)) as User | null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } = await sql`
      SELECT n.*, 
        CASE 
          WHEN n.user_id IS NOT NULL THEN n.is_read
          ELSE EXISTS (SELECT 1 FROM notification_reads nr WHERE nr.notification_id = n.id AND nr.user_id = ${user.id})
        END as read_status
      FROM notifications n
      WHERE n.user_id IS NULL OR n.user_id = ${user.id}
      ORDER BY n.created_at DESC
      LIMIT 20
    `;
    return NextResponse.json({ success: true, notifications: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = (await getSessionUser(request)) as User | null;
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, message, level, userId, type } = body;

    if (!title || !message) {
      return NextResponse.json({ error: "Title and Message are required" }, { status: 400 });
    }

    const { rows } = await sql`
      INSERT INTO notifications (user_id, title, message, level, type, created_at)
      VALUES (${userId || null}, ${title}, ${message}, ${level || 'INFO'}, ${type || 'BOTH'}, ${Date.now()})
      RETURNING *
    `;

    return NextResponse.json({ success: true, notification: rows[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
