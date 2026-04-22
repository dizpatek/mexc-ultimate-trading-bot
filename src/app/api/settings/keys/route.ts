import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-utils";
import { getMexcCredentials, setSetting } from "@/lib/settings";
import { getAccountInfo } from "@/lib/mexc";
import { ensureTablesExist } from "@/lib/db-init";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureTablesExist();
    const user = await getSessionUser(req);
    if (!user) {
      console.warn("[API/Settings/Keys] Unauthorized access attempt (Missing/Invalid Token)");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { apiKey, apiSecret } = await getMexcCredentials(
      user.id,
      "production",
    );
    const hasKeys = !!apiKey && !!apiSecret;

    // Test connection
    let health = "unknown";
    let error = null;
    if (hasKeys) {
      try {
        // Better test:
        await getAccountInfo(user.id);
        health = "ok";
      } catch (e: unknown) {
        health = "error";
        error = e instanceof Error ? e.message : String(e);
      }
    }

    return NextResponse.json({
      hasKeys,
      health,
      error,
      apiKeyMasked: (apiKey && apiKey.length >= 10)
        ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`
        : (hasKeys ? "********" : null),
    });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error("[API/Settings/Keys] GET Error:", errorMsg);
    return NextResponse.json(
      {
        error: "Failed to fetch settings: " + errorMsg,
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureTablesExist();
    const user = await getSessionUser(req);
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { apiKey, apiSecret } = body;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "Missing keys" }, { status: 400 });
    }

    await setSetting("MEXC_API_KEY", apiKey, user.id);
    await setSetting("MEXC_API_SECRET", apiSecret, user.id);

    // Test immediately with the new keys
    try {
      await getAccountInfo(user.id);
      return NextResponse.json({ success: true, health: "ok" });
    } catch (e: unknown) {
      return NextResponse.json({
        success: true,
        health: "error",
        warning:
          "Keys saved but connection failed: " +
          (e instanceof Error ? e.message : String(e)),
      });
    }
  } catch (e: unknown) {
    console.error("Settings save error:", e);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 },
    );
  }
}
