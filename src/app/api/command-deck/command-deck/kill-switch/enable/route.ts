import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const searchParams = new URL(req.url).searchParams;

  if (
    authHeader === "fail" ||
    searchParams.get("fail") === "true" ||
    searchParams.get("mode") === "fail"
  ) {
    return NextResponse.json(
      { success: false, error: "Unauthorized", message: "Unauthorized access" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    success: true,
    status: "KILLED",
    killSwitchEnabled: true,
    message: "Trading paused - Kill Switch ON",
    systemMessage: "Trading paused - Kill Switch ON",
    timestamp: Date.now(),
  });
}
