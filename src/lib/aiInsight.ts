import path from "path";
import fs from "fs";
import { fetchAiAnalysis } from "./ai-provider";

/**
 * AI Insight Bridge — MexCBrain Research Lab
 * 
 * Bu modül, AutoResearch laboratuvarından gelen verileri 
 * Merkezi AI Sağlayıcısına (LM Studio / Groq) taşır ve otonom 
 * stratejik hipotezler üretilmesini sağlar.
 */

export interface ResearchSummary {
  best_params: Record<string, any>;
  best_score: number;
  recent_results: Array<{
    score: number;
    win_rate: number;
    params: Record<string, any>;
    phase: string;
  }>;
  current_code_context?: string;
}

/**
 * Projenin Wiki özetini (00-INDEX.md) okuyup AI için bağlam oluşturur.
 */
function getWikiContext(): string {
  try {
    const wikiIndex = path.join(process.cwd(), "brain", "wiki", "00-INDEX.md");
    if (fs.existsSync(wikiIndex)) {
      return fs.readFileSync(wikiIndex, "utf-8");
    }
  } catch (e) {
    console.warn("Wiki context could not be loaded:", e);
  }
  return "MexCBrain project documentation is missing.";
}

export async function askAiForStrategicInsight(summary: ResearchSummary): Promise<string> {
  // 1. Bağlam ve Prompt Hazırlığı
  const wikiContext = getWikiContext();
  const recentSummaryText = summary.recent_results
    .map((r, i) => `Ex#${i}: Score=${r.score.toFixed(2)}, Phase=${r.phase}`)
    .join("\n");

  const systemPrompt = `
Sen MexCBrain Research Lab'in Baş Araştırmacısısın. Aşağıdaki proje dokümantasyonuna (Wiki) ve backtest sonuçlarına hakimsin.
Görevin, verileri analiz edip otonom stratejik hipotezler üretmek.

### PROJE DOKÜMANTASYONU (CONTEXT)
${wikiContext}

### GÖREV
Aşağıdaki sonuçları analiz et ve projenin mantığını (hafızanı) kullanarak stratejik bir hipotez üret.
Sadece parametre önerme, NEDEN bu yöne gitmeliyiz onu da açıkla.
  `.trim();

  const userPrompt = `
EN İYİ PARAMETRELER:
${JSON.stringify(summary.best_params, null, 2)}
Skor: ${summary.best_score.toFixed(2)}

SON DENEYLER:
${recentSummaryText}

GÖREV: Gelecek 10 deney için hangi parametre alanına odaklanmalıyız? (Örn: TSL'yi sıkılaştır, Slope threshold'u artır vb.)
  `.trim();

  // 2. Merkezi AI Çağrısı
  try {
    const response = await fetchAiAnalysis(userPrompt, {
      systemPrompt,
      temperature: 0.7,
      jsonMode: false // Ham metin analizi istiyoruz
    });
    return response;
  } catch (error) {
    console.error("[AI Insight Error]:", error);
    throw new Error("AI Inference failed");
  }
}

/**
 * AI'nın araştırmalarını Wiki'ye kaydeder.
 */
export function logAiInsightToWiki(insight: string, runId: string) {
  const wikiPath = path.join(process.cwd(), "brain", "wiki", "research-insights.md");
  const time = new Date().toLocaleString("tr-TR");
  
  const entry = `
### 🧠 AI Insight [${time}] | Run: \`${runId}\`

**Analiz ve Hipotez:**
${insight}

---
`;

  if (!fs.existsSync(wikiPath)) {
    const header = "# 🧠 MexCBrain AI Research Insights\n\nYapay Zeka tarafından üretilen otonom strateji analizleri ve gelişim günlükleri.\n\n---\n";
    fs.writeFileSync(wikiPath, header);
  }

  fs.appendFileSync(wikiPath, entry);
}

