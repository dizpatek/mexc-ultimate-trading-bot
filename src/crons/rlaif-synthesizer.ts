import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
if (process.env.POSTGRES_URL && !process.env.POSTGRES_URL.includes('sslmode')) {
  process.env.POSTGRES_URL += (process.env.POSTGRES_URL.includes('?') ? '&' : '?') + 'sslmode=require';
}

// AutoResearch klasöründeki AI eğitim dosyasının yolu.
const INSTRUCTION_DATASET_PATH = path.resolve(process.cwd(), "..", "AutoResearch", "instruction_dataset.md");

/**
 * Başarılı ve başarısız backtestleri analiz eder ve yapay zeka için (LLM) soru-cevap formatında kural (insight) üretir.
 * RLAIF (Reinforcement Learning from AI Feedback) mekanizmasının kalbidir.
 */
export async function runRLAIFSynthesizer() {
  // DB objesini runtime'da yükle
  const { sql } = await import("../lib/postgres");
  
  console.log("\n======================================================");
  console.log("🤖 MEXCBRAIN RLAIF (SELF-IMPROVEMENT) SYNTHESIZER INIT");
  console.log("======================================================");

  try {
    // Son 100 deneyi getir
    const { rows } = await sql`
      SELECT id, composite_score, params, win_rate, total_trades, total_pnl_pct
      FROM autoresearch_experiments
      ORDER BY id DESC
      LIMIT 100
    `;

    if (rows.length < 10) {
      console.log("[RLAIF] Veri yetersiz (En az 10 deney gerekli). Sentez atlanıyor.");
      return;
    }

    const failed = rows.filter((r) => Number(r.composite_score) < 0 || Number(r.total_pnl_pct) < 0);
    const success = rows.filter((r) => Number(r.composite_score) > 20 && Number(r.total_pnl_pct) > 0);

    if (failed.length === 0 && success.length === 0) {
      console.log("[RLAIF] Belirgin bir başarı/başarısızlık anomalisi bulunamadı.");
      return;
    }

    let newInstructions = "\n";
    let questionsAdded = 0;

    // 1. En kötü kaybeden analizi
    if (failed.length > 0) {
      // En çok kaybettiren deneyi bul
      const worst = failed.reduce((min, r) => (Number(r.total_pnl_pct) < Number(min.total_pnl_pct) ? r : min), failed[0]);
      
      const p = typeof worst.params === 'string' ? JSON.parse(worst.params) : worst.params;
      const tsl = p.pilot_sl_percent || "bilinmiyor";
      const slope = p.f4_slope_threshold || "bilinmiyor";
      const veto = p.pilot_mtf_veto ? "açık" : "kapalı";

      newInstructions += `
<|user|>
Son deneylerimde TSL ${tsl} seviyesinde, F4 eğim eşiği ${slope} iken ve MTF koruması ${veto} durumdayken ciddi zarar (Pnl: %${Number(worst.total_pnl_pct).toFixed(2)}) ettim. Sence hata neydi ve bu parametrelerden ne öğrenmeliyiz?
<|ai|>
Bu parametre konfigürasyonunda #${worst.id} numaralı AutoResearch deneyi başarısızlıkla sonuçlandı. MTF korumasının ${veto} olması ve F4 eğim eşiğinin (${slope}) piyasa volatilitesine uymaması, seni yanlış trendlere soktu. Ayrıca TSL değerinin ${tsl} olması kârı koruyamadan veya gürültüde erken patlayarak toplam pozisyon başarısını (Kazanma Oranı: %${(Number(worst.win_rate) * 100).toFixed(1)}) negatife çevirdi. Bu oranları gelecekteki işlemlerde daraltmalı veya hacim onaylarını artırmalısın.<|end|>
`;
      questionsAdded++;
    }

    // 2. En iyi kazanan analizi
    if (success.length > 0) {
      const best = success.reduce((max, r) => (Number(r.composite_score) > Number(max.composite_score) ? r : max), success[0]);
      
      const p = typeof best.params === 'string' ? JSON.parse(best.params) : best.params;
      const tsl = p.pilot_sl_percent || "bilinmiyor";
      const slope = p.f4_slope_threshold || "bilinmiyor";

      newInstructions += `
<|user|>
Matrix V5 motorunda hangi parametreler yüksek kar sağlıyor? Deney #${best.id} nasıl başarılı oldu?
<|ai|>
Deney #${best.id} olağanüstü bir başarı yakalayarak %${Number(best.total_pnl_pct).toFixed(2)} PnL (Net Kâr) ve %${(Number(best.win_rate) * 100).toFixed(1)} kazanma oranına ulaştı. Bu başarının sırrı TSL oranının ${tsl} gibi dengeli bir seviyede tutulması ve F4 momentum eşik değerinin ${slope} civarında yakalanmasıdır. Otonom yapay zeka olarak, bu parametre bölgesini 'güvenli sular' olarak işaretliyorum ve 'ai_guided' arama fazında bu bölge etrafında mutasyon yapmayı tavsiye ediyorum.<|end|>
`;
      questionsAdded++;
    }

    if (questionsAdded > 0) {
      // instruction_dataset.md dosyasının varlığından emin ol (yoksa uyar, varsa sonuna ekle)
      if (fs.existsSync(INSTRUCTION_DATASET_PATH)) {
        fs.appendFileSync(INSTRUCTION_DATASET_PATH, newInstructions, "utf-8");
        console.log(`[RLAIF] Başarıyla ${questionsAdded} yeni sentezlenmiş QA datasetin sonuna eklendi! (Self-Learning Devrede)`);
      } else {
         console.warn(`[RLAIF] Uyarı: ${INSTRUCTION_DATASET_PATH} bulunamadı. Dataset yazılamadı.`);
      }
    }

  } catch (err) {
    console.error("[RLAIF] Sentezleyici çalışırken hata oluştu:", err);
  } finally {
    console.log("======================================================\n");
  }
}

// Standalone test için
if (require.main === module) {
  runRLAIFSynthesizer().catch(console.error).finally(() => process.exit(0));
}
