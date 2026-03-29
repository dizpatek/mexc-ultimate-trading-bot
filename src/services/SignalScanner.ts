import { MatrixV5Strategy } from "@/lib/strategies";
import { fetchKlines } from "@/lib/mexc";
import {
  createStrategySignalsBulk,
  getRecentSignalsBulk,
  StrategySignalInput,
} from "@/lib/db";
import { getAccountInfo } from "@/lib/mexc-wrapper";
import { getBotConfig, resolveTradeMode, BotConfig, logSystemEvent } from "@/lib/db";
import { buildInsight } from "@/lib/insight-utils";


const DEFAULT_SCAN_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
];

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export interface ScanResult {
  symbol: string;
  signalType: string;
  price: number;
  detail: string;
  aiScore: number;
  inserted: boolean;
  vetoReason?: string;
}


export class SignalScanner {
  static async resolveScanSymbols(
    userId: number,
    mode: "test" | "production" = "test",
    botConfig?: BotConfig
  ): Promise<string[]> {
    const config = botConfig || (await getBotConfig(userId));
    
    let holdingsSymbols: string[] = [];
    
    if (mode === "test") {
      // P1.2 SAFETY: In test mode, only scan symbols being virtually traded in DB or held in simulator
      const { getActiveOrderSymbols } = await import("@/lib/db");
      const { getSetting } = await import("@/lib/settings");
      const activeSymbols = await getActiveOrderSymbols(userId, "test");
      
      // Also include symbols from simulator balances so "Portfolio Only" catches coins the user owns but isn't trading yet
      const simBalancesRaw = await getSetting("SIMULATED_BALANCES", userId);
      let simSymbols: string[] = [];
      if (simBalancesRaw) {
        try {
          const balances = JSON.parse(simBalancesRaw);
          simSymbols = balances
            .filter((b: any) => (parseFloat(b.free) + parseFloat(b.locked)) > 0)
            .map((b: any) => `${b.asset}USDT`)
            .filter((s: string) => !s.startsWith("USDT") && !s.startsWith("USDC"));
        } catch (e) {
          console.error("[Scanner] Failed to parse SIMULATED_BALANCES:", e);
        }
      }

      holdingsSymbols = Array.from(new Set([...activeSymbols, ...simSymbols]));
      console.log(`[Scanner] Test Mode Holdings: ${holdingsSymbols.length} assets (${activeSymbols.length} Active, ${simSymbols.length} in Wallet).`);
      
      const { logSystemEvent } = await import("@/lib/db");
      await logSystemEvent(userId, "INFO", 
        `🎯 Fokus Tarama: ${holdingsSymbols.length} varlık`, 
        `Simülatördeki ${simSymbols.length} varlık ve ${activeSymbols.length} aktif işlem taranıyor.`
      );
    } else {
      // Production: Scan real wallet for otopilot opportunities
      const account = await getAccountInfo(userId, mode);
      holdingsSymbols = (account?.balances || [])
        .filter(
          (b: { free: string; locked: string }) =>
            parseFloat(b.free) + parseFloat(b.locked) > 0,
        )
        .map((b: { asset: string }) => `${b.asset}USDT`)
        .filter((s: string) => !s.startsWith("USDT") && !s.startsWith("USDC"));
    }

    // P4.2: Robust Symbol Resolution
    // Even if pilot_only_holdings is true, we include a minimal set of Top Assets 
    // to ensure the user's request for "scanning all assets" is partially met in the UI.
    const { getTopAssets } = await import("@/lib/mexc-wrapper");
    const topAssets = await getTopAssets(30);
    const topSymbols = topAssets.map(a => a.symbol.replace("/", ""));

    if (config.pilot_only_holdings) {
      // If only holdings, we still add the top 20 assets to the scan so the scanner is never "empty"
      return Array.from(new Set([...holdingsSymbols, ...topSymbols.slice(0, 20)])).slice(0, 80);
    }

    // If pilot_only_holdings is false, we scan holdings + more top assets
    const topAssetsBroad = await getTopAssets(60);
    const topSymbolsBroad = topAssetsBroad.map(a => a.symbol.replace("/", ""));

    return Array.from(
      new Set([...holdingsSymbols, ...topSymbolsBroad, ...DEFAULT_SCAN_SYMBOLS]),
    ).slice(0, 120); // Scaled for better coverage
  }

  static async runScan(userId: number, symbols: string[], targetTimeframe?: string, mode: "test" | "production" = "test"): Promise<ScanResult[]> {
    const allResults: ScanResult[] = [];
    const allSignalsToInsert: StrategySignalInput[] = [];
    
    // Use targetTimeframe if provided, otherwise default to a conservative set
    const TIMEFRAMES = targetTimeframe ? [targetTimeframe] : ["1h", "4h"];

    // P4.3: Pre-fetch botConfig once for the entire scan to reduce DB load
    let botConfig: BotConfig | undefined;
    try {
      botConfig = await getBotConfig(userId);
    } catch { /* defaults handled in scanSymbol */ }


    // P4.1: Fetch all recent signals for the entire set in one go to prevent N+1 queries
    const recentSignals = await getRecentSignalsBulk(userId, symbols, DEDUP_WINDOW_MS, mode);


    // Group by symbol_timeframe for O(1) lookup
    const recentSignalsMap = new Map<string, string[]>();
    recentSignals.forEach((s) => {
      const key = `${s.symbol}_${s.timeframe || "1h"}`;
      const list = recentSignalsMap.get(key) || [];
      list.push(s.signal_type);
      recentSignalsMap.set(key, list);
    });

    const scanTasks: Array<{symbol: string, tf: string, existingTypes: string[]}> = [];
    for (const symbol of symbols) {
      for (const tf of TIMEFRAMES) {
        const key = `${symbol}_${tf}`;
        scanTasks.push({
          symbol,
          tf,
          existingTypes: recentSignalsMap.get(key) || []
        });
      }
    }

    // P3.2 PERFORMANCE: Bounded parallel scan (concurrency: 8)
    const CONCURRENCY = 8;
    for (let i = 0; i < scanTasks.length; i += CONCURRENCY) {
      const chunk = scanTasks.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.allSettled(
        chunk.map(t => this.scanSymbol(userId, t.symbol, t.existingTypes, t.tf, mode, botConfig))
      );

      chunkResults.forEach((res, index) => {
        const task = chunk[index];
        if (res.status === "fulfilled") {
          allResults.push(...res.value.results);
          allSignalsToInsert.push(...res.value.signalsToInsert);
        } else {
          console.error(`[SignalScanner] Error scanning ${task.symbol} on ${task.tf}:`, res.reason);
        }
      });
    }

    if (allSignalsToInsert.length > 0) {
      await createStrategySignalsBulk(allSignalsToInsert, userId);
      
      // Log new significant signals for audit
      for (const sig of allSignalsToInsert) {
        const result = allResults.find(r => r.symbol === sig.symbol && r.signalType === sig.signal_type);
        if (result?.inserted) {
          const aiScore = result.aiScore || 0;
          const execRes = sig.execution_result as any;
          const mtf = execRes?.mtfVerdict || "N/A";
          
          await logSystemEvent(userId, aiScore > 75 ? "SUCCESS" : "INFO", 
            `📡 YENİ SİNYAL: ${sig.symbol} (${sig.timeframe})`, 
            `Tip: ${sig.signal_type} | AI: %${aiScore} | MTF: ${mtf} | Fiyat: ${sig.price}`
          );
        }
      }
    }

    return allResults;
  }

  private static async scanSymbol(
    userId: number,
    symbol: string,
    existingTypes: string[],
    interval: string = "4h",
    tradingMode: "test" | "production" = "test",
    botConfig?: BotConfig
  ): Promise<{
    results: ScanResult[];
    signalsToInsert: StrategySignalInput[];
  }> {
    const results: ScanResult[] = [];
    const signalsToInsert: StrategySignalInput[] = [];

    try {
      const config = botConfig || await getBotConfig(userId);

      // P4.1 Optimizer: Pre-fetch klines here and pass to strategy if possible, 
      // but since MatrixV5Strategy expects to fetch its own for analysis consistency,
      // we at least ensure we don't fetch the EXACT same 1-candle kline twice.
      const strategy = new MatrixV5Strategy(symbol, {
        timeframe: interval,
        minAiScore: config.ai_threshold || 65,
        tradeMode: resolveTradeMode(config),
        mtfVeto: config.pilot_mtf_veto,
        mtfThreshold: config.pilot_mtf_threshold || 80,
        f4Length: config.f4_length,
        whaleVolumeMultiplier: config.whale_multiplier,
        f4PowerLossThreshold: config.f4_power_loss_threshold,
        f4LookbackBars: config.f4_lookback_bars,
        f4SqueezeThreshold: config.f4_squeeze_threshold,
        minPowerLoss: config.min_power_loss,
        fiboLength: config.fibo_length
      });

      const signal = await strategy.analyze();
      if (!signal) return { results, signalsToInsert };

      const timestamp = Date.now();
      const currentPrice = signal.price || 0;
      
      // Fetch actual volume from recent klines for better metadata
      // P4.1 Optimizer: We still need volume, but the strategy.analyze already fetched klines.
      // Ideally we'd expose volume from StrategySignal, but for now we note the redundancy.
      const recentKlines = await fetchKlines(symbol, interval, 1);
      const volume = recentKlines?.[0]?.volume || 0;

      let signalType = signal.signal || (signal.indicators.whaleDetected ? "WHALE" : "INFO");
      
      // Check for veto
      let vetoReason: string | undefined = undefined;
      if (signal.reason && signal.reason.includes("🛑")) {
        vetoReason = signal.reason.split("🛑")[1].trim();
        
        // Visibility: If it was a BUY/SELL but got vetoed, mark it specifically
        const originalIntent = (signal.indicators as any).originalIntent;
        if (originalIntent === "BUY") signalType = "VETOED_BUY";
        else if (originalIntent === "SELL") signalType = "VETOED_SELL";
        else signalType = "VETOED";
      } else if (signalType === "BUY" || signalType === "SELL") {
        // Override BUY/SELL because SignalScanner only scans, it does not execute trades
        signalType = `SCANNER_${signalType}`;
      }
      
      if (!vetoReason && signalType.startsWith("SCANNER_")) {
        vetoReason = "Manuel Tarama: Cüzdan (Bakiye/Portföy) ve Otopilot (Motor) sırasına alındı, onay bekleniyor.";
      }

      // If already exists, skip
      if (existingTypes.includes(signalType)) {
        const detailPrefix = vetoReason ? `VETOED: ${vetoReason}` : signal.reason;
        results.push({
          symbol,
          signalType,
          price: currentPrice,
          detail: `${detailPrefix} (deduplicated)`,
          aiScore: Number(signal.indicators.aiScore) || 0,
          inserted: false,
          vetoReason
        });
        return { results, signalsToInsert };
      }

      const detailWithTimeframe = vetoReason ? `🛑 VETOED: ${vetoReason} (${interval})` : `${signal.reason || "Matrix Signal"} (${interval})`;

      results.push({
        symbol,
        signalType,
        price: currentPrice,
        detail: detailWithTimeframe,
        aiScore: Number(signal.indicators?.aiScore) || 0,
        inserted: true,
        vetoReason: vetoReason || ""
      });

      signalsToInsert.push({
        symbol,
        side: signalType.includes("BUY") ? "BUY" : "SELL",
        signal_type: signalType,
        price: currentPrice,
        volume: Number(volume) || 0,
        timestamp,
        executed: false,
        execution_result: { 
          ...(signal.indicators || {}), 
          reason: String(signal.reason || ""), 
          targets: (signal as any).targets || { t1: 0, t2: 0, sl: 0 }, 
          aiScore: Number(signal.indicators?.aiScore) || 0,
          insight: String(buildInsight(signalType, signal.indicators) || "")
        },
        timeframe: interval,
        trading_mode: tradingMode,
        veto_reason: vetoReason || ""
      });

      return { results, signalsToInsert };
    } catch (err) {
      console.error(`[SignalScanner] scanSymbol failure for ${symbol}:`, err);
      return { results, signalsToInsert };
    }
  }
}
