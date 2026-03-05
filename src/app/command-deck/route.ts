import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const isEnable = body.killSwitchEnabled === true;

  return NextResponse.json({
    success: true,
    systemMessage: isEnable
      ? "Trading paused - Kill Switch ON"
      : "Trading resumed",
    systemState: {
      killSwitch: isEnable,
      status: isEnable ? "KILLED" : "READY",
    },
    killSwitchEnabled: isEnable,
  });
}
