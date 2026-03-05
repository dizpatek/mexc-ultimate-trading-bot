"use server";

import { setSetting } from "@/lib/settings";
import type { TradingMode } from "@/lib/trading-mode";
import { cookies } from "next/headers";

export async function updateTradingMode(mode: TradingMode, userId: number) {
  try {
    await setSetting("TRADING_MODE", mode, userId);

    // Next.js 15+ cookies() is async
    const cookieStore = await cookies();
    cookieStore.set("TRADING_MODE", mode, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update trading mode:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}
