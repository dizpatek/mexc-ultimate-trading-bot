import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { markSignalExecuted } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/trade/signals/mark-executed
 * Marks a strategy signal as executed after the pilot toast has auto-approved
 * and a SmartTrade order was successfully created.
 * This prevents the same signal from re-appearing in the toast loop.
 *
 * Body: { signalId: number, result?: object }
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { signalId, result } = body;

    if (!signalId || typeof signalId !== "number") {
      return NextResponse.json(
        { error: "signalId (number) is required" },
        { status: 400 },
      );
    }

    await markSignalExecuted(signalId, result || { source: "pilot_toast" });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[/api/trade/signals/mark-executed] Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
