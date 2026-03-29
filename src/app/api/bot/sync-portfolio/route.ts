import { NextResponse } from "next/server";
import { getHoldings } from "@/lib/mexc-wrapper";
import { setSetting, getSetting } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth-utils";
import { logSystemEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // 1. Check if Production API Keys are present
    const { apiKey, apiSecret } = await import("@/lib/settings").then(m => m.getMexcCredentials(userId, "production"));
    
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ 
        success: false, 
        error: "GERÇEK CÜZDAN ANALİZİ ENGELLENDİ: Production API anahtarlarınız (Key/Secret) bulunamadı. Lütfen Ayarlar sayfasından anahtarlarınızı girin." 
      });
    }

    // 2. Fetch REAL holdings using forceReal=true
    const realHoldings = await getHoldings(userId, "production", true);

    if (!realHoldings || realHoldings.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Gerçek cüzdan verisi çekilemedi. API anahtarlarınızı kontrol edin." 
      });
    }

    // 2. Format for Simulator
    const simBalances = realHoldings.map((h: any) => ({
      asset: h.asset || h.symbol,
      free: Number(h.free),
      locked: Number(h.locked)
    }));

    // 3. Save to SIMULATED_BALANCES
    await setSetting("SIMULATED_BALANCES", JSON.stringify(simBalances), userId);
    
    // 4. Ensure migration flag is set if we have many assets
    if (simBalances.length >= 5) {
      await setSetting("SIM_V3_MIGRATED", "true", userId);
    }

    // 5. Log the event
    await logSystemEvent(
      userId,
      "SYSTEM",
      "PORTFOLIO_SYNC",
      `Gerçek cüzdan bakiyeleri simülasyona aktarıldı. (${simBalances.length} varlık)`
    );

    return NextResponse.json({ 
      success: true, 
      count: simBalances.length,
      message: "Cüzdan başarıyla senkronize edildi." 
    });

  } catch (error: any) {
    console.error("[SyncPortfolio] Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Bilinmeyen bir hata oluştu." 
    }, { status: 500 });
  }
}
