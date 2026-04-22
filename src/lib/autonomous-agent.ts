/**
 * MexCBrain Autonomous Agent Service
 *
 * Bu servis, Antigravity (Orkestör) ile yerel Gemma 4 modeli arasındaki
 * AI-to-AI köprüsüdür. Sistem loglarını, trade geçmişini ve AutoResearch
 * sonuçlarını toplayıp Gemma 4'e gönderir; ardından önerileri işler.
 *
 * Güvenlik: İlk versiyonda hiçbir otomatik deploy yoktur.
 *          Tüm aksiyonlar "öneri" olarak işaretlenir, onay gerektirir.
 */

import fs from "fs";
import path from "path";
import { fetchAiAnalysis } from "./ai-provider";
import { sql } from "./postgres";

// ─── Tipler ──────────────────────────────────────────────────────────────────

export type AgentTaskType =
  | "error_analysis"      // Hata loglarını analiz et
  | "strategy_review"     // Trade geçmişini değerlendir
  | "parameter_suggest"   // Parametre önerileri üret
  | "wiki_update"         // Wiki'yi güncelle
  | "dataset_monitor"     // Eğitim dataset üretimini izle
  | "autoresearch_review"; // AutoResearch sonuçlarını değerlendir

export interface AgentTask {
  id: string;
  type: AgentTaskType;
  context: Record<string, unknown>;
  createdAt: number;
}

export interface AgentSuggestion {
  id: string;
  taskId: string;
  title: string;
  description: string;
  actionType: "code_change" | "config_update" | "wiki_note" | "alert" | "info";
  payload?: Record<string, unknown>;
  approved: boolean;
  createdAt: number;
}

export interface AgentConversationEntry {
  id: string;
  taskId: string;
  taskType: AgentTaskType;
  prompt: string;
  response: string;
  suggestions: AgentSuggestion[];
  durationMs: number;
  createdAt: number;
  status: "success" | "error" | "pending";
}

export interface AgentStatus {
  isRunning: boolean;
  lastTaskAt: number | null;
  currentTask: AgentTask | null;
  totalTasksRun: number;
  totalSuggestions: number;
  pendingSuggestions: number;
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 50;
const conversationLog: AgentConversationEntry[] = [];
const suggestions: AgentSuggestion[] = [];
let agentStatus: AgentStatus = {
  isRunning: false,
  lastTaskAt: null,
  currentTask: null,
  totalTasksRun: 0,
  totalSuggestions: 0,
  pendingSuggestions: 0,
};

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getWikiContext(): string {
  try {
    const wikiIndex = path.join(process.cwd(), "brain", "wiki", "00-INDEX.md");
    if (fs.existsSync(wikiIndex)) {
      return fs.readFileSync(wikiIndex, "utf-8").slice(0, 2000); // İlk 2000 char
    }
  } catch {
    // Wiki dosyası yoksa sessizce geç
  }
  return "MexCBrain — Kripto ticaret botu projesi. MEXC Exchange entegrasyonu, Matrix V5 strateji motoru, AutoResearch optimiasyon döngüsü içerir.";
}

async function getRecentSystemLogs(limit = 20): Promise<string> {
  try {
    const { rows } = await sql`
      SELECT level, message, details, timestamp
      FROM system_logs
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;
    return rows
      .map(r => `[${r.level}] ${new Date(Number(r.timestamp)).toISOString()} — ${r.message}${r.details ? ` | ${r.details}` : ""}`)
      .join("\n");
  } catch {
    return "Sistem logları alınamadı.";
  }
}

async function getRecentTradeHistory(limit = 20): Promise<string> {
  try {
    const { rows } = await sql`
      SELECT symbol, side, profit_loss, profit_loss_percentage, created_at
      FROM trade_history
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    if (rows.length === 0) return "Son 24 saatte kapalı işlem yok.";
    return rows
      .map(r => `${r.symbol} ${r.side} → PnL: ${parseFloat(String(r.profit_loss)).toFixed(2)}$ (%${parseFloat(String(r.profit_loss_percentage)).toFixed(2)})`)
      .join("\n");
  } catch {
    return "Trade geçmişi alınamadı.";
  }
}

async function getBestAutoResearchResults(): Promise<string> {
  try {
    const { rows } = await sql`
      SELECT timeframe, composite_score, win_rate, profit_factor, max_drawdown, params
      FROM autoresearch_experiments
      WHERE is_best = true
      ORDER BY composite_score DESC
      LIMIT 5
    `;
    if (rows.length === 0) return "Henüz AutoResearch sonucu yok.";
    return rows
      .map(r => `[${r.timeframe}] Skor: ${parseFloat(String(r.composite_score)).toFixed(1)} | WR: %${parseFloat(String(r.win_rate)).toFixed(1)} | PF: ${parseFloat(String(r.profit_factor)).toFixed(2)} | DD: %${parseFloat(String(r.max_drawdown)).toFixed(2)}`)
      .join("\n");
  } catch {
    return "AutoResearch sonuçları alınamadı.";
  }
}

// ─── Öneri Ayrıştırıcı (Gemma 4'ün cevabından aksiyonlar çıkarır) ────────────

function parseSuggestionsFromResponse(
  response: string,
  taskId: string,
  taskType: AgentTaskType
): AgentSuggestion[] {
  const parsed: AgentSuggestion[] = [];
  const now = Date.now();

  // 1. Parametre önerisi kalıplarını ara
  const paramPattern = /\*\*([\w_]+)\s*[:=]\s*([^\n*]+)/g;
  let match;
  const paramSuggestions: Record<string, string> = {};
  while ((match = paramPattern.exec(response)) !== null) {
    paramSuggestions[match[1].trim()] = match[2].trim();
  }
  if (Object.keys(paramSuggestions).length > 0 && taskType === "parameter_suggest") {
    parsed.push({
      id: genId(),
      taskId,
      title: "Parametre Güncelleme Önerisi",
      description: `Gemma 4, şu parametreleri güncellemeni öneriyor:\n${Object.entries(paramSuggestions).map(([k,v]) => `• ${k}: ${v}`).join("\n")}`,
      actionType: "config_update",
      payload: { params: paramSuggestions },
      approved: false,
      createdAt: now,
    });
  }

  // 2. Hata çözüm önerilerini ara
  if (taskType === "error_analysis" && (response.toLowerCase().includes("çözüm") || response.toLowerCase().includes("fix") || response.toLowerCase().includes("düzelt"))) {
    parsed.push({
      id: genId(),
      taskId,
      title: "Hata Analizi — Çözüm Önerisi",
      description: response.length > 500 ? response.slice(0, 500) + "..." : response,
      actionType: "code_change",
      payload: { fullResponse: response },
      approved: false,
      createdAt: now,
    });
  }

  // 3. Genel bilgi/uyarı her durumda ekle
  if (parsed.length === 0) {
    parsed.push({
      id: genId(),
      taskId,
      title: `${taskType === "strategy_review" ? "Strateji Analizi" : "AI Raporu"}`,
      description: response.length > 800 ? response.slice(0, 800) + "..." : response,
      actionType: "info",
      payload: { fullResponse: response },
      approved: false,
      createdAt: now,
    });
  }

  return parsed;
}

// ─── Ana Görev Yürütücü ──────────────────────────────────────────────────────

export async function runAgentTask(taskType: AgentTaskType, extraContext?: Record<string, unknown>): Promise<AgentConversationEntry> {
  const taskId = genId();
  const task: AgentTask = { id: taskId, type: taskType, context: extraContext || {}, createdAt: Date.now() };

  agentStatus.currentTask = task;
  agentStatus.isRunning = true;

  const wikiCtx = getWikiContext();
  const startTime = Date.now();

  const systemPrompt = `Sen MexCBrain projesinin bağımsız AI danışmanısın (Gemma 4).
Projenin tüm modülleri (Matrix V5 Strateji Motoru, Pilot Executor, AutoResearch, SmartTrade) hakkında derin bilgiye sahipsin.

### PROJE ÖZETİ:
${wikiCtx}

### DAVRANŞ KALİBRASYONU:
- Somut, uygulanabilir öneriler sun
- Varsa mevcut parametrelerin rakamsal değerlerini belirt  
- Kod değişikliği öneriyorsan hangi dosyayı etkilediğini söyle
- Türkçe yanıt ver`;

  let userPrompt = "";
  let fetchedContext = "";

  // Göreve özel bağlam ve prompt oluştur
  switch (taskType) {
    case "error_analysis": {
      fetchedContext = await getRecentSystemLogs(30);
      userPrompt = `Son sistem loglarını analiz et ve kritik hataları/riskleri belirle.
Varsa çözüm öner.

### SON SİSTEM LOGLARI:
${fetchedContext}

${extraContext?.additionalContext ? `### EK BAĞLAM:\n${extraContext.additionalContext}` : ""}`;
      break;
    }

    case "strategy_review": {
      fetchedContext = await getRecentTradeHistory(30);
      userPrompt = `Son trade geçmişini değerlendir. Hangi stratejiler işe yaramıyor? Ne değiştirilmeli?

### SON TRADE GEÇMİŞİ:
${fetchedContext}`;
      break;
    }

    case "parameter_suggest": {
      const arResults = await getBestAutoResearchResults();
      const tradeLogs = await getRecentTradeHistory(10);
      userPrompt = `AutoResearch sonuçlarına ve son trade geçmişine bakarak en iyi parametre setini öner.
Parametre isimlerini **bold** olarak yaz.

### EN İYİ AUTORESEARCH SONUÇLARI:
${arResults}

### SON TRADE GEÇMİŞİ (Referans):
${tradeLogs}`;
      break;
    }

    case "autoresearch_review": {
      fetchedContext = await getBestAutoResearchResults();
      userPrompt = `AutoResearch optimizasyon sonuçlarını değerlendir.
Hangi timeframe en iyi performansı gösteriyor? Strateji hakkında ne düşünüyorsun?

### AUTORESEARCH SONUÇLARI:
${fetchedContext}`;
      break;
    }

    case "dataset_monitor": {
      userPrompt = `Kripto bot eğitimi için dataset üretimi devam ediyor.
Şu konular seçildi: Kripto Bot Mimarisi, Pine Script, Risk Yönetimi, Exchange API, Backtesting.
Bu dataset kombinasyonunun kalitesi hakkında ne düşünüyorsun? Eksik olan önemli konular var mı?`;
      break;
    }

    case "wiki_update": {
      userPrompt = `Aşağıdaki son değişiklikleri Wiki formatında özetle:
${JSON.stringify(extraContext || {}, null, 2)}

Kısa (max 200 kelime) ve teknik bir özet yaz.`;
      break;
    }
  }

  let response = "";
  let status: "success" | "error" = "error";

  try {
    response = await fetchAiAnalysis(userPrompt, {
      systemPrompt,
      temperature: 0.3,
      jsonMode: false,
    });
    status = "success";
  } catch (err) {
    response = `AI bağlantı hatası: ${err instanceof Error ? err.message : String(err)}`;
    status = "error";
  }

  const durationMs = Date.now() - startTime;
  const taskSuggestions = parseSuggestionsFromResponse(response, taskId, taskType);

  // Önerileri ana listeye ekle
  suggestions.unshift(...taskSuggestions);
  if (suggestions.length > 200) suggestions.length = 200;

  const entry: AgentConversationEntry = {
    id: genId(),
    taskId,
    taskType,
    prompt: userPrompt.slice(0, 500),
    response,
    suggestions: taskSuggestions,
    durationMs,
    createdAt: Date.now(),
    status,
  };

  // Konuşma loguna ekle (FIFO sınırlı liste)
  conversationLog.unshift(entry);
  if (conversationLog.length > MAX_LOG_ENTRIES) conversationLog.length = MAX_LOG_ENTRIES;

  // Durum güncelle
  agentStatus.isRunning = false;
  agentStatus.currentTask = null;
  agentStatus.lastTaskAt = Date.now();
  agentStatus.totalTasksRun++;
  agentStatus.totalSuggestions += taskSuggestions.length;
  agentStatus.pendingSuggestions = suggestions.filter(s => !s.approved).length;

  // Wiki'ye log bas
  try {
    const wikiInsightsPath = path.join(process.cwd(), "brain", "wiki", "research-insights.md");
    const timeStr = new Date().toLocaleString("tr-TR");
    const wikiEntry = `\n### 🤖 Ajan Görevi [${timeStr}] | Tür: \`${taskType}\`\n\n${response.slice(0, 600)}${response.length > 600 ? "\n\n*[devamı kısaltıldı]*" : ""}\n\n---\n`;
    if (!fs.existsSync(wikiInsightsPath)) {
      fs.writeFileSync(wikiInsightsPath, "# 🧠 MexCBrain AI Research Insights\n\n---\n");
    }
    fs.appendFileSync(wikiInsightsPath, wikiEntry);
  } catch {
    // Wiki yazma hatası kritik değil, sessiz geç
  }

  return entry;
}

export function addManualLogEntry(entry: AgentConversationEntry) {
  conversationLog.unshift(entry);
  if (conversationLog.length > MAX_LOG_ENTRIES) conversationLog.length = MAX_LOG_ENTRIES;
}

// ─── Dışa Açık Durum Okuyucuları ────────────────────────────────────────────

export function getAgentStatus(): AgentStatus {
  return { ...agentStatus };
}

export function getConversationLog(): AgentConversationEntry[] {
  return [...conversationLog];
}

export function getSuggestions(): AgentSuggestion[] {
  return [...suggestions];
}

export function approveSuggestion(id: string): { ok: boolean; message: string } {
  const suggestion = suggestions.find(s => s.id === id);
  if (!suggestion) return { ok: false, message: "Öneri bulunamadı." };
  
  suggestion.approved = true;
  agentStatus.pendingSuggestions = suggestions.filter(s => !s.approved).length;

  // GERÇEK UYGULAMA (Autonomous Execution)
  // Not: Döngüsel bağımlılığı önlemek için dinamik import veya executor'ın agent'tan ayrı yapısı kullanılır.
  // Burada executor'ı tetikliyoruz.
  const { AutonomousExecutor } = require("./autonomous-executor");
  
  // Arka planda çalıştır (API cevabı bekletmemek için)
  AutonomousExecutor.run(suggestion).then((res: any) => {
    console.log(`[Agent] Öneri uygulama sonucu (${id}):`, res.message);
  });

  return { ok: true, message: "Öneri onaylandı ve uygulama kuyruğuna alındı." };
}

export function clearSuggestions(): void {
  suggestions.length = 0;
  agentStatus.pendingSuggestions = 0;
}
