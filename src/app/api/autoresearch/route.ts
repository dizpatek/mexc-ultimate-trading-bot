/**
 * API Route: /api/autoresearch
 * GET  → Deney listesi + en iyi parametreler
 * POST → Aksiyon: start / stop / apply_best
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listAutoResearchExperiments,
  getBestExperiment,
  getBestExperimentsPerTimeframe,
  getBotConfig,
  updateBotConfig,
  sql,
} from "@/lib/db";
import type { BotConfig } from "@/lib/db";
import type { BacktestParams } from "@/lib/backtester";

export const dynamic = "force-dynamic";

// ─── YARDİMCI: Backtest params'tan gelen ham değerleri kesin tipe dönüştürür ─────
// IEEE-754 floating-point hatasını önler (11.100000000000001 → 11.1)
// JSONB'den gelen boolean'ları (0/1/"true") Boolean'a çevirir
function sanitizeParams(params: BacktestParams) {
  return {
    // — Yüzdeler: 2 ondalık basamak
    pilot_tp_percent: parseFloat(params.pilot_tp_percent.toFixed(2)),
    pilot_sl_percent: parseFloat(params.pilot_sl_percent.toFixed(2)),
    cover_tp_percent: parseFloat(params.cover_tp_percent.toFixed(2)),
    cover_sl_percent: parseFloat(params.cover_sl_percent.toFixed(2)),
    // — Deviation'lar: 4 ondalık basamak
    pilot_tp_deviation: parseFloat(params.pilot_tp_deviation.toFixed(4)),
    pilot_sl_deviation: parseFloat(params.pilot_sl_deviation.toFixed(4)),
    cover_tp_deviation: parseFloat(params.cover_tp_deviation.toFixed(4)),
    cover_sl_deviation: parseFloat(params.cover_sl_deviation.toFixed(4)),
    // — Multiplier'lar: 2 ondalık basamak
    f4_multiplier: parseFloat(params.f4_multiplier.toFixed(2)),
    whale_multiplier: parseFloat(params.whale_multiplier.toFixed(2)),
    // — Eğim: 6 ondalık basamak (0.0005 gibi küçük değerler için)
    f4_slope_threshold: parseFloat(params.f4_slope_threshold.toFixed(6)),
    // — Integer değerler
    ai_threshold: Math.round(params.ai_threshold),
    f4_length: Math.round(params.f4_length),
    f4_lookback_bars: Math.round(params.f4_lookback_bars),
    f4_squeeze_threshold: Math.round(params.f4_squeeze_threshold),
    min_power_loss: Math.round(params.min_power_loss),
    f4_power_loss_threshold: Math.round(params.f4_power_loss_threshold),
    pilot_mtf_threshold: Math.round(params.pilot_mtf_threshold),
    pilot_mtf_long_threshold: Math.round(params.pilot_mtf_long_threshold),
    pilot_mtf_short_threshold: Math.round(params.pilot_mtf_short_threshold),
    trade_freshness_bars: Math.round(params.trade_freshness_bars),
    pilot_trade_allocation: Math.round(params.pilot_trade_allocation),
    rsi_period: Math.round(params.rsi_period ?? 14),
    rsi_ob: Math.round(params.rsi_ob ?? 70),
    rsi_os: Math.round(params.rsi_os ?? 30),
    adx_threshold: Math.round(params.adx_threshold ?? 25),
    macd_fast: Math.round(params.macd_fast ?? 12),
    macd_slow: Math.round(params.macd_slow ?? 26),
    macd_signal: Math.round(params.macd_signal ?? 9),
    stoch_rsi_len: Math.round(params.stoch_rsi_len ?? 14),
    // — Boolean değerler: JSONB'den gelen 0/1/"true"/"false" hepsini kapsıyor
    pilot_tp_trailing: !!params.pilot_tp_trailing,
    pilot_sl_trailing: !!params.pilot_sl_trailing,
    cover_tp_trailing: !!params.cover_tp_trailing,
    cover_sl_trailing: !!params.cover_sl_trailing,
    pilot_trailing_buy: !!params.pilot_trailing_buy,
    pilot_mtf_veto: !!params.pilot_mtf_veto,
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "200");

    const [experiments, best, perTfGrid] = await Promise.all([
      listAutoResearchExperiments(limit),
      getBestExperiment(),
      getBestExperimentsPerTimeframe(),
    ]);

    // UI'a göndermeden önce tüm sonuçları sanitize et (Hassasiyet temizliği)
    const cleanExperiments = experiments.map((exp) => ({
      ...exp,
      params: exp.params ? sanitizeParams(exp.params as any) : null,
    }));

    const cleanBest = best
      ? {
          ...best,
          params: best.params ? sanitizeParams(best.params as any) : null,
        }
      : null;

    const cleanPerTfGrid = perTfGrid.map((item) => ({
      ...item,
      params: item.params ? sanitizeParams(item.params as any) : null,
    }));

    return NextResponse.json({
      ok: true,
      experiments: cleanExperiments,
      best: cleanBest,
      per_tf_grid: cleanPerTfGrid,
      total: experiments.length,
    });
  } catch (e) {
    console.error("[AutoResearch API] GET error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { action: string; userId?: number };
    const { action, userId = 1 } = body;

    switch (action) {
      // Apply best parameters for a specific timeframe to BotConfig timeframe_settings
      case "apply_best_tf": {
        const { timeframe } = body as unknown as { timeframe: string };
        if (!timeframe)
          return NextResponse.json(
            { ok: false, error: "Timeframe belirtilmedi." },
            { status: 400 },
          );

        const best = await getBestExperiment(timeframe);
        if (!best) {
          return NextResponse.json(
            { ok: false, error: `${timeframe} için henüz en iyi deney yok.` },
            { status: 400 },
          );
        }

        const params = best.params as unknown as BacktestParams;
        const sp = sanitizeParams(params);
        const currentConfig = await getBotConfig(userId);

        // Map BacktestParams → TimeframeSettings
        const tfSettings = { ...(currentConfig.timeframe_settings || {}) };

        // Ensure tfSettings[timeframe] exists as an object
        const tfOverride = (tfSettings[timeframe] as any) || {};

        // Update with best parameters — all values are sanitized (no float imprecision, no bool corruption)
        tfOverride.ai_threshold = sp.ai_threshold;
        tfOverride.f4_length = sp.f4_length;
        tfOverride.f4_multiplier = sp.f4_multiplier;
        tfOverride.whale_multiplier = sp.whale_multiplier;
        tfOverride.f4_power_loss_threshold = sp.f4_power_loss_threshold;
        tfOverride.f4_lookback_bars = sp.f4_lookback_bars;
        tfOverride.f4_squeeze_threshold = sp.f4_squeeze_threshold;
        tfOverride.min_power_loss = sp.min_power_loss;
        tfOverride.f4_slope_threshold = sp.f4_slope_threshold;

        tfOverride.pilot_tp_percent = sp.pilot_tp_percent;
        tfOverride.pilot_sl_percent = sp.pilot_sl_percent;
        tfOverride.pilot_tp_trailing = sp.pilot_tp_trailing;
        tfOverride.pilot_tp_deviation = sp.pilot_tp_deviation;
        tfOverride.pilot_sl_trailing = sp.pilot_sl_trailing;
        tfOverride.pilot_sl_deviation = sp.pilot_sl_deviation;

        // Cover parameters
        tfOverride.cover_tp_percent = sp.cover_tp_percent;
        tfOverride.cover_sl_percent = sp.cover_sl_percent;
        tfOverride.cover_tp_trailing = sp.cover_tp_trailing;
        tfOverride.cover_tp_deviation = sp.cover_tp_deviation;
        tfOverride.cover_sl_trailing = sp.cover_sl_trailing;
        tfOverride.cover_sl_deviation = sp.cover_sl_deviation;

        // Pilot control parameters
        tfOverride.pilot_trailing_buy = sp.pilot_trailing_buy;
        tfOverride.pilot_trade_allocation = sp.pilot_trade_allocation;

        tfOverride.pilot_mtf_veto = sp.pilot_mtf_veto;
        tfOverride.pilot_mtf_threshold = sp.pilot_mtf_threshold;
        tfOverride.pilot_mtf_long_threshold = sp.pilot_mtf_long_threshold;
        tfOverride.pilot_mtf_short_threshold = sp.pilot_mtf_short_threshold;
        tfOverride.trade_freshness_bars = sp.trade_freshness_bars;

        // V2.1 Mapping (Engine Overrides)
        tfOverride.rsi_period = sp.rsi_period;
        tfOverride.rsi_ob = sp.rsi_ob;
        tfOverride.rsi_os = sp.rsi_os;
        tfOverride.adx_threshold = sp.adx_threshold;
        tfOverride.macd_fast = sp.macd_fast;
        tfOverride.macd_slow = sp.macd_slow;
        tfOverride.macd_signal = sp.macd_signal;
        tfOverride.stoch_rsi_len = sp.stoch_rsi_len;

        tfSettings[timeframe] = tfOverride;

        await updateBotConfig(userId, {
          timeframe_settings: tfSettings as any,
        });

        return NextResponse.json({
          ok: true,
          message: `✅ ${timeframe} için en iyi parametreler (Skor: ${best.composite_score.toFixed(1)}) Pilot presetlerine uygulandı.`,
          applied: tfOverride,
        });
      }

      // ── Tüm TF'lerin en iyi parametrelerini hem timeframe_settings[tf] hem de
      //    aktif pilot_timeframe'in parametrelerini root BotConfig'e yazar.
      //    Bu sayede pilot-executor.ts timeframe_settings'dan read etmeden de
      //    aktif TF'nin optimize edilmiş değerlerini kullanabilir.
      case "apply_all_tf": {
        const currentConfig = await getBotConfig(userId);
        const activePilotTf =
          (body as any).pilot_timeframe ||
          currentConfig.pilot_timeframe ||
          "4h";

        const allTfs = ["1m", "15m", "1h", "4h", "1d"];
        const tfSettings = { ...(currentConfig.timeframe_settings || {}) };

        let deployedCount = 0;
        let rootUpdate: Partial<BotConfig> | null = null;

        for (const tf of allTfs) {
          const best = await getBestExperiment(tf);
          if (!best) continue;

          const params = best.params as unknown as BacktestParams;
          const sp = sanitizeParams(params);
          const tfOverride = (tfSettings[tf] as any) || {};

          // Write all sanitized params into timeframe_settings[tf]
          tfOverride.ai_threshold = sp.ai_threshold;
          tfOverride.f4_length = sp.f4_length;
          tfOverride.f4_multiplier = sp.f4_multiplier;
          tfOverride.whale_multiplier = sp.whale_multiplier;
          tfOverride.f4_power_loss_threshold = sp.f4_power_loss_threshold;
          tfOverride.f4_lookback_bars = sp.f4_lookback_bars;
          tfOverride.f4_squeeze_threshold = sp.f4_squeeze_threshold;
          tfOverride.min_power_loss = sp.min_power_loss;
          tfOverride.f4_slope_threshold = sp.f4_slope_threshold;
          tfOverride.pilot_tp_percent = sp.pilot_tp_percent;
          tfOverride.pilot_sl_percent = sp.pilot_sl_percent;
          tfOverride.pilot_tp_trailing = sp.pilot_tp_trailing;
          tfOverride.pilot_tp_deviation = sp.pilot_tp_deviation;
          tfOverride.pilot_sl_trailing = sp.pilot_sl_trailing;
          tfOverride.pilot_sl_deviation = sp.pilot_sl_deviation;

          // Cover parameters
          tfOverride.cover_tp_percent = sp.cover_tp_percent;
          tfOverride.cover_sl_percent = sp.cover_sl_percent;
          tfOverride.cover_tp_trailing = sp.cover_tp_trailing;
          tfOverride.cover_tp_deviation = sp.cover_tp_deviation;
          tfOverride.cover_sl_trailing = sp.cover_sl_trailing;
          tfOverride.cover_sl_deviation = sp.cover_sl_deviation;

          // Pilot control parameters
          tfOverride.pilot_trailing_buy = sp.pilot_trailing_buy;
          tfOverride.pilot_trade_allocation = sp.pilot_trade_allocation;

          tfOverride.pilot_mtf_veto = sp.pilot_mtf_veto;
          tfOverride.pilot_mtf_threshold = sp.pilot_mtf_threshold;
          tfOverride.pilot_mtf_long_threshold = sp.pilot_mtf_long_threshold;
          tfOverride.pilot_mtf_short_threshold = sp.pilot_mtf_short_threshold;
          tfOverride.trade_freshness_bars = sp.trade_freshness_bars;
          tfOverride.rsi_period = sp.rsi_period;
          tfOverride.rsi_ob = sp.rsi_ob;
          tfOverride.rsi_os = sp.rsi_os;
          tfOverride.adx_threshold = sp.adx_threshold;
          tfOverride.macd_fast = sp.macd_fast;
          tfOverride.macd_slow = sp.macd_slow;
          tfOverride.macd_signal = sp.macd_signal;
          tfOverride.stoch_rsi_len = sp.stoch_rsi_len;

          tfSettings[tf] = tfOverride;
          deployedCount++;

          // If this is the active pilot TF, also write to root-level BotConfig
          if (tf === activePilotTf) {
            rootUpdate = {
              ai_threshold: sp.ai_threshold,
              f4_length: sp.f4_length,
              f4_multiplier: sp.f4_multiplier,
              whale_multiplier: sp.whale_multiplier,
              f4_power_loss_threshold: sp.f4_power_loss_threshold,
              f4_lookback_bars: sp.f4_lookback_bars,
              f4_squeeze_threshold: sp.f4_squeeze_threshold,
              min_power_loss: sp.min_power_loss,
              f4_slope_threshold: sp.f4_slope_threshold,
              pilot_tp_percent: sp.pilot_tp_percent,
              pilot_sl_percent: sp.pilot_sl_percent,
              pilot_tp_trailing: sp.pilot_tp_trailing,
              pilot_tp_deviation: sp.pilot_tp_deviation,
              pilot_sl_trailing: sp.pilot_sl_trailing,
              pilot_sl_deviation: sp.pilot_sl_deviation,
              cover_tp_percent: sp.cover_tp_percent,
              cover_sl_percent: sp.cover_sl_percent,
              cover_tp_trailing: sp.cover_tp_trailing,
              cover_tp_deviation: sp.cover_tp_deviation,
              cover_sl_trailing: sp.cover_sl_trailing,
              cover_sl_deviation: sp.cover_sl_deviation,
              pilot_trailing_buy: sp.pilot_trailing_buy,
              pilot_mtf_veto: sp.pilot_mtf_veto,
              pilot_mtf_threshold: sp.pilot_mtf_threshold,
              pilot_mtf_long_threshold: sp.pilot_mtf_long_threshold,
              pilot_mtf_short_threshold: sp.pilot_mtf_short_threshold,
              rsi_period: sp.rsi_period,
              rsi_ob: sp.rsi_ob,
              rsi_os: sp.rsi_os,
              adx_threshold: sp.adx_threshold,
              macd_fast: sp.macd_fast,
              macd_slow: sp.macd_slow,
              macd_signal: sp.macd_signal,
              stoch_rsi_len: sp.stoch_rsi_len,
            };

            // Flat keys for pilot-executor.ts
            tfSettings.pilot_tp_percent = sp.pilot_tp_percent;
            tfSettings.pilot_sl_percent = sp.pilot_sl_percent;
            tfSettings.pilot_tp_trailing = sp.pilot_tp_trailing;
            tfSettings.pilot_tp_deviation = sp.pilot_tp_deviation;
            tfSettings.pilot_sl_trailing = sp.pilot_sl_trailing;
            tfSettings.pilot_sl_deviation = sp.pilot_sl_deviation;

            // Cover flat keys for pilot-executor executeCover()
            tfSettings.cover_tp_percent = sp.cover_tp_percent;
            tfSettings.cover_sl_percent = sp.cover_sl_percent;
            tfSettings.cover_tp_trailing = sp.cover_tp_trailing;
            tfSettings.cover_tp_deviation = sp.cover_tp_deviation;
            tfSettings.cover_sl_trailing = sp.cover_sl_trailing;
            tfSettings.cover_sl_deviation = sp.cover_sl_deviation;

            // Pilot control flat keys
            tfSettings.pilot_trade_allocation = sp.pilot_trade_allocation;
          }
        }

        // Write all TF settings + root update in one call
        const finalUpdates: Partial<BotConfig> = {
          timeframe_settings: tfSettings as any,
          ...(rootUpdate || {}),
        };
        await updateBotConfig(userId, finalUpdates);

        return NextResponse.json({
          ok: true,
          message: `✅ ${deployedCount} zaman diliminin en iyi parametreleri Pilot'a uygulandı. Aktif pilot TF (${activePilotTf}) root config'e de yazıldı.`,
          deployedCount,
          activePilotTf,
          syncedToRoot: !!rootUpdate,
        });
      }

      // Legacy global best apply (Keep for root level defaults)
      case "apply_best": {
        const best = await getBestExperiment();
        if (!best) {
          return NextResponse.json(
            { ok: false, error: "Henüz en iyi deney yok." },
            { status: 400 },
          );
        }

        const params = best.params as unknown as BacktestParams;
        const sp = sanitizeParams(params);

        // Map BacktestParams → BotConfig update
        const updates: Partial<BotConfig> = {
          ai_threshold: sp.ai_threshold,
          f4_length: sp.f4_length,
          f4_multiplier: sp.f4_multiplier,
          whale_multiplier: sp.whale_multiplier,
          f4_power_loss_threshold: sp.f4_power_loss_threshold,
          f4_lookback_bars: sp.f4_lookback_bars,
          f4_squeeze_threshold: sp.f4_squeeze_threshold,
          min_power_loss: sp.min_power_loss,
          f4_slope_threshold: sp.f4_slope_threshold,
          pilot_tp_percent: sp.pilot_tp_percent,
          pilot_sl_percent: sp.pilot_sl_percent,
          pilot_tp_trailing: sp.pilot_tp_trailing,
          pilot_tp_deviation: sp.pilot_tp_deviation,
          pilot_sl_trailing: sp.pilot_sl_trailing,
          pilot_sl_deviation: sp.pilot_sl_deviation,
          cover_tp_percent: sp.cover_tp_percent,
          cover_sl_percent: sp.cover_sl_percent,
          cover_tp_trailing: sp.cover_tp_trailing,
          cover_tp_deviation: sp.cover_tp_deviation,
          cover_sl_trailing: sp.cover_sl_trailing,
          cover_sl_deviation: sp.cover_sl_deviation,
          pilot_trailing_buy: sp.pilot_trailing_buy,
          pilot_mtf_veto: sp.pilot_mtf_veto,
          pilot_mtf_threshold: sp.pilot_mtf_threshold,
          pilot_mtf_long_threshold: sp.pilot_mtf_long_threshold,
          pilot_mtf_short_threshold: sp.pilot_mtf_short_threshold,
          // V2.1 Global
          rsi_period: sp.rsi_period,
          rsi_ob: sp.rsi_ob,
          rsi_os: sp.rsi_os,
          adx_threshold: sp.adx_threshold,
          macd_fast: sp.macd_fast,
          macd_slow: sp.macd_slow,
          macd_signal: sp.macd_signal,
          stoch_rsi_len: sp.stoch_rsi_len,
        };

        await updateBotConfig(userId, updates);

        return NextResponse.json({
          ok: true,
          message: `✅ En iyi parametreler (Skor: ${best.composite_score.toFixed(1)}) BotConfig'e uygulandı.`,
          applied: updates,
        });
      }

      // Web arayüzünden AutoResearch parametrelerini ve pilot config'i güncelle
      case "update_config": {
        const {
          symbols,
          timeframe,
          is_running,
          phase,
          params: adaptiveParams,
        } = body as {
          symbols?: string;
          timeframe?: string;
          is_running?: boolean;
          phase?: string;
          params?: any;
        };
        const currentConfig = await getBotConfig(userId);
        if (!currentConfig)
          return NextResponse.json({
            ok: false,
            error: "Bot config not found.",
          });

        const tfSettings = currentConfig.timeframe_settings || {};
        if (symbols !== undefined)
          tfSettings.ar_symbols = symbols
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (timeframe !== undefined) tfSettings.ar_timeframe = timeframe;
        if (is_running !== undefined) tfSettings.ar_is_running = is_running;
        if (phase !== undefined)
          tfSettings.ar_phase = phase as
            | "auto"
            | "random"
            | "hillclimb"
            | "ucb";

        const updates: Partial<BotConfig> = {
          timeframe_settings: tfSettings as any,
        };

        // 🚀 Adaptif Parametreleri Root seviyesine entegre et (AI Raporundan Gelenler)
        if (adaptiveParams && typeof adaptiveParams === "object") {
          for (const key of Object.keys(adaptiveParams)) {
            if (
              !["is_running", "phase", "symbols", "timeframe"].includes(key)
            ) {
              (updates as any)[key] = adaptiveParams[key];
            }
          }
        }

        await updateBotConfig(userId, updates);

        return NextResponse.json({
          ok: true,
          message: "AutoResearch ayarları başarıyla güncellendi.",
        });
      }

      // Return current BotConfig for comparison
      case "current_config": {
        const config = await getBotConfig(userId);
        return NextResponse.json({ ok: true, config });
      }

      // Eksik parametreleri sıfırlamak veya eski test sonuçlarını silmek için
      case "clear_experiments": {
        await sql`DELETE FROM autoresearch_experiments`;
        return NextResponse.json({
          ok: true,
          message: "Tüm eski deney sonuçları başarıyla silindi.",
        });
      }

      default:
        return NextResponse.json(
          { ok: false, error: `Bilinmeyen aksiyon: ${action}` },
          { status: 400 },
        );
    }
  } catch (e) {
    console.error("[AutoResearch API] POST error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
