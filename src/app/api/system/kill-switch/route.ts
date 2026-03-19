import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { sql } from "@/lib/postgres";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    console.log(`[KillSwitch] Emergency stop triggered by user ${user.id}`);

    // Stop the pilot for THIS user only
    await sql`
      UPDATE bot_configs 
      SET auto_trade = FALSE, updated_at = ${Date.now()} 
      WHERE user_id = ${user.id}
    `;

    return NextResponse.json({
      success: true,
      status: "KILLED",
      message: "Senin pilotun için acil durum durdurması başarıyla uygulandı.",
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to execute kill switch" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await sql`SELECT auto_trade FROM bot_configs WHERE user_id = ${user.id}`;
  const isPilotActive = rows.length > 0 ? rows[0].auto_trade : false;

  return NextResponse.json({
    success: true,
    active: isPilotActive,
    userId: user.id,
    lastCheck: Date.now(),
  });
}
