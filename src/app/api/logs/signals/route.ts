import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";
import { getSessionUser } from "@/lib/auth-utils";
import { ensureTablesExist } from "@/lib/db-init";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const isDev = process.env.NODE_ENV !== "production";
    const cronSecret = process.env.CRON_SECRET || (isDev ? "dev-secret" : null);
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret");
    const authHeader = request.headers.get("authorization");

    let user = await getSessionUser(request);
    
    // Auth bypass for direct browser access or cron jobs using secret
    if (!user) {
      const isAuthorizedBySecret = (cronSecret && (
        querySecret === cronSecret || 
        authHeader === `Bearer ${cronSecret}`
      ));

      if (isAuthorizedBySecret) {
        // Mock system user if authorized by secret
        user = { id: 1, email: "system@internal", username: "system" } as any;
      } else {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const timeframe = searchParams.get("timeframe") || "1m";

    // Ensure tables exist (optimized with isInitialized internal flag)
    await ensureTablesExist();

    // 48-hour (2 days) log limit requirement
    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;

    // Fetch both trade signals and system logs for a complete CombatLog feel
    // P3.2 Fix: Use separate limits for each to ensure high-frequency system logs
    // don't push out trade signals from the result set.
    const { rows } = await sql`
            (
                SELECT 
                    s.id::text,
                    COALESCE(st.name, 'Pilot ON') as strategy_name,
                    COALESCE(s.symbol, st.symbol, 'Global') as symbol,
                    s.signal_type as type,
                    s.price::text as price,
                    s.timestamp,
                    s.executed,
                    s.execution_result::text as detail,
                    s.timeframe as timeframe,
                    s.veto_reason
                FROM strategy_signals s
                LEFT JOIN strategies st ON s.strategy_id = st.id
                WHERE (s.strategy_id IS NULL OR st.user_id = ${user.id})
                AND (
                    ${timeframe} = 'all' OR 
                    s.timeframe = ${timeframe} OR 
                    s.timeframe IS NULL
                )
                AND s.timestamp > ${fortyEightHoursAgo}
                ORDER BY s.timestamp DESC
                LIMIT 2000
            )
            UNION ALL
            (
                SELECT 
                    'sys-' || id::text as id,
                    'Sistem' as strategy_name,
                    'SYSTEM' as symbol,
                    level as type,
                    '---' as price,
                    timestamp,
                    true as executed,
                    message || ': ' || COALESCE(details, '') as detail,
                    'SYSTEM' as timeframe,
                    NULL as veto_reason
                FROM system_logs
                WHERE (user_id = ${user.id} OR user_id IS NULL)
                AND timestamp > ${fortyEightHoursAgo}
                ORDER BY timestamp DESC
                LIMIT 500
            )
            ORDER BY timestamp DESC
        `;

    return NextResponse.json(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
