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

    // P4.1: Cap symbols to prevent CPU-bound timeouts (Max 100 per merged bulk request)
    const symbolsToProcess = symbols.slice(0, 100);
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
          
          if (!klines || klines.length < 50) {
            return { symbol, error: "Insufficient data (min 50 candles required for Matrix V5)" };
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
            symbol: symbol.toUpperCase().replace("/", ""),
            confidence: 0.88,
            status: "READY",
            timestamp: Date.now(),
            engineVersion: "V5",
            tfAdaptFactor: result.tfAdaptFactor,
            currentPrice: closes[closes.length - 1] ?? 0,
            aiScore: result.aiScore,
            aiComponents: result.aiComponents,
            f4Value: result.f4Value,
            f4FiboValue: result.f4FiboValue,
            f4Series: [result.f4Value],
            f4FiboSeries: [result.f4FiboValue],
            f4Slope: result.slope,
            f4Acceleration: result.acceleration,
            whaleSignal: result.whaleStatus,
            whaleDetected: result.whaleStatus !== "NEUTRAL",
            whaleStatus: result.whaleStatus,
            f4Fibo: [result.f4Value * 0.99, result.f4Value, result.f4Value * 1.01],
            predictedTargets: [],
            marketRegime: result.marketRegime,
            volatilityRegime: result.volatilityRegime,
            systemDecision: result.systemDecision,
            trend: result.trend,
            signal: result.signal,
            regimePrediction: result.regimePrediction,
            slope: result.slope,
            acceleration: result.acceleration,
            confluenceScore: result.confluenceScore,
            confluenceBreakdown: result.confluenceBreakdown,
            prediction: result.prediction,
            predictedPrice: result.targets.t1,
            targets: result.targets,
            v5Indicators: result.v5Indicators,
            adm: result.adm,
            vpa: result.vpa,
            momentumState: result.momentumState,
            momentumColor: result.momentumColor,
            whaleSignalText: result.whaleSignalText,
            marketPhaseText: result.marketPhaseText,
            capitalFlowText: result.capitalFlowText,
            capitalPhase: result.capitalPhase,
            mtfConsensus: result.mtfConsensus,
            mtfBullCount: (() => {
              const m = result.mtfConsensus.match(/^(\d+)/);
              return m ? parseInt(m[1]) : 0;
            })(),
            zScoreValue: result.zScoreValue,
            bayesianWinRate: result.aiScore,
            deathRisk: false,
            crossAssetPermission: result.marketRegime === "RISK_ON",
            signalFreshness: 0,
            earlyReversal: result.earlyReversal,
            fastSlope: result.fastSlope,
            fastAcceleration: result.fastAcceleration,
            smc: result.smc,
            liquidity: result.liquidity,
            whaleTrust: result.whaleTrust,
            swingTrend: result.smc.swingTrend,
            inPremium: result.inPremium,
            inDiscount: result.inDiscount,
            f4PowerLoss: result.f4PowerLoss,
            f4EarlyBuy: result.f4EarlyBuy,
            f4EarlySell: result.f4EarlySell,
            f4ConfirmedBuy: result.f4ConfirmedBuy,
            f4ConfirmedSell: result.f4ConfirmedSell,
            liquidityZone: result.liquidityZone,
            liquidityBonus: result.liquidityBonus,
            mtfWeightedScore: result.mtfWeightedScore,
            dynamicWeights: result.dynamicWeights,
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
