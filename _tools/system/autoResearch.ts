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
import { askAiForStrategicInsight, logAiInsightToWiki } from "../../src/lib/aiInsight";
import { setAiSearchHint, nextParams as _nextParams, SearchPhase } from "../../src/lib/parameterMutator";
import { runKnowledgeHunter } from "../../src/crons/knowledge-hunter";
import { runRLAIFSynthesizer } from "../../src/crons/rlaif-synthesizer";
import { runAutoDeveloperCycle } from "./agent-developer";

// ─── Configuration ──────────────────────────────────────────────────────────

let SYMBOLS: string[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]; 
let TIMEFRAME: any    = "4h";                      
const LOOP_DELAY = 30_000;                             // ms — döngüler arası bekleme
const MAX_EXP    = process.env.MAX_EXPERIMENTS
  ? parseInt(process.env.MAX_EXPERIMENTS)
  : Infinity;                                          // Sınırsız (gece modu)
const AI_INSIGHT_INTERVAL = 10;                        // Her kaç deneyde bir AI analizi yapılsın

// ─── State ──────────────────────────────────────────────────────────────────

let experimentCount = 0;
let bestScore       = 0;
let bestParams: BacktestParams | null = null;
const ucbPool: UCBEntry[] = [];
let totalUCBVisits = 0;
let runId          = randomUUID();
let shutdownFlag   = false;
const recentExperimentsForAI: Array<{ score: number; win_rate: number; params: any; phase: string }> = [];
let aiGuidedCountdown = 0; // AI insight sonrası kaç deney ai_guided modda çalışsın

// MTF Scheduler State
const SUPPORTED_TIMEFRAMES = ["1m", "15m", "1h", "4h", "1d"];
let tfIndex = 0;

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

process.on("SIGINT",  () => { shutdownFlag = true; console.log("\n🛑 Graceful shutdown isteği alındı..."); });
process.on("SIGTERM", () => { shutdownFlag = true; });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2) {
  if (typeof n !== "number") return "0.00";
  return parseFloat(n.toFixed(dec)).toString(); 
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
  fs.writeFileSync(path.join(__dirname, "RESEARCH_LIVE_LOGS.md"), header);

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

// ─── Concurrent TF States — Her TF bağımsız evrilir ──────────────────────────
const supports = ["1m", "15m", "1h", "4h", "1d"];
const tfStates: Record<string, {
  count: number;
  bestScore: number;
  bestParams: BacktestParams | null;
  ucbPool: UCBEntry[];
  totalUCBVisits: number;
  aiGuidedCountdown: number;
}> = {};

// init states
supports.forEach(tf => {
  tfStates[tf] = {
    count: 0,
    bestScore: 0,
    bestParams: null,
    ucbPool: [],
    totalUCBVisits: 0,
    aiGuidedCountdown: 0
  };
});

// ─── Single TF Processor ─────────────────────────────────────────────────────

async function processTimeframeBatch(tf: string) {
  const state = tfStates[tf];
  
  // 🏆 Bu timeframe için mevcut en iyiyi DB'den (veya memory'den) yükle
  if (!state.bestParams || state.count === 0) {
    try {
      const dbBest = await getBestExperiment(tf);
      if (dbBest) {
        state.bestParams = dbBest.params as unknown as BacktestParams;
        state.bestScore  = dbBest.composite_score;
      } else {
        state.bestParams = DEFAULT_PARAMS;
      }
    } catch (e) {
      state.bestParams = DEFAULT_PARAMS;
    }
  }

  state.count++;
  experimentCount++; // Global count for AI triggers

  // Faz belirleme: AI insight sonrası ai_guided, diğerinde normal
  let forcedPhase: SearchPhase | undefined;
  if (state.aiGuidedCountdown > 0) {
    forcedPhase = "ai_guided";
    state.aiGuidedCountdown--;
  }
  
  const phase  = (global as any).forcePhase || forcedPhase || getSearchPhase(state.count);
  const params = _nextParams(state.count, state.bestParams!, state.ucbPool, state.totalUCBVisits, forcedPhase);

  try {
    const result = await evaluateParamsParallel(tf, params);
    const score = result.composite_score;
    const isBest = score > state.bestScore;

    if (score === 0) {
      // Sessiz kal (Kullanıcı kirliliği önlemek istiyor)
    }

    // UCB pool güncelle
    const existingEntry = state.ucbPool.find(
      (e) => JSON.stringify(e.params) === JSON.stringify(params)
    );
    if (existingEntry) {
      existingEntry.visits++;
      existingEntry.totalScore += score;
      existingEntry.score = score;
    } else {
      state.ucbPool.push({ params, score, visits: 1, totalScore: score });
      if (state.ucbPool.length > 50) state.ucbPool.shift();
    }
    state.totalUCBVisits++;

    // DB'ye kaydet
    const expId = await insertAutoResearchExperiment({
      run_id:          runId,
      params:          params as unknown as Record<string, unknown>,
      composite_score: score,
      win_rate:        result.win_rate,
      sharpe:          result.sharpe_ratio,
      profit_factor:   result.profit_factor,
      max_drawdown:    result.max_drawdown,
      total_trades:    result.totalTrades,
      total_pnl_pct:   result.total_pnl_pct,
      timeframe:       tf,
      symbol:          result.symbol,
      search_phase:    phase,
      is_best:         isBest && score > 0, 
      created_at:      Date.now(),
    });

    if (isBest && score > 0 && expId) {
      await markNewBestExperiment(expId, tf);
      state.bestScore  = score;
      state.bestParams = params;
      // Global best score for UI console summary
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
      }

      await logSystemMessage(
        `🏆 [AutoResearch] ${tf} İçin Yeni Rekor!`,
        `Skor: ${score.toFixed(2)} | PF: ${result.profit_factor.toFixed(2)}`,
        'POSITIVE'
      );
    }

    logExperimentPrefix(tf, state.count, phase, result, isBest);
    recentExperimentsForAI.push({ score, win_rate: result.win_rate, params, phase });
    if (recentExperimentsForAI.length > 50) recentExperimentsForAI.shift();

  } catch (e) {
    console.error(`[${tf}] İşlem Hatası:`, e);
  }
}

async function evaluateParamsParallel(tf: string, params: BacktestParams): Promise<BacktestResult> {
  const results = await Promise.allSettled(
    SYMBOLS.map((sym) => runBacktest(sym, tf as any, params))
  );

  const valid: BacktestResult[] = results
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<BacktestResult>).value);

  if (valid.length === 0) {
    return {
      params, symbol: SYMBOLS.join(","), timeframe: tf, totalCandles: 0,
      trades: [], totalTrades: 0, winTrades: 0, loseTrades: 0, win_rate: 0,
      total_pnl_pct: 0, avg_win_pct: 0, avg_loss_pct: 0, profit_factor: 0,
      max_drawdown: 0, sharpe_ratio: 0, composite_score: 0, runDurationMs: 0,
    };
  }

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

function logExperimentPrefix(tf: string, expNum: number, phase: string, result: BacktestResult, isBest: boolean) {
  // Hiç işlem yapılmamışsa terminale BASMA (Kritik: Terminal kirliliğini önlemek için)
  if (result.totalTrades === 0) return;
  if (!isBest && result.composite_score < 0.1) return;

  const tag  = isBest ? "✨" : "  ";
  const time = new Date().toLocaleTimeString("tr-TR");
  const row = `| ${time} | ${tf.padEnd(4)} | #${String(expNum).padStart(4, "0")} | ${phase} | **${fmt(result.composite_score)}** | %${fmt(result.win_rate)} | ${fmt(result.profit_factor)} | ${isBest ? "✨" : ""} \n`;
  fs.appendFileSync(path.join(process.cwd(), "RESEARCH_LIVE_LOGS.md"), row);

  console.log(
    `[${time}] ${tf.padEnd(3)} #${String(expNum).padStart(4, "0")} ${tag} | ` +
    `Skor: ${colorScore(result.composite_score)} | ` +
    `Win: %${fmt(result.win_rate)} | PF: ${fmt(result.profit_factor)} | ` +
    `Trades: ${result.totalTrades}`
  );
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function main() {
  logHeader();
  try { await initAutoResearchTable(); } catch (e) { process.exit(1); }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  await logSystemMessage("🚀 AutoResearch MTF Paralel Batch Motoru Başlatıldı.");
  
  console.log(">> Başlangıç Bilgi Avı (Knowledge Hunting) tetikleniyor...");
  await runKnowledgeHunter();

  while (!shutdownFlag && experimentCount < MAX_EXP) {
    // 1️⃣ Global Konfigürasyon Oku
    try {
      const conf = await getBotConfig(1);
      if (conf?.timeframe_settings) {
        const ts = conf.timeframe_settings as any;
        if (ts.ar_is_running !== true) {
          console.log("⏸️ AutoResearch DURDURULDU (Panelden Başlatılmasını Bekliyor)...");
          await sleep(10000); continue;
        }
        if (ts.ar_symbols && Array.isArray(ts.ar_symbols) && ts.ar_symbols.length > 0) {
          SYMBOLS = ts.ar_symbols.map((s: string) => s.endsWith("USDT") ? s : `${s}USDT`);
        }
      }
    } catch (e) {}

    console.log(`\n🌀 Batch Başlatılıyor (Tüm TF'ler Paralel)... [Global Deney: ${experimentCount}]\n`);
    
    // 2️⃣ MTF PARALEL BATCH ÇALIŞTIR
    // Tüm desteklenen timeframe'leri aynı anda ateşle
    await Promise.allSettled(supports.map(tf => processTimeframeBatch(tf)));

    // ── Global Karpathy Döngüsü & Crons ──
    if (experimentCount > 0 && experimentCount % (AI_INSIGHT_INTERVAL * 7) === 0) {
      try {
        console.log("\n>>> YZ Strateji Analizi Başlatılıyor (Global Insight)...\n");
        // Rastgele bir TF'deki bestParams kullanabiliriz veya global state'teki en yüksek skorluyu
        const insight = await askAiForStrategicInsight({
          best_params:     bestParams as any,
          best_score:      bestScore,
          recent_results:  recentExperimentsForAI,
        });
        setAiSearchHint(insight);
        supports.forEach(tf => tfStates[tf].aiGuidedCountdown = 5);
        logAiInsightToWiki(insight, runId);
        await logSystemMessage("🤖 AI Araştırma Raporu", insight.substring(0, 500), "POSITIVE");
        
        if (experimentCount % 350 === 0) await runKnowledgeHunter();
        if (experimentCount % 700 === 0) await runRLAIFSynthesizer();
        if (experimentCount % 210 === 0) await runAutoDeveloperCycle();
      } catch (e) {}
    }

    if (experimentCount % 50 === 0) {
      console.log(`\n📊 ${experimentCount} paralel deney tamamlandı. Zirve skor: ${colorScore(bestScore)}\n`);
    }

    if (!shutdownFlag) {
      console.log(`\n💤 Batch tamamlandı. ${LOOP_DELAY/1000}s bekleniyor...\n`);
      await sleep(LOOP_DELAY);
    }
  }

  console.log("\n✅ AutoResearch döngüsü tamamlandı.");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Fatal hatası:", e);
  process.exit(1);
});
