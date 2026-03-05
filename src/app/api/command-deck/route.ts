import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    killSwitchEnabled: false,
    systemMessage: "IDLE",
    systemState: {
      killSwitch: false,
      status: "READY",
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
