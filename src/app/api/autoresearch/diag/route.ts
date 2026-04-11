import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";
import { getSessionUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    
    if (!user) {
      return NextResponse.json({ 
        ok: false, 
        error: "Unauthorized", 
        context: "Diagnostics found no session user." 
      });
    }

    const tradeHistoryCount = await sql`SELECT COUNT(*) FROM trade_history WHERE user_id = ${user.id}`;
    const portfolioCount = await sql`SELECT COUNT(*) FROM portfolio WHERE user_id = ${user.id}`;
    const activeOrdersCount = await sql`SELECT COUNT(*) FROM orders WHERE user_id = ${user.id} AND status IN ('FILLED', 'ACTIVE', 'OPEN', 'PENDING')`;
    
    const { getSetting } = await import("@/lib/settings");
    const mode = await getSetting("TRADING_MODE", user.id) || "test";

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username
      },
      stats: {
        tradeHistory: tradeHistoryCount.rows[0].count,
        portfolioItems: portfolioCount.rows[0].count,
        activeOrders: activeOrdersCount.rows[0].count,
      },
      settings: {
        mode: mode
      },
      env: process.env.NODE_ENV
    });

  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message, 
      stack: error.stack 
    }, { status: 500 });
  }
}
