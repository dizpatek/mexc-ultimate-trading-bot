#!/usr/bin/env tsx
/**
 * MexCBrain Wiki Generator
 * ─────────────────────────────────────────────────────────────
 * Projenin src/ klasörünü analiz edip brain/wiki/ altındaki
 * Obsidian markdown dosyalarını otomatik günceller.
 *
 * Kullanım:
 *   npm run wiki:build   → Tam yeniden oluşturma
 *   npm run wiki:watch   → Değişiklik izleme + incremental güncelleme
 *   npm run wiki:sync    → Sadece INDEX ve LOG güncelle
 *   npm run wiki:lint    → Kırık linkler ve orphan sayfaları kontrol et
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM-uyumlu __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ─── Sabitler ──────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..", "..");
const SRC_DIR = path.join(ROOT, "src");
const WIKI_DIR = path.join(ROOT, "brain", "wiki");
const LOG_FILE = path.join(WIKI_DIR, "00-LOG.md");
const INDEX_FILE = path.join(WIKI_DIR, "00-INDEX.md");

const today = () => new Date().toISOString().split("T")[0];

// ─── Dosya Haritası: hangi src dosyası hangi wiki sayfasıyla eşleşiyor ──
const FILE_MAP: Record<string, string> = {
  "src/lib/matrix-v5-engine.ts": "entities/MatrixV5Engine.md",
  "src/lib/strategies.ts": "entities/MatrixV5Strategy.md",
  "src/services/SignalScanner.ts": "entities/SignalScanner.md",
  "src/lib/pilot-executor.ts": "entities/PilotExecutor.md",
  "src/lib/smart-trade.ts": "entities/SmartTrade.md",
  "src/lib/smart-trade-monitor.ts": "entities/SmartTradeMonitor.md",
  "src/lib/smart-trade-execution.ts": "entities/SmartTradeExecution.md",
  "src/lib/mexc-wrapper.ts": "entities/MexcWrapper.md",
  "src/lib/trading-logic.ts": "entities/TradingLogic.md",
  "src/lib/mtf-engine.ts": "entities/MtfEngine.md",
  "src/lib/alarm-engine.ts": "entities/AlarmEngine.md",
  "src/lib/panic-service.ts": "entities/PanicService.md",
  "src/hooks/useCombatLogs.ts": "entities/CombatLogsHook.md",
  "src/hooks/useSmartTradeLogic.ts": "entities/SmartTradeLogicHook.md",
  "src/hooks/useWhaleRadar.ts": "entities/WhaleRadarHook.md",
  "src/services/ApiCore.ts": "entities/ApiCoreService.md",
  "src/hooks/useAuth.ts": "entities/AuthService.md",
  "src/services/api.ts": "entities/api.md",
  "src/components/CombatLog.tsx": "entities/CombatLog.md",
  "src/components/Header.tsx": "entities/Header.md",
  "src/components/PilotPipeline3D.tsx": "entities/PilotPipeline3D.md",
  "src/components/ActiveSmartTrades.tsx": "entities/TradePanel.md",
};

// ─── Yardımcı Fonksiyonlar ──────────────────────────────────────

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Klasör oluşturuldu: ${dirPath}`);
  }
}

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

// ─── Frontmatter Güncelleme ──────────────────────────────────────

function updateFrontmatterDate(content: string): string {
  const dateRegex = /lastUpdated:\s*\d{4}-\d{2}-\d{2}/;
  if (dateRegex.test(content)) {
    return content.replace(dateRegex, `lastUpdated: ${today()}`);
  }
  return content;
}

// ─── Src Dosyası Analizi ──────────────────────────────────────────

interface FileAnalysis {
  filePath: string;
  relativePath: string;
  exports: string[];
  imports: string[];
  lineCount: number;
  sizeKb: number;
  lastModified: string;
}

function analyzeSrcFile(filePath: string): FileAnalysis {
  const content = readFile(filePath);
  const lines = content.split("\n");
  const stats = fs.statSync(filePath);

  // Export'ları bul
  const exports: string[] = [];
  const exportRegex = /export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  // Import'ları bul
  const imports: string[] = [];
  const importRegex = /from\s+["']([^"']+)["']/g;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, "/");

  return {
    filePath,
    relativePath,
    exports,
    imports,
    lineCount: lines.length,
    sizeKb: Math.round(stats.size / 1024),
    lastModified: stats.mtime.toISOString().split("T")[0],
  };
}

// ─── Wiki Sayfa Güncelleyici ──────────────────────────────────────

function updateEntityPage(wikiPath: string, analysis: FileAnalysis, srcRelative: string): boolean {
  const fullWikiPath = path.join(WIKI_DIR, wikiPath);
  if (!fs.existsSync(fullWikiPath)) {
    console.log(`⚠️  Wiki sayfası bulunamadı: ${wikiPath} (atlanıyor)`);
    return false;
  }

  let content = readFile(fullWikiPath);

  // lastUpdated güncelle
  const updated = updateFrontmatterDate(content);
  
  // size güncelle  
  const sizeRegex = /size:\s*"[^"]*"/;
  const newSize = `size: "${analysis.sizeKb}KB / ${analysis.lineCount} satır"`;
  const withSize = sizeRegex.test(updated)
    ? updated.replace(sizeRegex, newSize)
    : updated;

  if (withSize !== content) {
    writeFile(fullWikiPath, withSize);
    console.log(`✏️  Güncellendi: ${wikiPath} (${analysis.sizeKb}KB, ${analysis.lineCount} satır)`);
    return true;
  }
  return false;
}

// ─── Log'a Yeni Entry Ekle ──────────────────────────────────────

function appendLog(title: string, details: string): void {
  const logContent = readFile(LOG_FILE);
  const entry = `
## [${today()}] ${title}

${details}

---
`;

  // Log dosyasının başına ekle (ilk ---'dan sonra)
  const headerEnd = logContent.indexOf("---\n");
  if (headerEnd === -1) {
    writeFile(LOG_FILE, logContent + entry);
  } else {
    const afterHeader = logContent.indexOf("\n", headerEnd) + 1;
    const newContent =
      logContent.slice(0, afterHeader) + entry + logContent.slice(afterHeader);
    writeFile(LOG_FILE, newContent);
  }
  console.log(`📋 Log güncellendi: ${title}`);
}

// ─── INDEX Güncelleme ──────────────────────────────────────────

function updateIndex(): void {
  let content = readFile(INDEX_FILE);
  content = updateFrontmatterDate(content);
  writeFile(INDEX_FILE, content);
  console.log("📚 Index güncellendi (lastUpdated)");
}

// ─── Lint Kontrolü ──────────────────────────────────────────────

function runLint(): void {
  console.log("\n🔍 Wiki Lint başlıyor...\n");

  const issues: string[] = [];

  // Tüm .md dosyalarını bul
  function findMdFiles(dir: string): string[] {
    const results: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && item.name !== ".obsidian") {
        results.push(...findMdFiles(fullPath));
      } else if (item.isFile() && item.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const allMdFiles = findMdFiles(WIKI_DIR);
  const allPageNames = new Set(
    allMdFiles.map((f) => {
      const rel = path.relative(WIKI_DIR, f).replace(/\\/g, "/");
      return rel.replace(".md", "");
    })
  );

  // Gelen link sayacı
  const incomingLinks = new Map<string, number>();
  allPageNames.forEach((p) => incomingLinks.set(p, 0));

  // Her dosyayı kontrol et
  for (const mdFile of allMdFiles) {
    const content = readFile(mdFile);
    const relPath = path.relative(WIKI_DIR, mdFile).replace(/\\/g, "/");

    // 1. [[link]] formatındaki linkleri bul
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let match;
    while ((match = wikiLinkRegex.exec(content)) !== null) {
      processLink(match[1], relPath);
    }

    // 2. <a href="link"> formatındaki HTML linklerini bul (Index sayfasındaki Graph temizliği için)
    const htmlLinkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/g;
    while ((match = htmlLinkRegex.exec(content)) !== null) {
      processLink(match[1], relPath);
    }

    function processLink(rawLink: string, sourcePath: string) {
      // Anchor (#...), backslash'i temizle + trailing slash + .md uzantısını kaldır
      const linkTarget = rawLink.trim()
        .split("#")[0]
        .replace(/\\/g, "/")
        .replace(/\/+$/, "")
        .replace(/\.md$/, ""); // HTML linklerinde .md olabilir

      if (!linkTarget || linkTarget.startsWith("http")) return;

      // Hedef sayfa var mı? Tam yol veya alt klasör prefix ile kontrol
      const exists =
        allPageNames.has(linkTarget) ||
        allPageNames.has(`flows/${linkTarget}`) ||
        allPageNames.has(`entities/${linkTarget}`) ||
        allPageNames.has(`concepts/${linkTarget}`) ||
        allPageNames.has(`api/${linkTarget}`) ||
        [...allPageNames].some((p) => p === linkTarget || p.endsWith(`/${linkTarget}`));

      if (!exists) {
        issues.push(`❌ Kırık link: ${rawLink} in ${sourcePath}`);
      } else {
        // İncoming link sayısını artır — tam path ile bul
        const resolvedKey =
          allPageNames.has(linkTarget)
            ? linkTarget
            : [`flows`, `entities`, `concepts`, `api`]
                .map((pfx) => `${pfx}/${linkTarget}`)
                .find((k) => allPageNames.has(k)) ?? linkTarget;
        incomingLinks.set(resolvedKey, (incomingLinks.get(resolvedKey) || 0) + 1);
      }
    }

    // lastUpdated tarihi kontrol et
    const dateMatch = content.match(/lastUpdated:\s*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const fileDate = new Date(dateMatch[1]);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (fileDate < thirtyDaysAgo) {
        issues.push(`⚠️  Eski sayfa (30+ gün): ${relPath} (${dateMatch[1]})`);
      }
    }
  }

  // Orphan sayfalar (00-INDEX ve 00-LOG hariç)
  for (const [pageName, count] of incomingLinks.entries()) {
    if (count === 0 && !pageName.startsWith("00-")) {
      issues.push(`📭 Orphan sayfa (gelen link yok): ${pageName}`);
    }
  }

  // Sonuçları raporla
  if (issues.length === 0) {
    console.log("✅ Wiki sağlıklı! Hiç sorun bulunamadı.\n");
  } else {
    console.log(`⚠️  ${issues.length} sorun bulundu:\n`);
    issues.forEach((issue) => console.log(`  ${issue}`));
    console.log();
  }

  // Özet
  console.log(`📊 Toplam: ${allMdFiles.length} sayfa`);
}

// ─── Tam Build ──────────────────────────────────────────────────

function runBuild(): void {
  console.log("🔨 Wiki build başlıyor...\n");

  let updatedCount = 0;
  let unchangedCount = 0;

  for (const [srcRelative, wikiRelative] of Object.entries(FILE_MAP)) {
    const srcFull = path.join(ROOT, srcRelative);
    if (!fs.existsSync(srcFull)) {
      console.log(`⚠️  Kaynak bulunamadı: ${srcRelative}`);
      continue;
    }

    const analysis = analyzeSrcFile(srcFull);
    const updated = updateEntityPage(wikiRelative, analysis, srcRelative);

    if (updated) updatedCount++;
    else unchangedCount++;
  }

  updateIndex();

  appendLog(
    `build | Wiki yeniden oluşturuldu`,
    `- **İşlem:** Tam build
- **Güncellenen:** ${updatedCount} sayfa
- **Değişmeyen:** ${unchangedCount} sayfa
- **Kapsam:** Tüm entity sayfaları`
  );

  console.log(
    `\n✅ Build tamamlandı! ${updatedCount} güncellendi, ${unchangedCount} değişmedi.\n`
  );
}

// ─── Sync (Sadece Index + Log) ──────────────────────────────────

function runSync(): void {
  console.log("🔄 Wiki sync başlıyor...\n");
  updateIndex();
  appendLog(
    "sync | Index güncellendi",
    `- **İşlem:** Sync
- **Kapsam:** INDEX ve LOG`
  );
  console.log("✅ Sync tamamlandı!\n");
}

// ─── Watch Modu ──────────────────────────────────────────────────

async function runWatch(): Promise<void> {
  console.log("👀 Watch modu başlatılıyor...\n");
  console.log(`📂 İzleniyor: ${SRC_DIR}`);
  console.log("Ctrl+C ile durdur.\n");

  // Dinamik import — chokidar opsiyonel bağımlılık
  let chokidar: any;
  try {
    chokidar = await import("chokidar");
  } catch {
    console.error("❌ chokidar bulunamadı. Yüklemek için: npm install -D chokidar");
    process.exit(1);
  }

  const watcher = chokidar.watch(SRC_DIR, {
    ignored: /node_modules|\.next/,
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on("change", (filePath: string) => {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
    const wikiPage = FILE_MAP[relPath];

    console.log(`\n📝 Değişiklik: ${relPath}`);

    if (wikiPage) {
      const analysis = analyzeSrcFile(filePath);
      const updated = updateEntityPage(wikiPage, analysis, relPath);
      if (updated) {
        appendLog(
          `update | ${path.basename(filePath)}`,
          `- **İşlem:** Güncelleme (watch)
- **Kaynak:** ${relPath}
- **Wiki:** ${wikiPage}
- **Boyut:** ${analysis.sizeKb}KB / ${analysis.lineCount} satır`
        );
        updateIndex();
      }
    } else {
      console.log(`  ℹ️  Wiki haritasında bulunamadı — atlanıyor`);
    }
  });

  watcher.on("add", (filePath: string) => {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, "/");
    if (relPath.startsWith("src/") && relPath.endsWith(".ts")) {
      console.log(`\n🆕 Yeni dosya: ${relPath}`);
      if (!FILE_MAP[relPath]) {
        console.log(
          `  💡 Bu dosya için wiki sayfası yok. AGENTS.md'ye ekle ve entity sayfası oluştur.`
        );
      }
    }
  });

  console.log("✅ Watch modu aktif. Dosya değişikliklerini bekliyorum...\n");
}

// ─── CLI Komut İşleme ──────────────────────────────────────────

const command = process.argv[2] || "build";

async function main() {
  ensureDir(WIKI_DIR);
  ensureDir(path.join(WIKI_DIR, "flows"));
  ensureDir(path.join(WIKI_DIR, "entities"));
  ensureDir(path.join(WIKI_DIR, "concepts"));
  ensureDir(path.join(WIKI_DIR, "api"));

  switch (command) {
    case "build":
      runBuild();
      break;
    case "watch":
      await runWatch();
      break;
    case "sync":
      runSync();
      break;
    case "lint":
      runLint();
      break;
    default:
      console.log(`❌ Bilinmeyen komut: ${command}`);
      console.log("Kullanım: wiki-gen.ts [build|watch|sync|lint]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Hata:", err);
  process.exit(1);
});
