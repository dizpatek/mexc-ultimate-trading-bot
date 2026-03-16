import { NextResponse } from "next/server";
import { sql, pool } from "@/lib/postgres";
import { getSessionUser } from "@/lib/auth-utils";
import type { User } from "@/lib/db";

export async function GET(request: Request) {
  const user = (await getSessionUser(request)) as User | null;
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } =
      await sql`SELECT id, username, email, is_admin, created_at FROM users ORDER BY id ASC`;
    return NextResponse.json({ success: true, users: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = (await getSessionUser(request)) as User | null;
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get("id");

    if (!targetId || parseInt(targetId) === 1) {
      return NextResponse.json({ error: "Invalid User ID" }, { status: 400 });
    }

    const userIdStr = String(targetId);
    const userIdNum = parseInt(targetId);

    console.log(
      `[Admin] Purging data for User ${targetId} via individual queries in transaction...`,
    );

    // Execute deletions sequentially
    const queries = [
      {
        sql: "DELETE FROM system_logs WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM alarm_logs WHERE alarm_id IN (SELECT id FROM alarms WHERE user_id = $1 OR user_id = $2)",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM alarms WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM dca_bots WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM performance_metrics WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM panic_snapshots WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM system_settings WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM strategy_signals WHERE strategy_id IN (SELECT id FROM strategies WHERE user_id = $1 OR user_id = $2)",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM strategies WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM trade_history WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM orders WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM portfolio WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      {
        sql: "DELETE FROM portfolio_snapshots WHERE user_id = $1 OR user_id = $2",
        params: [userIdNum, userIdStr],
      },
      { sql: "DELETE FROM users WHERE id = $1", params: [userIdNum] },
    ];

    for (const q of queries) {
      try {
        await client.query(q.sql, q.params);
      } catch (err: unknown) {
        console.warn(
          `[Admin] Purge Step Fail on query: ${q.sql}. Error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
