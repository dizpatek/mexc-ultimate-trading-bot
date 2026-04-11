/**
 * API Route: /api/autoresearch
 * GET  → Deney listesi + en iyi parametreler
 * POST → Aksiyon: start / stop / apply_best
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listAutoResearchExperiments,
  getBestExperiment,
  getBotConfig,
  updateBotConfig,
} from "@/lib/db";
import type { BotConfig } from "@/lib/db";
import type { BacktestParams } from "@/lib/backtester";

export const dynamic = "force-dynamic";

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "200");

    const [experiments, best] = await Promise.all([
      listAutoResearchExperiments(limit),
      getBestExperiment(),
    ]);

    return NextResponse.json({
      ok: true,
      experiments,
      best,
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
    const body = await req.json() as { action: string; userId?: number };
    const { action, userId = 1 } = body;

    switch (action) {
      // Apply best parameters to live BotConfig (TEST mode only)
      case "apply_best": {
        const best = await getBestExperiment();
        if (!best) {
          return NextResponse.json({ ok: false, error: "Henüz en iyi deney yok." }, { status: 400 });
        }

        const params = best.params as unknown as BacktestParams;

        // Map BacktestParams → BotConfig update
        const updates: Partial<BotConfig> = {
          ai_threshold:            Math.round(params.ai_threshold),
          f4_length:               Math.round(params.f4_length),
          f4_multiplier:           params.f4_multiplier,
          whale_multiplier:        params.whale_multiplier,
          f4_power_loss_threshold: params.f4_power_loss_threshold,
          f4_lookback_bars:        Math.round(params.f4_lookback_bars),
          f4_squeeze_threshold:    params.f4_squeeze_threshold,
          min_power_loss:          params.min_power_loss,
          f4_slope_threshold:      params.f4_slope_threshold,
          pilot_tp_trailing:       params.pilot_tp_trailing,
          pilot_tp_deviation:      params.pilot_tp_deviation,
          pilot_sl_trailing:       params.pilot_sl_trailing,
          pilot_sl_deviation:      params.pilot_sl_deviation,
          pilot_mtf_veto:          params.pilot_mtf_veto,
          pilot_mtf_threshold:     Math.round(params.pilot_mtf_threshold),
          pilot_mtf_long_threshold: Math.round(params.pilot_mtf_long_threshold),
          pilot_mtf_short_threshold: Math.round(params.pilot_mtf_short_threshold),
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
        const { symbols, timeframe, is_running, phase, params: adaptiveParams } = body as { symbols?: string; timeframe?: string; is_running?: boolean; phase?: string; params?: any };
        const currentConfig = await getBotConfig(userId);
        if (!currentConfig) return NextResponse.json({ ok: false, error: "Bot config not found." });

        const tfSettings = currentConfig.timeframe_settings || {};
        if (symbols !== undefined) tfSettings.ar_symbols = symbols.split(",").map(s => s.trim()).filter(Boolean);
        if (timeframe !== undefined) tfSettings.ar_timeframe = timeframe;
        if (is_running !== undefined) tfSettings.ar_is_running = is_running;
        if (phase !== undefined) tfSettings.ar_phase = phase as "auto" | "random" | "hillclimb" | "ucb";

        const updates: Partial<BotConfig> = { timeframe_settings: tfSettings as any };
        
        // 🚀 Adaptif Parametreleri Root seviyesine entegre et (AI Raporundan Gelenler)
        if (adaptiveParams && typeof adaptiveParams === "object") {
           for (const key of Object.keys(adaptiveParams)) {
              if (!['is_running', 'phase', 'symbols', 'timeframe'].includes(key)) {
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

      default:
        return NextResponse.json({ ok: false, error: `Bilinmeyen aksiyon: ${action}` }, { status: 400 });
    }
  } catch (e) {
    console.error("[AutoResearch API] POST error:", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
