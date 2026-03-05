import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STATE_FILE = path.join(process.cwd(), "kill-switch-state.json");

function getState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
  return { enabled: false };
}

function saveState(enabled: boolean) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ enabled }));
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const { searchParams } = new URL(req.url);

  if (
    authHeader === "fail" ||
    searchParams.get("fail") === "true" ||
    searchParams.get("mode") === "fail"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
        message: "Failed to change system state",
      },
      { status: 403 },
    );
  }

  saveState(true);

  return NextResponse.json({
    success: true,
    killSwitchEnabled: true,
    systemMessage: "Trading paused - Kill Switch ON",
    systemState: {
      killSwitch: true,
      status: "KILLED",
    },
  });
}

export async function GET() {
  const state = getState();
  return NextResponse.json({
    killSwitchEnabled: state.enabled,
    systemMessage: state.enabled ? "Trading paused - Kill Switch ON" : "IDLE",
    systemState: {
      killSwitch: state.enabled,
      status: state.enabled ? "KILLED" : "READY",
    },
  });
}
