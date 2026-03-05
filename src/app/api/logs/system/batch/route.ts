import { NextRequest, NextResponse } from "next/server";
import { logSystemEvent, flushSystemLogs } from "@/lib/db";
import { getSessionUser } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = Number(user.id);
    const logs = await request.json();

    if (!Array.isArray(logs)) {
      return NextResponse.json(
        { error: "Expected an array of logs" },
        { status: 400 },
      );
    }

    // Limit the batch size to prevent DB DoS
    if (logs.length > 50) {
      return NextResponse.json(
        { error: "Payload too large (max 50 logs per batch)" },
        { status: 413 },
      );
    }

    let processed = 0;
    // Add all valid logs to the buffer with sanitization
    for (const log of logs) {
      if (
        log.level &&
        typeof log.level === "string" &&
        log.message &&
        typeof log.message === "string"
      ) {
        // Truncate fields to prevent DB row bloat
        const safeLevel = log.level.substring(0, 10);
        const safeMessage = log.message.substring(0, 255);
        const safeDetails =
          log.details && typeof log.details === "string"
            ? log.details.substring(0, 2000)
            : null;

        await logSystemEvent(uid, safeLevel, safeMessage, safeDetails);
        processed++;
      }
    }

    // Ensure they get flushed
    flushSystemLogs().catch(() => {});

    return NextResponse.json({ success: true, processed });
  } catch (error: unknown) {
    console.error("[API/Logs/Batch] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
