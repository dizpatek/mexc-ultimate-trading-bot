import { NextResponse } from "next/server";
import { getSimulator } from "@/lib/trading-simulator";
import { getSessionUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    console.log(`[ResetAPI] Resetting simulator for user ${user.id}`);
    const simulator = getSimulator(user.id);
    simulator.resetInMemoryState();

    // Also reset database records for this user
    const { resetSimulatorDatabase } = await import("@/lib/trading-simulator");
    await resetSimulatorDatabase(user.id);

    return NextResponse.json({
      success: true,
      message:
        "Simulator has been reset and your test balances have been restored.",
    });
  } catch (error) {
    console.error("Reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset simulator" },
      { status: 500 },
    );
  }
}
