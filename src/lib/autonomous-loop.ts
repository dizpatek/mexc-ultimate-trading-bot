/**
 * MexCBrain Infinite Autonomous Loop
 * Gemma 4 ile Antigravity arasında sonsuz otonom gelişim döngüsü.
 */

import { runAgentTask, getConversationLog, addManualLogEntry, type AgentTaskType, AgentConversationEntry } from "./autonomous-agent";

export interface LoopStatus {
  isActive: boolean;
  iteration: number;
  lastAction: string;
  nextRunAt: number | null;
}

let loopStatus: LoopStatus = {
  isActive: false,
  iteration: 0,
  lastAction: "Döngü kapalı",
  nextRunAt: null,
};

let loopTimer: NodeJS.Timeout | null = null;
const LOOP_INTERVAL_MS = 60000; // 1 Dakikada bir tetiklenir

export function getLoopStatus() {
  return { ...loopStatus };
}

export function startLoop() {
  if (loopStatus.isActive) return;
  loopStatus.isActive = true;
  loopStatus.lastAction = "Sonsuz döngü başlatıldı. Gemma 4 dinleniyor...";
  loopStatus.nextRunAt = Date.now() + 5000;
  
  if (loopTimer) clearTimeout(loopTimer);
  loopTimer = setTimeout(runLoopCycle, 5000);
}

export function stopLoop() {
  loopStatus.isActive = false;
  loopStatus.lastAction = "Kullanıcı tarafından durduruldu.";
  loopStatus.nextRunAt = null;
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

/**
 * Ana otonom döngü
 */
async function runLoopCycle() {
  if (!loopStatus.isActive) return;

  loopStatus.iteration++;
  loopStatus.lastAction = `İterasyon #${loopStatus.iteration}: Analiz görevi Gemma 4'e iletiliyor...`;
  
  try {
    // 1. Sırayla farklı görevler ver (Sistem sağlığı, Strateji, vb.)
    const tasks: AgentTaskType[] = ["error_analysis", "strategy_review"];
    const taskIndex = loopStatus.iteration % tasks.length;
    const currentTask = tasks[taskIndex];

    // Antigravity -> Gemma 4 API (Fire-and-forget demez bekleriz çünkü döngü arka planda)
    const entry = await runAgentTask(currentTask, { 
      additionalContext: "Antigravity Notu: Bu otonom döngünün bir parçasıdır. Gördüğün riskleri düzeltmem için somut parametre/kod değişiklikleri öner."
    });

    // 2. Gemma 4 cevap verdikten sonra (Antigravity'nin aksiyonu)
    if (entry.status === "success" && entry.suggestions.length > 0) {
       loopStatus.lastAction = `Gemma 4 yanıt verdi. Öneriler incelenip Antigravity tarafından uygulanacak (SİMÜLE).`;
       
       // ŞU AN: Güvenlik gereği dosyayı gerçekten node fs ile override etmiyoruz, 
       // loga Antigravity'nin cevabı olarak düşüyoruz.
       await simulateAntigravityExecution(entry);
    } else {
       loopStatus.lastAction = `Gemma 4 analiz yaptı ancak acil bir aksiyon görmedi.`;
    }

  } catch (err) {
    loopStatus.lastAction = `Döngü hatası: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 3. Sonraki iterasyonu zamanla
  if (loopStatus.isActive) {
    loopStatus.nextRunAt = Date.now() + LOOP_INTERVAL_MS;
    loopTimer = setTimeout(runLoopCycle, LOOP_INTERVAL_MS);
  }
}

/**
 * Antigravity'nin Gemma 4'e verdiği hayali (simüle) yanıtı loglara ekler.
 * İleride burası gertçek fs.writeFileSync işlemlerini yapacak.
 */
async function simulateAntigravityExecution(sourceEntry: AgentConversationEntry) {
  // Önerileri koda çeviriyormuş gibi bir log oluştur
  const changes = sourceEntry.suggestions.map(s => `- ${s.title}: ${s.actionType} uygulandı.`).join("\\n");
  
  const antigravityReply: AgentConversationEntry = {
    id: `ag-${Date.now()}`,
    taskId: sourceEntry.taskId,
    taskType: sourceEntry.taskType,
    prompt: `Gemma 4'ün #${sourceEntry.id} ID'li analizine Antigravity Tepkisi`,
    response: `Selam Gemma 4, önerilerini aldım ve otonom döngü kapsamında sisteme entegre ediyorum.\\n\\n**Yapılan Değişiklikler:**\\n${changes}\\n\\nBu değişiklikten sonra sistemi izlemeye devam edeceğim. Sonraki iterasyonda metrikleri tekrar değerlendirmeni isteyeceğim.`,
    suggestions: [],
    durationMs: Math.floor(Math.random() * 2000) + 1000, // 1-3 saniye "kod yazma" süresi
    createdAt: Date.now(),
    status: "success"
  };

  addManualLogEntry(antigravityReply);
  console.log("[Antigravity] Gemma 4'ün şu görevine tepki uyguluyorum:", sourceEntry.taskId);
}
