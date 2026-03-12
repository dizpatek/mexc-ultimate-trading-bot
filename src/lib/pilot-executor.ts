import { BotConfig, createStrategySignal } from "./db";
import { TradingMode, getPrice } from "./mexc-wrapper";
import { handleSmartTrade } from "./smart-trade";

export class PilotExecutor {
  /**
   * Calculates the target quantity and identifies if the signal is a new buy
   */
  static calculateAllocation(
    symbol: string,
    holdingsMap: Map<string, any>,
    botConfig: BotConfig,
    signalType: string
  ): { hasHolding: boolean; targetQty: number; isNewBuy: boolean } {
    const holding = holdingsMap.get(symbol);
    const free = Number(holding?.free || 0);
    const locked = Number(holding?.locked || 0);
    const totalQty = free + locked;

    // Fetch Pilot Allocation from config, default 10%
    const pilotAllocPct = Number(botConfig.timeframe_settings?.pilot_trade_allocation || 10);
    let targetQty = totalQty * (pilotAllocPct / 100);

    // For SELL (Cover), we can only sell the free balance. Cap it to free balance.
    if (signalType === "SELL") {
      targetQty = Math.min(targetQty, free);
    }

    // Standardized threshold (0.0001) to ensure small positions can be managed
    const hasHolding = targetQty > 0.0001;
    
    // If we don't hold the asset, but signal is BUY and pilot_only_holdings is false -> New Buy
    const isNewBuy = !hasHolding && signalType === "BUY" && botConfig.pilot_only_holdings === false;

    return { hasHolding, targetQty, isNewBuy };
  }

  /**
   * Executes a trade on an existing holding.
   * Based on config, it either bypasses the buy and applies TP/SL, or buys more.
   */
  static async executeTradeOnHolding(symbol: string, botConfig: BotConfig, userId: number, mode: TradingMode, timeframe: string, signal: any, targetQty: number) {
    try {
      const currentPrice = await getPrice(symbol);
      
      console.log(`[Pilot] ✈️ Applying Trade Protections for holding ${symbol} | Qty: ${targetQty.toFixed(8)} | UseExisting: ${botConfig.pilot_only_holdings}`);
      
      const res = await handleSmartTrade({
        mode: "TRADE",
        symbol,
        amount: targetQty.toFixed(8),
        buyPrice: currentPrice.toString(),
        buyType: "MARKET",
        useExisting: botConfig.pilot_only_holdings, // Tied to config
        user_id: userId,
        trailingBuy: false, // Don't trail buy since we likely own it
        takeProfit: signal.targets?.t1 ? {
          price: signal.targets.t1.toString(),
          trailing: botConfig.pilot_tp_trailing,
          deviation: botConfig.pilot_tp_deviation,
        } : null,
        stopLoss: signal.targets?.sl ? {
          price: signal.targets.sl.toString(),
          trailing: botConfig.pilot_sl_trailing,
          deviation: botConfig.pilot_sl_deviation,
        } : null,
        timeframe,
      }, mode);
      return { executed: true, data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto" } };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  /**
   * Executes a brand new buy using USDT balance
   */
  static async executeNewBuy(symbol: string, botConfig: BotConfig, userId: number, mode: TradingMode, timeframe: string, signal: any, holdingsMap: Map<string, any>) {
    try {
      const currentPrice = await getPrice(symbol);
      const usdtHolding = holdingsMap.get("USDT");
      const usdtBalance = Number(usdtHolding?.free || 0);
      const pilotAllocPct = Number(botConfig.timeframe_settings?.pilot_trade_allocation || 10);
      
      // Calculate allocation based on USDT for new buys
      let allocUsdt = usdtBalance * (pilotAllocPct / 100);
      allocUsdt = Math.min(allocUsdt, 100000); // 100k safety max capping
      
      if (allocUsdt < 5) {
        const msg = `USDT bakiye yetersiz: $${allocUsdt.toFixed(2)}. Min $5 gerekli.`;
        console.log(`[Pilot] ⚠️ ${symbol} BUY ATLANDI: ${msg}`);
        return { executed: false, data: { message: msg } };
      }

      const baseQty = allocUsdt / currentPrice;
      console.log(`[Pilot] ✈️ Executing NEW BUY (Increasing Position) for ${symbol} | Alloc DT: $${allocUsdt.toFixed(2)}`);
      
      const tpPerc = botConfig.timeframe_settings?.pilot_tp_percent ?? 1.0;
      const slPerc = botConfig.timeframe_settings?.pilot_sl_percent ?? 1.0;
      const calcTp = currentPrice * (1 + (tpPerc / 100));
      const calcSl = currentPrice * (1 - (slPerc / 100));

      const res = await handleSmartTrade({
        mode: "TRADE",
        symbol,
        amount: baseQty.toFixed(8),
        buyPrice: currentPrice.toString(),
        buyType: "MARKET",
        useExisting: false, // Brand new asset, we MUST buy
        user_id: userId,
        trailingBuy: botConfig.pilot_trailing_buy ?? false,
        trailingBuyDev: botConfig.pilot_trailing_buy_dev,
        takeProfit: {
          price: (signal.targets?.t1 || calcTp).toString(),
          trailing: botConfig.pilot_tp_trailing ?? true,
          deviation: botConfig.pilot_tp_deviation ?? 0.5,
        },
        stopLoss: {
          price: (signal.targets?.sl || calcSl).toString(),
          trailing: botConfig.pilot_sl_trailing ?? false,
          deviation: botConfig.pilot_sl_deviation ?? 0.5,
        },
        timeframe,
      }, mode);
      return { executed: true, data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto" } };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  /**
   * Executes a COVER mode SmartTrade to sell and buy back lower.
   */
  static async executeCover(symbol: string, botConfig: BotConfig, userId: number, mode: TradingMode, timeframe: string, targetQty: number, signal: any) {
    try {
      const currentPrice = await getPrice(symbol);

      console.log(`[Pilot] ✈️ Creating SmartTrade SELL (COVER) for ${symbol} | Qty: ${targetQty.toFixed(8)}`);

      const tpPerc = botConfig.timeframe_settings?.cover_tp_percent ?? 1.0;
      const slPerc = botConfig.timeframe_settings?.cover_sl_percent ?? 1.0;
      const calcTp = currentPrice * (1 - (tpPerc / 100)); // TP lower for Cover
      const calcSl = currentPrice * (1 + (slPerc / 100)); // SL higher for Cover

      const res = await handleSmartTrade({
        mode: "COVER",
        symbol,
        amount: targetQty.toFixed(8),
        buyPrice: currentPrice.toString(),
        buyType: "MARKET",
        useExisting: true,
        user_id: userId,
        takeProfit: {
          price: (signal.targets?.t1 || calcTp).toString(), 
          trailing: botConfig.timeframe_settings?.cover_tp_trailing ?? botConfig.pilot_tp_trailing ?? true,
          deviation: botConfig.timeframe_settings?.cover_tp_deviation ?? botConfig.pilot_tp_deviation ?? 0.5,
        },
        stopLoss: {
          price: (signal.targets?.sl || calcSl).toString(),
          trailing: botConfig.timeframe_settings?.cover_sl_trailing ?? botConfig.pilot_sl_trailing ?? false,
          deviation: botConfig.timeframe_settings?.cover_sl_deviation ?? botConfig.pilot_sl_deviation ?? 1.0,
        },
        timeframe,
      }, mode);
      return { executed: true, data: { ...(res as any), type: "SMART_TRADE", source: "pilot_auto" } };
    } catch (err) {
      return { executed: false, data: { error: String(err) } };
    }
  }

  static async recordSignalResult(p: {
    symbol: string, 
    signal: any, 
    timestamp: number, 
    executed: boolean, 
    executionResult: any, 
    mode: TradingMode, 
    scanTimeframe: string, 
    aiScore: number, 
    recentSignals: any[]
  }) {
    const { symbol, signal, timestamp, executed, executionResult, mode, scanTimeframe, aiScore } = p;
    let vetoReason: string | undefined = undefined;
    if (signal.reason && signal.reason.includes("🛑")) vetoReason = signal.reason.split("🛑")[1].trim();

    const mergedResult = {
      ...(executionResult || {}),
      confidence: aiScore,
      is_whale: !!signal.indicators?.whaleDetected,
      meta: {
        rawSignal: signal,
        vetoReason,
        mode
      }
    };

    await createStrategySignal({
      symbol,
      timeframe: scanTimeframe,
      signal_type: signal.signal,
      price: signal.price || 0,
      timestamp, // Fix: the DB requires timestamp, we pass it explicitly here
      executed,
      execution_result: mergedResult,
      trading_mode: mode,
      veto_reason: vetoReason
    });
  }

  static async handleSignal(params: {
    symbol: string;
    signal: any;
    scanTimeframe: string;
    botConfig: BotConfig;
    userId: number;
    mode: TradingMode;
    holdingsMap: Map<string, any>;
    recentSignals: any[];
    lockInfo?: any;
  }) {
    const { symbol, signal, scanTimeframe, botConfig, userId, mode, holdingsMap, recentSignals } = params;
    const timestamp = Date.now();

    // 1. Deduplication check
    const recentExecuted = recentSignals.find(s => 
      s.symbol === symbol && (s.signal_type === "BUY" || s.signal_type === "SELL") && s.executed === true
    );
    if (recentExecuted) return;

    if (!signal.signal) {
      await this.recordSignalResult({ ...params, timestamp, executed: false, executionResult: {}, aiScore: 0 });
      return;
    }

    const aiScore = typeof signal.indicators?.aiScore === 'number' ? signal.indicators.aiScore : 0;
    console.log(`[Pilot] Signal for ${symbol}: ${signal.signal} | Score: ${aiScore}`);
    
    // 2. Calculate Allocation
    const alloc = this.calculateAllocation(symbol, holdingsMap, botConfig, signal.signal);

    let executed = false;
    let executionResult: Record<string, unknown> = {};

    // 3. Execution Routing
    if (!alloc.hasHolding && !alloc.isNewBuy) {
      console.log(`[Pilot] 🛡 ${symbol} ATLANDI: Yetersiz miktar veya sadece elde olanlar ayarı devrede.`);
      executionResult = { message: "Miktar yetersiz veya portföyde yok." };
    } else {
      if (signal.signal === "BUY") {
        if (alloc.isNewBuy) {
           const result = await this.executeNewBuy(symbol, botConfig, userId, mode, scanTimeframe, signal, holdingsMap);
           executed = result.executed;
           executionResult = result.data;
        } else {
           const result = await this.executeTradeOnHolding(symbol, botConfig, userId, mode, scanTimeframe, signal, alloc.targetQty);
           executed = result.executed;
           executionResult = result.data;
        }
      } else if (signal.signal === "SELL" && alloc.hasHolding) {
        const result = await this.executeCover(symbol, botConfig, userId, mode, scanTimeframe, alloc.targetQty, signal);
        executed = result.executed;
        executionResult = result.data;
      }
    }

    // 4. Record Result
    await this.recordSignalResult({
      symbol,
      signal,
      timestamp,
      executed,
      executionResult,
      mode,
      scanTimeframe,
      aiScore,
      recentSignals
    });

    if (executed) {
      recentSignals.push({
        symbol,
        signal_type: signal.signal,
        executed: true
      });
    }
  }
}
