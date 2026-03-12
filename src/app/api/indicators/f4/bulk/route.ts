import { NextRequest, NextResponse } from "next/server";
import { MatrixV5Engine } from "@/lib/matrix-v5-engine";
import { fetchKlines } from "@/lib/mexc";
import { getBotConfig, resolveTradeMode } from "@/lib/db";
import { fetchFundingRate } from "@/lib/market-data";

export const dynamic = "force-dynamic";

const engine = new MatrixV5Engine({});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbols, interval, riskMode } = body as {
      symbols: string[];
      interval: string;
      riskMode: "safe" | "normal" | "aggressive";
    };

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json({ error: "No symbols provided" }, { status: 400 });
    }

    // P4.1: Cap symbols to prevent CPU-bound timeouts (Max 30 per bulk request)
    const symbolsToProcess = symbols.slice(0, 30);
    const intervalVal = interval || "1h";
    const mode = riskMode || "normal";

    let tradeMode: "Scalp" | "Swing" = "Scalp";
    try {
      const botConfig = await getBotConfig();
      tradeMode = resolveTradeMode(botConfig);
    } catch { /* use default Scalp */ }

    const results = await Promise.all(
      symbolsToProcess.map(async (symbol) => {
        try {
          const symbolUpper = symbol.toUpperCase().replace("/", "");
          const klines = await fetchKlines(symbolUpper, intervalVal, 100);
          
          if (!klines || klines.length < 20) {
            return { symbol, error: "Insufficient data" };
          }

          const closes = klines.map((k) => k.close);
          const highs = klines.map((k) => k.high);
          const lows = klines.map((k) => k.low);
          const volumes = klines.map((k) => k.volume);

          const fundingRate = await fetchFundingRate(symbolUpper);

          const result = engine.analyze(
            closes,
            highs,
            lows,
            volumes,
            intervalVal,
            mode,
            fundingRate || 0,
            { tradeMode }
          );

          return {
            symbol,
            currentPrice: closes[closes.length - 1],
            aiScore: result.aiScore,
            trend: result.trend,
            signal: result.signal,
            whaleDetected: result.whaleStatus !== "NEUTRAL",
            whaleStatus: result.whaleStatus,
            f4Slope: result.slope,
            f4Acceleration: result.acceleration,
            confluenceScore: result.confluenceScore,
            prediction: result.prediction,
            v5Indicators: result.v5Indicators,
            adm: result.adm,
            vpa: result.vpa,
            marketRegime: result.marketRegime,
            volatilityRegime: result.volatilityRegime,
            systemDecision: result.systemDecision,
            mtfConsensus: result.mtfConsensus,
            zScoreValue: result.zScoreValue,
            deathRisk: false,
            smc: result.smc,
            liquidity: result.liquidity,
            whaleTrust: result.whaleTrust,
            tfAdaptFactor: result.tfAdaptFactor,
            f4PowerLoss: result.f4PowerLoss,
            liquidityZone: result.liquidityZone,
            f4EarlyBuy: result.f4EarlyBuy,
            f4EarlySell: result.f4EarlySell,
            f4ConfirmedBuy: result.f4ConfirmedBuy,
            f4ConfirmedSell: result.f4ConfirmedSell,
            fundingRate: result.fundingRate,
            fundingImpact: result.fundingImpact,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return { symbol, error: msg };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
