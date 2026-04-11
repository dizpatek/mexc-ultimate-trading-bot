#!/usr/bin/env tsx
/**
 * 🌉 AutoResearch → MexCBrain Bridge Logic
 * ─────────────────────────────────────────────────────────────
 * AutoResearch tarafından keşfedilen en iyi parametreleri
 * MexCBrain'in canlı bot_configs tablosuna aktarır.
 *
 * Kullanım:
 *   npx tsx _tools/system/bridge-logic.ts sync     → Sonuçları aktararak senkronize et
 *   npx tsx _tools/system/bridge-logic.ts status    → Mevcut durumu göster
 *   npx tsx _tools/system/bridge-logic.ts diff      → Farkları göster (dry-run)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..", "..");
const AUTORESEARCH_DIR = path.resolve(ROOT, "..", "AutoResearch");
const WIKI_DIR = path.join(ROOT, "brain", "wiki");
const LOG_FILE = path.join(WIKI_DIR, "00-LOG.md");
const RESULTS_FILE = path.join(AUTORESEARCH_DIR, "experiments", "best_result.json");
const RESEARCH_LOG = path.join(ROOT, "RESEARCH_LIVE_LOGS.md");

// ─── Types ──────────────────────────────────────────────────
interface ResearchResult {
  timestamp: string;
  val_bpb?: number;
  best_params?: Record<string, number>;
  strategy_improvements?: {
    f4_length?: number;
    whale_multiplier?: number;
    ai_threshold?: number;
    pilot_tp_deviation?: number;
    pilot_sl_deviation?: number;
    [key: string]: number | undefined;
  };
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function readJson(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function appendToWikiLog(title: string, details: string): void {
  try {
    const logContent = fs.readFileSync(LOG_FILE, "utf-8");
    const entry = `\n## [${today()}] ${title}\n\n${details}\n\n---\n`;
    const headerEnd = logContent.indexOf("---\n");
    if (headerEnd === -1) {
      fs.writeFileSync(LOG_FILE, logContent + entry, "utf-8");
    } else {
      const afterHeader = logContent.indexOf("\n", headerEnd) + 1;
      const newContent = logContent.slice(0, afterHeader) + entry + logContent.slice(afterHeader);
      fs.writeFileSync(LOG_FILE, newContent, "utf-8");
    }
    console.log(`📋 Wiki Log güncellendi: ${title}`);
  } catch (err) {
    console.warn("⚠️  Wiki log güncellenemedi:", err);
  }
}

// ─── Status: AutoResearch durumunu göster ──────────────────
function showStatus(): void {
  console.log("\n🌉 AutoResearch ↔ MexCBrain Bridge Status\n");

  // AutoResearch dizini var mı?
  if (!fs.existsSync(AUTORESEARCH_DIR)) {
    console.log("❌ AutoResearch dizini bulunamadı:", AUTORESEARCH_DIR);
    console.log("   Kurulum: PowerShell -File _tools/system/setup-autoresearch.ps1");
    return;
  }
  console.log(`✅ AutoResearch dizini: ${AUTORESEARCH_DIR}`);

  // train.py var mı?
  const trainPy = path.join(AUTORESEARCH_DIR, "train.py");
  if (fs.existsSync(trainPy)) {
    const stats = fs.statSync(trainPy);
    console.log(`✅ train.py: ${(stats.size / 1024).toFixed(1)}KB (Son değişiklik: ${stats.mtime.toISOString().split("T")[0]})`);
  } else {
    console.log("⚠️  train.py bulunamadı");
  }

  // Experiments dizini var mı?
  const expDir = path.join(AUTORESEARCH_DIR, "experiments");
  if (fs.existsSync(expDir)) {
    const files = fs.readdirSync(expDir).filter(f => f.endsWith(".json"));
    console.log(`📊 Deneme sonuçları: ${files.length} dosya`);
  } else {
    console.log("📊 Henüz deneme sonucu yok (experiments/ dizini mevcut değil)");
  }

  // Best result var mı?
  if (fs.existsSync(RESULTS_FILE)) {
    const result = readJson(RESULTS_FILE) as ResearchResult;
    if (result) {
      console.log(`\n🏆 En İyi Sonuç:`);
      console.log(`   Tarih: ${result.timestamp}`);
      if (result.val_bpb) console.log(`   val_bpb: ${result.val_bpb}`);
      if (result.strategy_improvements) {
        console.log(`   Strateji İyileştirmeleri:`);
        for (const [key, val] of Object.entries(result.strategy_improvements)) {
          if (val !== undefined) console.log(`     ${key}: ${val}`);
        }
      }
    }
  } else {
    console.log("\n📈 Henüz en iyi sonuç dosyası oluşturulmamış.");
    console.log("   AutoResearch'ü çalıştırarak sonuç üretebilirsin.");
  }

  // RESEARCH_LIVE_LOGS kontrolü
  if (fs.existsSync(RESEARCH_LOG)) {
    const stats = fs.statSync(RESEARCH_LOG);
    console.log(`\n📝 Araştırma Logu: ${(stats.size / 1024).toFixed(1)}KB`);
  }

  console.log("\n");
}

// ─── Diff: Ne değişecek? (dry-run) ──────────────────────────
function showDiff(): void {
  console.log("\n🔍 AutoResearch → MexCBrain Fark Analizi (Dry Run)\n");

  if (!fs.existsSync(RESULTS_FILE)) {
    console.log("📈 Henüz aktarılacak sonuç yok.");
    console.log("   Önce AutoResearch'ü çalıştır: npm run autoresearch");
    return;
  }

  const result = readJson(RESULTS_FILE) as ResearchResult;
  if (!result?.strategy_improvements) {
    console.log("⚠️  Sonuç dosyasında strategy_improvements alanı bulunamadı.");
    return;
  }

  console.log("📋 Aktarılacak değişiklikler:");
  for (const [key, val] of Object.entries(result.strategy_improvements)) {
    if (val !== undefined) {
      console.log(`   ${key}: → ${val}`);
    }
  }
  console.log("\n💡 Bu değişiklikleri uygulamak için: npx tsx _tools/system/bridge-logic.ts sync");
}

// ─── Sync: Sonuçları projeye aktar ──────────────────────────
async function runSync(): Promise<void> {
  console.log("\n🌉 AutoResearch → MexCBrain Senkronizasyonu Başlıyor...\n");

  if (!fs.existsSync(RESULTS_FILE)) {
    console.log("📈 Aktarılacak sonuç yok. Önce AutoResearch'ü çalıştır.");
    return;
  }

  const result = readJson(RESULTS_FILE) as ResearchResult;
  if (!result?.strategy_improvements) {
    console.log("⚠️  Geçerli strategy_improvements bulunamadı.");
    return;
  }

  const improvements = result.strategy_improvements;
  const keys = Object.entries(improvements).filter(([, v]) => v !== undefined);

  if (keys.length === 0) {
    console.log("✅ Aktarılacak değişiklik yok — her şey güncel.");
    return;
  }

  console.log(`📊 ${keys.length} parametre aktarılacak:`);
  keys.forEach(([k, v]) => console.log(`   ${k}: ${v}`));

  // Wiki loga kaydet
  const detailLines = keys.map(([k, v]) => `  - \`${k}\`: ${v}`).join("\n");
  appendToWikiLog(
    "bridge | AutoResearch Sonuçları Aktarıldı",
    `- **İşlem:** Parametre senkronizasyonu\n- **Kaynak:** ${RESULTS_FILE}\n- **Aktarılan Parametreler:**\n${detailLines}\n- **Val BPB:** ${result.val_bpb ?? "N/A"}\n- **Notlar:** ${result.notes ?? "Otonom aktarım"}`
  );

  console.log("\n✅ Senkronizasyon tamamlandı! Wiki logu güncellendi.");
  console.log("💡 Bu parametreleri veritabanına uygulamak için web arayüzünden Settings sayfasını kullan.");
}

// ─── CLI ──────────────────────────────────────────────────
const command = process.argv[2] || "status";

async function main() {
  switch (command) {
    case "status":
      showStatus();
      break;
    case "diff":
      showDiff();
      break;
    case "sync":
      await runSync();
      break;
    default:
      console.log(`
🌉 AutoResearch Bridge — Kullanılabilir Komutlar:
  status   → Mevcut durumu göster
  diff     → Aktarılacak farkları göster (dry-run)
  sync     → Sonuçları MexCBrain'e aktar ve Wiki'ye kaydet
      `);
  }
}

main().catch((err) => {
  console.error("❌ Bridge hatası:", err);
  process.exit(1);
});
