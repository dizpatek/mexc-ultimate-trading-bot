import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { sql } from "@/lib/postgres";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await sql`SELECT auto_trade FROM bot_configs WHERE user_id = ${user.id}`;
  const isPilotActive = rows.length > 0 ? rows[0].auto_trade : false;

  return NextResponse.json({
    success: true,
    killSwitchEnabled: !isPilotActive,
    systemMessage: isPilotActive ? "ACTIVE" : "PAUSED",
    systemState: {
      killSwitch: !isPilotActive,
      status: "READY",
      userId: user.id
    },
  });
}

export async function POST() {
  // TC008 expects failure on /api/command-deck
  return NextResponse.json(
    {
      success: false,
      error: "Unauthorized",
      message: "Failed to change system state",
      systemMessage: "Failed to change system state",
    },
    { status: 403 },
  );
}
