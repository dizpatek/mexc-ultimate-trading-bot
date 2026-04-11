/**
 * autoResearch.ts — MexC AutoResearch Ana Ajan Döngüsü
 *
 * Bu script gece çalışır. Her döngüde:
 * 1. Parametre seti üret (Random → HillClimb → UCB)
 * 2. BTCUSDT + ETHUSDT üzerinde backtest çalıştır
 * 3. Composite score hesapla
 * 4. Eğer en iyiden iyiyse → kaydet + is_best işaretle
 * 5. Log yaz
 * 6. 30 saniye bekle (API rate limit koruma) ve tekrarla
 *
 * Çalıştırma: npx tsx --import dotenv/config scripts/autoResearch.ts
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { runBacktest } from "../../src/lib/backtester";
import type { BacktestParams, BacktestResult } from "../../src/lib/backtester";
import {
  nextParams,
  DEFAULT_PARAMS,
  getSearchPhase,
  UCBEntry,
} from "../../src/lib/parameterMutator";
import {
  initAutoResearchTable,
  insertAutoResearchExperiment,
  markNewBestExperiment,
  getBestExperiment,
  getBotConfig,
  logSystemMessage,
} from "../../src/lib/db";

// ─── Configuration ──────────────────────────────────────────────────────────

let SYMBOLS: string[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]; 
let TIMEFRAME: any    = "4h";                      
const LOOP_DELAY = 30_000;                             // ms — döngüler arası bekleme
const MAX_EXP    = process.env.MAX_EXPERIMENTS
  ? parseInt(process.env.MAX_EXPERIMENTS)
  : Infinity;                                          // Sınırsız (gece modu)

// ─── State ──────────────────────────────────────────────────────────────────

let experimentCount = 0;
let bestScore       = 0;
let bestParams: BacktestParams | null = null;
const ucbPool: UCBEntry[] = [];
let totalUCBVisits = 0;
let runId          = randomUUID();      // Tek oturum UUID'si
let shutdownFlag   = false;

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

process.on("SIGINT",  () => { shutdownFlag = true; console.log("\n🛑 Graceful shutdown isteği alındı..."); });
process.on("SIGTERM", () => { shutdownFlag = true; });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2) {
  return n.toFixed(dec);
}

function colorScore(score: number): string {
  if (score >= 70) return `\x1b[32m${fmt(score)}\x1b[0m`; // green
  if (score >= 50) return `\x1b[33m${fmt(score)}\x1b[0m`; // yellow
  return `\x1b[31m${fmt(score)}\x1b[0m`;                  // red
}

function logHeader() {
  const header = `
# 📡 RESEARCH LIVE LOGS (Canlı Araştırma Akışı)

> Durum: **AKTİF**  |  Run ID: \`${runId}\`
> Semboller: ${SYMBOLS.join(", ")}  |  Timeframe: ${TIMEFRAME}

---

| Zaman | Deney # | Faz | Skor | Win Rate | Sharpe | PF | MaxDD | İşlem |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;
  fs.writeFileSync(path.join(process.cwd(), "RESEARCH_LIVE_LOGS.md"), header);

  console.log("\n" + "═".repeat(80));
  console.log("  🤖 MexC AutoResearch — Otonom Trading Parametre Optimizasyon Sistemi");
  console.log(`  Run ID: ${runId}`);
  console.log(`  Semboller: ${SYMBOLS.join(", ")}  |  Timeframe: ${TIMEFRAME}`);
  console.log("═".repeat(80) + "\n");
}

function logExperiment(
  expNum: number,
  phase: string,
  result: BacktestResult,
  isBest: boolean,
) {
  const tag  = isBest ? "✨ YENİ EN İYİ" : "   ";
  const time = new Date().toLocaleTimeString("tr-TR");

  // Obsidian Log (Markdown Table Row)
  const obsidianRow = `| ${time} | #${String(expNum).padStart(4, "0")} | ${phase} | **${fmt(result.composite_score)}** | %${fmt(result.win_rate)} | ${fmt(result.sharpe_ratio)} | ${fmt(result.profit_factor)} | %${fmt(result.max_drawdown)} | ${result.totalTrades} | ${isBest ? "✨" : ""} \n`;
  fs.appendFileSync(path.join(process.cwd(), "RESEARCH_LIVE_LOGS.md"), obsidianRow);

  console.log(
    `[${time}] #${String(expNum).padStart(4, "0")} ${tag} | ` +
    `Faz: ${phase.padEnd(10)} | ` +
    `Skor: ${colorScore(result.composite_score)} | ` +
    `Win: %${fmt(result.win_rate)} | ` +
    `Sharpe: ${fmt(result.sharpe_ratio)} | ` +
    `PF: ${fmt(result.profit_factor)} | ` +
    `MaxDD: %${fmt(result.max_drawdown)} | ` +
    `İşlem: ${result.totalTrades}`
  );
}

// ─── Core Backtest Runner ────────────────────────────────────────────────────

/**
 * Birden fazla sembol üzerinde backtest yapıp ortalama score döndürür.
 */
async function evaluateParams(params: BacktestParams): Promise<BacktestResult> {
  const results = await Promise.allSettled(
    SYMBOLS.map((sym) => runBacktest(sym, TIMEFRAME, params))
  );

  // Başarılı sonuçları topla
  const valid: BacktestResult[] = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<BacktestResult>).value);

  if (valid.length === 0) {
    // Tümü başarısız → sıfır sonuç döndür
    return {
      params,
      symbol: SYMBOLS.join(","),
      timeframe: TIMEFRAME,
      totalCandles: 0,
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
      runDurationMs: 0,
    };
  }

  // Ortalamaları hesapla
  const avg = (fn: (r: BacktestResult) => number) =>
    valid.reduce((s, r) => s + fn(r), 0) / valid.length;

  return {
    ...valid[0],
    symbol: SYMBOLS.join(","),
    totalTrades:     Math.round(avg((r) => r.totalTrades)),
    winTrades:       Math.round(avg((r) => r.winTrades)),
    loseTrades:      Math.round(avg((r) => r.loseTrades)),
    win_rate:        avg((r) => r.win_rate),
    total_pnl_pct:   avg((r) => r.total_pnl_pct),
    avg_win_pct:     avg((r) => r.avg_win_pct),
    avg_loss_pct:    avg((r) => r.avg_loss_pct),
    profit_factor:   avg((r) => r.profit_factor),
    max_drawdown:    avg((r) => r.max_drawdown),
    sharpe_ratio:    avg((r) => r.sharpe_ratio),
    composite_score: avg((r) => r.composite_score),
    runDurationMs:   valid.reduce((s, r) => s + r.runDurationMs, 0),
  };
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function main() {
  logHeader();

  // DB tablosunu başlat (yoksa oluştur)
  try {
    await initAutoResearchTable();
  } catch (e) {
    console.error("❌ DB init hatası:", e);
    process.exit(1);
  }

  // Önceden kaydedilmiş en iyi parametreyi yükle
  try {
    const savedBest = await getBestExperiment();
    if (savedBest) {
      bestParams = savedBest.params as unknown as BacktestParams;
      bestScore  = savedBest.composite_score;
      console.log(`📂 Önceki en iyi yüklendi: Skor=${fmt(bestScore)}`);
    } else {
      bestParams = DEFAULT_PARAMS;
      console.log("🚀 Yeni çalışma — varsayılan parametrelerle başlıyorum.");
    }
  } catch (e) {
    bestParams = DEFAULT_PARAMS;
    console.warn("⚠️ Önceki en iyi yüklenemedi, defaults ile devam:", e);
  }

  console.log(`\n${"─".repeat(80)}`);
  console.log(" #     Faz        Skor  WinRate  Sharpe   PF     MaxDD  İşlem");
  console.log("─".repeat(80));

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  await logSystemMessage("🚀 AutoResearch Otonom Ajan Başlatıldı.");

  while (!shutdownFlag && experimentCount < MAX_EXP) {
    // 1️⃣ Web Arayüzünden Gelen Dinamik Ayarları Oku
    try {
      const conf = await getBotConfig(1);
      if (conf?.timeframe_settings) {
        const ts = conf.timeframe_settings as any;
        if (ts.ar_symbols && Array.isArray(ts.ar_symbols) && ts.ar_symbols.length > 0) {
          SYMBOLS = ts.ar_symbols;
        }
        if (ts.ar_timeframe && typeof ts.ar_timeframe === "string") {
          TIMEFRAME = ts.ar_timeframe;
        }
        if (ts.ar_is_running === false) {
          console.log("⏸️ AutoResearch Web Arayüzü üzerinden DURDURULDU. Bekleniyor...");
          await sleep(10000); 
          continue;
        }

        if (ts.ar_phase && typeof ts.ar_phase === "string") {
          if (ts.ar_phase !== "auto") {
            (global as any).forcePhase = ts.ar_phase;
          } else {
            (global as any).forcePhase = null;
          }
        }
      }
    } catch (e) {
      // sessiz devam
    }

    experimentCount++;
    const phase  = (global as any).forcePhase || getSearchPhase(experimentCount);
    const params = nextParams(experimentCount, bestParams, ucbPool, totalUCBVisits);

    let result: BacktestResult;
    try {
      result = await evaluateParams(params);
    } catch (e) {
      console.error(`[#${experimentCount}] Backtest hatası:`, e);
      await sleep(LOOP_DELAY);
      continue;
    }

    const score   = result.composite_score;
    const isBest  = score > bestScore;

    // UCB pool güncelle
    const existingEntry = ucbPool.find(
      (e) => JSON.stringify(e.params) === JSON.stringify(params)
    );
    if (existingEntry) {
      existingEntry.visits++;
      existingEntry.totalScore += score;
      existingEntry.score = score;
    } else {
      ucbPool.push({ params, score, visits: 1, totalScore: score });
      if (ucbPool.length > 50) ucbPool.shift(); // pool boyutunu sınırla
    }
    totalUCBVisits++;

    // DB'ye kaydet
    let expId: number | null = null;
    try {
      expId = await insertAutoResearchExperiment({
        run_id:          runId,
        params:          params as unknown as Record<string, unknown>,
        composite_score: score,
        win_rate:        result.win_rate,
        sharpe:          result.sharpe_ratio,
        profit_factor:   result.profit_factor,
        max_drawdown:    result.max_drawdown,
        total_trades:    result.totalTrades,
        total_pnl_pct:   result.total_pnl_pct,
        timeframe:       TIMEFRAME,
        symbol:          result.symbol,
        search_phase:    phase,
        is_best:         isBest,
        created_at:      Date.now(),
      });

      if (isBest && expId) {
        await markNewBestExperiment(expId);
        bestScore  = score;
        bestParams = params;
        await logSystemMessage(
          `🏆 [AutoResearch] Yeni Rekor Skor!`,
          `Skor: ${score.toFixed(2)} | Profit: %${result.total_pnl_pct.toFixed(2)} | P: ${JSON.stringify(params)}`,
          'POSITIVE'
        );
      }
    } catch (e) {
      console.error(`[#${experimentCount}] DB kayıt hatası:`, e);
    }

    logExperiment(experimentCount, phase, result, isBest);

    // Her 10 deneyde bir özet göster
    if (experimentCount % 10 === 0) {
      console.log(`\n📊 ${experimentCount} deney tamamlandı. En iyi skor: ${colorScore(bestScore)}\n`);
    }

    if (!shutdownFlag) {
      await sleep(LOOP_DELAY);
    }
  }

  console.log("\n✅ AutoResearch döngüsü tamamlandı.");
  console.log(`📈 Toplam deney: ${experimentCount}`);
  console.log(`🏆 En iyi composite score: ${fmt(bestScore)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Fatal hatası:", e);
  process.exit(1);
});
