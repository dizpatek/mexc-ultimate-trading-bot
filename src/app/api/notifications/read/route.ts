import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";
import { getSessionUser } from "@/lib/auth-utils";
import type { User } from "@/lib/db";

export async function PUT(request: Request) {
  const user = (await getSessionUser(request)) as User | null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { notificationId, all } = body;

    if (all) {
      // Mark all personal ones as read
      await sql`UPDATE notifications SET is_read = TRUE WHERE user_id = ${user.id} AND is_read = FALSE`;
      
      // Mark all global ones as read by inserting into notification_reads
      // Simple approach: get all global notification IDs and insert if not exists
      await sql`
        INSERT INTO notification_reads (notification_id, user_id, read_at)
        SELECT id, ${user.id}, ${Date.now()} FROM notifications 
        WHERE user_id IS NULL
        ON CONFLICT (notification_id, user_id) DO NOTHING
      `;
    } else if (notificationId) {
      const { rows } = await sql`SELECT user_id FROM notifications WHERE id = ${notificationId}`;
      if (rows.length > 0) {
        if (rows[0].user_id) {
          // Individual
          await sql`UPDATE notifications SET is_read = TRUE WHERE id = ${notificationId} AND user_id = ${user.id}`;
        } else {
          // Global
          await sql`
            INSERT INTO notification_reads (notification_id, user_id, read_at)
            VALUES (${notificationId}, ${user.id}, ${Date.now()})
            ON CONFLICT (notification_id, user_id) DO NOTHING
          `;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
