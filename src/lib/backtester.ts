/**
 * backtester.ts — MexC AutoResearch Historical Backtest Engine
 * 
 * Geçmiş OHLCV verisi üzerinde MatrixV5Engine'i parametre seti ile çalıştırır.
 * Her trade için trailing stop / trailing tp simüle eder.
 * Sonuç: win_rate, sharpe_ratio, profit_factor, max_drawdown, composite_score
 */

import { MatrixV5Engine } from "./matrix-v5-engine";
import type { BotTimeframeSettings } from "./db";
import { fetchKlines } from "./mexc";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

export interface BacktestParams {
  // Strategy / Engine parameters
  ai_threshold: number;
  f4_length: number;
  f4_multiplier: number;
  whale_multiplier: number;
  f4_power_loss_threshold: number;
  f4_lookback_bars: number;
  f4_squeeze_threshold: number;
  min_power_loss: number;
  f4_slope_threshold: number;

  // Trade parameters
  pilot_tp_percent: number;         // % (e.g. 3.0)
  pilot_sl_percent: number;         // % (e.g. 1.5)
  pilot_tp_trailing: boolean;
  pilot_tp_deviation: number;       // % trailing deviation off TP
  pilot_sl_trailing: boolean;
  pilot_sl_deviation: number;       // % trailing deviation for SL

  // MTF
  pilot_mtf_veto: boolean;
  pilot_mtf_threshold: number;
  pilot_mtf_long_threshold: number;
  pilot_mtf_short_threshold: number;
}

export interface BacktestTrade {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice: number;
  entryIndex: number;
  exitIndex: number;
  pnlPct: number;     // signed %
  exitReason: "TP" | "SL" | "TTP" | "TSL" | "END";
}

export interface BacktestResult {
  params: BacktestParams;
  symbol: string;
  timeframe: string;
  totalCandles: number;
  trades: BacktestTrade[];
  totalTrades: number;
  winTrades: number;
  loseTrades: number;
  win_rate: number;          // 0–100
  total_pnl_pct: number;     // total net P&L %
  avg_win_pct: number;
  avg_loss_pct: number;
  profit_factor: number;     // gross_profit / |gross_loss|
  max_drawdown: number;      // peak-to-trough % (absolute)
  sharpe_ratio: number;      // simplified daily Sharpe
  composite_score: number;   // 0–100; higher is better
  runDurationMs: number;
}

// ────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────

const MAX_TRADE_BARS = 100;   // Force close after this many bars (avoid infinite hold)

// ────────────────────────────────────────────────
// Core Backtest Function
// ────────────────────────────────────────────────

export async function runBacktest(
  symbol: string,
  timeframe: "1h" | "4h" | "1d",
  params: BacktestParams,
  barsOverride?: number,
): Promise<BacktestResult> {
  const startMs = Date.now();
  const bars = barsOverride ?? (timeframe === "1d" ? 365 : timeframe === "4h" ? 500 : 500);

  // Fetch historical klines — fetchKlines returns {time, open, high, low, close, volume} objects
  const klines = await fetchKlines(symbol, timeframe, bars);
  
  if (!klines || klines.length < 200) {
    return emptyResult(symbol, timeframe, params, Date.now() - startMs);
  }

  const opens   = klines.map((k) => k.open);
  const highs   = klines.map((k) => k.high);
  const lows    = klines.map((k) => k.low);
  const closes  = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);

  const engine = new MatrixV5Engine({
    f4Length: params.f4_length,
    f4Multiplier: params.f4_multiplier,
    whaleVolumeMultiplier: params.whale_multiplier,
    f4PowerLossThreshold: params.f4_power_loss_threshold,
    f4LookbackBars: params.f4_lookback_bars,
    longSqueezeThreshold: params.f4_squeeze_threshold,
    shortSqueezeThreshold: params.f4_squeeze_threshold,
    minPowerLoss: params.min_power_loss,
    f4SlopeThreshold: params.f4_slope_threshold,
    mtfThreshold: params.pilot_mtf_threshold,
  });

  const trades: BacktestTrade[] = [];
  const WARMUP = 200; // bars needed for indicator warmup

  let inTrade = false;
  let tradeEntry = 0;
  let tradeSide: "LONG" | "SHORT" = "LONG";
  let tradeEntryIdx = 0;

  // Trailing stop tracking
  let tslLevel = 0;
  let ttpLevel = 0;
  let tslActivated = false;
  let ttpActivated = false;
  let peakPrice = 0;   // peak after entry (for trailing)
  let troughPrice = 0; // trough after entry (for short trailing)

  for (let i = WARMUP; i < closes.length; i++) {
    const closeSlice  = closes.slice(0, i + 1);
    const highSlice   = highs.slice(0, i + 1);
    const lowSlice    = lows.slice(0, i + 1);
    const volSlice    = volumes.slice(0, i + 1);
    const openSlice   = opens.slice(0, i + 1);

    const currentClose = closes[i];
    const currentHigh  = highs[i];
    const currentLow   = lows[i];

    // ── Manage open trade ──────────────────────
    if (inTrade) {
      const barsSinceEntry = i - tradeEntryIdx;

      if (tradeSide === "LONG") {
        peakPrice = Math.max(peakPrice, currentHigh);

        // Static TP / SL levels (set at entry)
        const staticTP = tradeEntry * (1 + params.pilot_tp_percent / 100);
        const staticSL = tradeEntry * (1 - params.pilot_sl_percent / 100);

        // Trailing TP: activate when price touches staticTP
        if (params.pilot_tp_trailing && !ttpActivated && currentHigh >= staticTP) {
          ttpActivated = true;
          ttpLevel = peakPrice * (1 - params.pilot_tp_deviation / 100);
        }
        if (ttpActivated) {
          ttpLevel = Math.max(ttpLevel, peakPrice * (1 - params.pilot_tp_deviation / 100));
        }

        // Trailing SL: always active on LONG
        if (params.pilot_sl_trailing) {
          tslLevel = Math.max(
            tslLevel,
            peakPrice * (1 - params.pilot_sl_deviation / 100),
          );
          tslActivated = true;
        }

        let exitPrice = 0;
        let exitReason: BacktestTrade["exitReason"] | null = null;

        // Check exit conditions (priority: TSL > TTP > static SL > static TP > end)
        if (tslActivated && currentLow <= tslLevel) {
          exitPrice    = tslLevel;
          exitReason   = "TSL";
        } else if (ttpActivated && currentLow <= ttpLevel) {
          exitPrice    = ttpLevel;
          exitReason   = "TTP";
        } else if (!params.pilot_sl_trailing && currentLow <= staticSL) {
          exitPrice    = staticSL;
          exitReason   = "SL";
        } else if (!params.pilot_tp_trailing && currentHigh >= staticTP) {
          exitPrice    = staticTP;
          exitReason   = "TP";
        } else if (barsSinceEntry >= MAX_TRADE_BARS) {
          exitPrice    = currentClose;
          exitReason   = "END";
        }

        if (exitReason) {
          const pnlPct = ((exitPrice - tradeEntry) / tradeEntry) * 100;
          trades.push({
            symbol,
            side: "LONG",
            entryPrice: tradeEntry,
            exitPrice,
            entryIndex: tradeEntryIdx,
            exitIndex: i,
            pnlPct,
            exitReason,
          });
          inTrade      = false;
          tslActivated = false;
          ttpActivated = false;
          tslLevel     = 0;
          ttpLevel     = 0;
          peakPrice    = 0;
        }

      } else {
        // SHORT trade
        troughPrice = Math.min(troughPrice, currentLow);

        const staticTP = tradeEntry * (1 - params.pilot_tp_percent / 100);
        const staticSL = tradeEntry * (1 + params.pilot_sl_percent / 100);

        if (params.pilot_tp_trailing && !ttpActivated && currentLow <= staticTP) {
          ttpActivated = true;
          ttpLevel = troughPrice * (1 + params.pilot_tp_deviation / 100);
        }
        if (ttpActivated) {
          ttpLevel = Math.min(ttpLevel, troughPrice * (1 + params.pilot_tp_deviation / 100));
        }

        if (params.pilot_sl_trailing) {
          tslLevel = tslActivated
            ? Math.min(tslLevel, troughPrice * (1 + params.pilot_sl_deviation / 100))
            : tradeEntry * (1 + params.pilot_sl_deviation / 100);
          tslActivated = true;
        }

        let exitPrice = 0;
        let exitReason: BacktestTrade["exitReason"] | null = null;

        if (tslActivated && currentHigh >= tslLevel) {
          exitPrice  = tslLevel;
          exitReason = "TSL";
        } else if (ttpActivated && currentHigh >= ttpLevel) {
          exitPrice  = ttpLevel;
          exitReason = "TTP";
        } else if (!params.pilot_sl_trailing && currentHigh >= staticSL) {
          exitPrice  = staticSL;
          exitReason = "SL";
        } else if (!params.pilot_tp_trailing && currentLow <= staticTP) {
          exitPrice  = staticTP;
          exitReason = "TP";
        } else if (barsSinceEntry >= MAX_TRADE_BARS) {
          exitPrice  = currentClose;
          exitReason = "END";
        }

        if (exitReason) {
          const pnlPct = ((tradeEntry - exitPrice) / tradeEntry) * 100;
          trades.push({
            symbol,
            side: "SHORT",
            entryPrice: tradeEntry,
            exitPrice,
            entryIndex: tradeEntryIdx,
            exitIndex: i,
            pnlPct,
            exitReason,
          });
          inTrade      = false;
          tslActivated = false;
          ttpActivated = false;
          tslLevel     = 0;
          ttpLevel     = 0;
          troughPrice  = Infinity;
        }
      }
    }

    // ── Entry logic ────────────────────────────
    if (!inTrade) {
      // Run engine at this bar
      const result = engine.analyze(
        closeSlice,
        highSlice,
        lowSlice,
        volSlice,
        timeframe,
        "normal",
        0, // funding rate not available in backtest
        { tradeMode: "Scalp", mtfThreshold: params.pilot_mtf_threshold },
        openSlice,
      );

      // Basic AI threshold filter
      if ((result.aiScore ?? 0) < params.ai_threshold) continue;

      // F4 mandate
      const f4Active = !!(result.f4EarlyBuy || result.f4ConfirmedBuy || result.f4EarlySell || result.f4ConfirmedSell);
      if (!f4Active) continue;

      if (result.signal === "BUY") {
        inTrade      = true;
        tradeSide    = "LONG";
        tradeEntry   = currentClose;
        tradeEntryIdx = i;
        peakPrice    = currentHigh;
        troughPrice  = Infinity;
        tslLevel     = tradeEntry * (1 - params.pilot_sl_deviation / 100);
        tslActivated = params.pilot_sl_trailing;
        ttpLevel     = 0;
        ttpActivated = false;
      } else if (result.signal === "SELL") {
        inTrade      = true;
        tradeSide    = "SHORT";
        tradeEntry   = currentClose;
        tradeEntryIdx = i;
        peakPrice    = 0;
        troughPrice  = currentLow;
        tslLevel     = tradeEntry * (1 + params.pilot_sl_deviation / 100);
        tslActivated = params.pilot_sl_trailing;
        ttpLevel     = Infinity;
        ttpActivated = false;
      }
    }
  }

  // Force-close any open trade at last bar
  if (inTrade && closes.length > 0) {
    const lastClose = closes[closes.length - 1];
    const pnlPct =
      tradeSide === "LONG"
        ? ((lastClose - tradeEntry) / tradeEntry) * 100
        : ((tradeEntry - lastClose) / tradeEntry) * 100;
    trades.push({
      symbol,
      side: tradeSide,
      entryPrice: tradeEntry,
      exitPrice: lastClose,
      entryIndex: tradeEntryIdx,
      exitIndex: closes.length - 1,
      pnlPct,
      exitReason: "END",
    });
  }

  return computeMetrics(symbol, timeframe, params, trades, closes.length, Date.now() - startMs);
}

// ────────────────────────────────────────────────
// Metrics computation
// ────────────────────────────────────────────────

function computeMetrics(
  symbol: string,
  timeframe: string,
  params: BacktestParams,
  trades: BacktestTrade[],
  totalCandles: number,
  runDurationMs: number,
): BacktestResult {
  const totalTrades = trades.length;

  if (totalTrades === 0) {
    return emptyResult(symbol, timeframe, params, runDurationMs, totalCandles);
  }

  const wins  = trades.filter((t) => t.pnlPct > 0);
  const loses = trades.filter((t) => t.pnlPct <= 0);

  const win_rate    = (wins.length / totalTrades) * 100;
  const total_pnl   = trades.reduce((s, t) => s + t.pnlPct, 0);
  const avg_win     = wins.length > 0  ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length   : 0;
  const avg_loss    = loses.length > 0 ? loses.reduce((s, t) => s + t.pnlPct, 0) / loses.length : 0;

  const gross_profit = wins.reduce((s, t) => s + t.pnlPct, 0);
  const gross_loss   = Math.abs(loses.reduce((s, t) => s + t.pnlPct, 0));
  const profit_factor = gross_loss > 0 ? gross_profit / gross_loss : gross_profit > 0 ? 10 : 0;

  // Max drawdown: equity curve peak-to-trough
  let equity = 0;
  let peak   = 0;
  let max_dd = 0;
  for (const t of trades) {
    equity += t.pnlPct;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > max_dd) max_dd = dd;
  }

  // Simplified Sharpe: mean(pnl) / std(pnl)
  const mean_pnl = total_pnl / totalTrades;
  const variance =
    trades.reduce((s, t) => s + Math.pow(t.pnlPct - mean_pnl, 2), 0) / totalTrades;
  const std_dev      = Math.sqrt(variance);
  const sharpe_ratio = std_dev > 0 ? (mean_pnl / std_dev) * Math.sqrt(252) : 0; // annualised

  // Composite score (0–100)
  // Normalize each component to 0-1:
  //   win_rate: 0-100 → 0-1
  //   sharpe:   -3 to +3 → 0-1 (clamp)
  //   profit_factor: 0-4 → 0-1 (clamp)
  //   drawdown penalty: higher dd = lower score
  const wrNorm  = Math.min(win_rate / 100, 1);
  const srNorm  = Math.min(Math.max((sharpe_ratio + 3) / 6, 0), 1);
  const pfNorm  = Math.min(profit_factor / 4, 1);
  const ddPen   = Math.max(1 - max_dd / 50, 0); // 50% dd = 0 score

  const composite_score =
    (wrNorm * 0.35 + srNorm * 0.30 + pfNorm * 0.25 + ddPen * 0.10) * 100;

  return {
    params,
    symbol,
    timeframe,
    totalCandles,
    trades,
    totalTrades,
    winTrades: wins.length,
    loseTrades: loses.length,
    win_rate,
    total_pnl_pct: total_pnl,
    avg_win_pct: avg_win,
    avg_loss_pct: avg_loss,
    profit_factor,
    max_drawdown: max_dd,
    sharpe_ratio,
    composite_score,
    runDurationMs,
  };
}

function emptyResult(
  symbol: string,
  timeframe: string,
  params: BacktestParams,
  runDurationMs: number,
  totalCandles = 0,
): BacktestResult {
  return {
    params,
    symbol,
    timeframe,
    totalCandles,
    trades: [],
    totalTrades: 0,
    winTrades: 0,
    loseTrades: 0,
    win_rate: 0,
    total_pnl_pct: 0,
    avg_win_pct: 0,
    avg_loss_pct: 0,
    profit_factor: 0,
    max_drawdown: 0,
    sharpe_ratio: 0,
    composite_score: 0,
    runDurationMs,
  };
}
