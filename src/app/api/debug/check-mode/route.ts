import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";
import { getTradingMode } from "@/lib/mexc-wrapper";

export async function GET() {
  try {
    const userId = 1; // Assuming checking for admin/main user

    // 1. Check DB directly
    const { rows } =
      await sql`SELECT * FROM system_settings WHERE user_id = ${userId} AND key = 'TRADING_MODE'`;

    // 2. Check via helper
    const resolvedMode = getTradingMode();

    return NextResponse.json({
      dbRow: rows[0] || null,
      resolvedMode,
      envMode: process.env.TRADING_MODE,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
