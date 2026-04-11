import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await sql`
      SELECT 
        id, symbol, side, price, status, created_at, meta
      FROM orders
      ORDER BY created_at DESC
      LIMIT 20
    `;
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
