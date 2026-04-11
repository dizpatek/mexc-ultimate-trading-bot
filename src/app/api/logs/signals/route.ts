import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";
import { getSessionUser } from "@/lib/auth-utils";
import { ensureTablesExist } from "@/lib/db-init";

export const dynamic = "force-dynamic";

// Global cache for DB readiness during instance life (Next.js server-side)
let dbIsReady = false;

export async function GET(request: Request) {
  const startTime = Date.now();
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

    // Optimized table check
    if (!dbIsReady) {
        const initStart = Date.now();
        await ensureTablesExist();
        dbIsReady = true;
        console.log(`[Logs-API] First-run DB Init took ${Date.now() - initStart}ms`);
    }

    // PERFORMANCE FIX: 24h window for dashboard logs is plenty
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    const queryStart = Date.now();
    const { rows } = await sql`
            (
                SELECT 
                    s.id::text,
                    s.user_id::integer as signal_user_id,
                    COALESCE(st.name, 'Pilot ON')::text as strategy_name,
                    COALESCE(s.symbol, st.symbol, 'Global')::text as symbol,
                    s.signal_type::text as type,
                    s.side::text as side,
                    s.price::text as price,
                    s.timestamp,
                    s.executed,
                    s.execution_result::text as detail,
                    COALESCE(s.timeframe, '')::text as timeframe,
                    s.veto_reason::text as veto_reason
                FROM strategy_signals s
                LEFT JOIN strategies st ON s.strategy_id = st.id
                WHERE s.user_id = ${user!.id}
                AND (
                    ${timeframe} = 'all' OR 
                    s.timeframe = ${timeframe} OR 
                    s.timeframe IS NULL
                )
                AND s.timestamp > ${twentyFourHoursAgo}
                ORDER BY s.timestamp DESC
                LIMIT 50
            )
            UNION ALL
            (
                SELECT 
                    ('sys-' || id)::text as id,
                    user_id::integer as signal_user_id,
                    'Sistem'::text as strategy_name,
                    'SYSTEM'::text as symbol,
                    level::text as type,
                    ''::text as side,
                    '---'::text as price,
                    timestamp,
                    true as executed,
                    LEFT((message || ': ' || COALESCE(details, '')), 500)::text as detail,
                    'SYSTEM'::text as timeframe,
                    NULL::text as veto_reason
                FROM system_logs
                WHERE (user_id = ${user!.id} OR user_id IS NULL)
                AND timestamp > ${twentyFourHoursAgo}
                ORDER BY timestamp DESC
                LIMIT 50
            )
            ORDER BY timestamp DESC
            LIMIT 100
        `;
    
    const duration = Date.now() - startTime;
    if (duration > 1000) {
        console.warn(`[Logs-API] Query slow: ${duration}ms (DB Query only: ${Date.now() - queryStart}ms)`);
    }

    return NextResponse.json(rows);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error(`[Logs-API] Critical failure after ${duration}ms:`, error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
