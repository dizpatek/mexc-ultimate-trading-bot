import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    status: "READY",
    killSwitchEnabled: false,
    killSwitchActive: false,
    systemMessage: "IDLE",
    lastAction: "IDLE",
    timestamp: Date.now(),
  });
}
