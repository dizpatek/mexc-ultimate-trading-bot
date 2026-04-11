import { NextResponse } from "next/server";
import { sql } from "@/lib/postgres";
import { getSessionUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Son 200 kapanmış işlemi al (Test modu)
    // Gerçek şema: price, profit_loss as pnl, profit_loss_percentage as pnl_perc
    const historyRes = await sql`
      SELECT id, order_id, symbol, side, price, profit_loss as pnl, profit_loss_percentage as pnl_perc, created_at as closed_at
      FROM trade_history
      WHERE user_id = ${user.id} AND trading_mode = 'test'
      ORDER BY created_at DESC
      LIMIT 200
    `;

    // 2. Aktif işlemleri al
    const activeRes = await sql`
      SELECT id, symbol, side, type, price, status, created_at
      FROM orders
      WHERE user_id = ${user.id} AND trading_mode = 'test' AND status IN ('FILLED', 'ACTIVE', 'OPEN', 'PENDING')
      ORDER BY created_at DESC
    `;

    const trades = historyRes.rows;
    const activeTrades = activeRes.rows;

    let totalPnl = 0;
    let winCount = 0;
    let lossCount = 0;
    let tslHits = 0;
    let hardSlHits = 0;

    const symbolStats: Record<string, { wins: number; losses: number; pnl: number }> = {};

    trades.forEach((t: any) => {
      const pnlVal = parseFloat(t.pnl || "0");
      const pnlPerc = parseFloat(t.pnl_perc || "0");
      totalPnl += pnlVal;

      if (!symbolStats[t.symbol]) {
        symbolStats[t.symbol] = { wins: 0, losses: 0, pnl: 0 };
      }
      symbolStats[t.symbol].pnl += pnlVal;

      if (pnlVal > 0) {
        winCount++;
        symbolStats[t.symbol].wins++;
        
        // Mantıksal çıkarım: Eğer kâr küçükse (%1'den az) muhtemelen TSL ile kapanmıştır
        if (pnlPerc < 1) tslHits++;
      } else {
        lossCount++;
        symbolStats[t.symbol].losses++;
        
        // Mantıksal çıkarım: Eğer zarar büyükse (%2'den fazla) Stop Loss patlamıştır
        if (pnlPerc < -2) hardSlHits++;
      }
    });

    const totalClosed = trades.length;
    const winRate = totalClosed > 0 ? (winCount / totalClosed) * 100 : 0;

    // AI İçgörüleri & Parametre Önerileri
    const insights = [];
    const recommendedParams: Record<string, any> = {};

    if (totalClosed > 0) {
      if (totalClosed < 10) {
         insights.push(`Erken dönem analizi (Henüz ${totalClosed} işlem var): Genel gidişat inceleniyor. Optimizasyon süreci başladı.`);
      }

      // Proaktif Parametre Tavsiyesi (İşlem sayısından bağımsız olarak tehlike sezilirse müdahale)
      if (tslHits > (totalClosed * 0.3) && winRate < 50) {
         insights.push("İşlemleriniz çok erken Trailing Stop (TSL) ile kapanıyor. Karlılığı korumak için TSL Deviation değerini genişletmeniz önerilir.");
         recommendedParams.pilot_sl_deviation = 1.2;
         recommendedParams.pilot_tp_trailing = true;
      } else if (hardSlHits > (totalClosed * 0.2)) {
         insights.push("Stop Loss (SL) oranınız yüksek seyrediyor. Giriş stratejisini (AI Threshold) daha seçici hale getirmeniz güvenli olacaktır.");
         recommendedParams.ai_threshold = 8.5;
         recommendedParams.min_power_loss = 2.0;
      } else if (winRate >= 60) {
         insights.push("Kazanma oranınız çok iyi seviyede. Momentumdan faydalanmak için Whale Multiplier veya F4 çarpanlarını esnetebilirsiniz.");
         recommendedParams.f4_multiplier = 0.9;
         recommendedParams.whale_multiplier = 1.1;
      } else {
         insights.push("İşlemleriniz genel olarak stabil. Stratejiyi iyileştirmek için MTF Veto mekanizmasını aktif tutmaya devam edin.");
      }
    } else {
      insights.push("Henüz kapanmış işlem geçmişi bulunmuyor. Simülasyon veri toplamaya devam ediyor.");
      // İlk işlemler için güvenli varsayılan değerleri öner
      recommendedParams.ai_threshold = 8.0;
      recommendedParams.pilot_tp_trailing = true;
    }

    // Zarar eden semboller
    const badSymbols = Object.keys(symbolStats)
      .filter((s) => symbolStats[s].pnl < 0)
      .sort((a, b) => symbolStats[a].pnl - symbolStats[b].pnl)
      .slice(0, 3);

    if (badSymbols.length > 0) {
      insights.push(`En çok zarar ettiren varlıklar: ${badSymbols.join(", ")}. Bu varlıklar için stratejinizi gözden geçirin.`);
    }

    return NextResponse.json({
      summary: {
        totalClosed,
        activeCount: activeTrades.length,
        winRate,
        totalPnl,
        winCount,
        lossCount,
        tslHits,
        hardSlHits
      },
      insights,
      recommendedParams,
      symbolStats
    });

  } catch (error) {
    const err = error as Error;
    console.error("Error analyzing trades:", err);
    return NextResponse.json(
      { error: "Failed to analyze trades", details: err.message },
      { status: 500 }
    );
  }
}
