import fs from "fs";
import path from "path";
import { sql } from "./postgres";
import { type AgentSuggestion } from "./autonomous-agent";

/**
 * AutonomousExecutor
 * 
 * Bu servis, Ajan (Gemma 4) tarafından üretilen ve kullanıcı tarafından 
 * onaylanan önerileri gerçek sistem eylemlerine dönüştürür.
 */
export class AutonomousExecutor {
  
  /**
   * Ana yürütücü: Öneri tipine göre ilgili işlemi tetikler.
   */
  static async run(suggestion: AgentSuggestion): Promise<{ ok: boolean; message: string }> {
    console.log(`[AutonomousExecutor] Yürütme başlatılıyor: ${suggestion.title} (${suggestion.actionType})`);

    try {
      switch (suggestion.actionType) {
        case "config_update":
          return await this.executeConfigUpdate(suggestion);
        
        case "wiki_note":
          return await this.executeWikiNote(suggestion);
        
        case "code_change":
          return await this.executeCodeChange(suggestion);
        
        case "alert":
        case "info":
          return { ok: true, message: "Bilgilendirme önerisi işaretlendi (İşlem gerekmiyor)." };
        
        default:
          return { ok: false, message: `Bilinmeyen aksiyon tipi: ${suggestion.actionType}` };
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`[AutonomousExecutor] KRİTİK HATA:`, errorMsg);
      return { ok: false, message: `Uygulama hatası: ${errorMsg}` };
    }
  }

  /**
   * config_update: bot_configs tablosundaki parametreleri günceller.
   */
  private static async executeConfigUpdate(suggestion: AgentSuggestion): Promise<{ ok: boolean; message: string }> {
    const params = suggestion.payload?.params as Record<string, any>;
    if (!params || Object.keys(params).length === 0) {
      return { ok: false, message: "Güncellenecek parametre bulunamadı." };
    }

    // Geçerli sütunları doğrula (SQL Injection koruması için beyaz liste)
    const validColumns = [
      "f4_length", "whale_multiplier", "ai_threshold", "auto_trade",
      "defense_mode", "pilot_mode", "pilot_use_usdt", "pilot_timeframe",
      "pilot_trailing_buy", "pilot_trailing_buy_dev", "pilot_tp_trailing",
      "pilot_tp_deviation", "pilot_sl_trailing", "pilot_sl_deviation",
      "pilot_mtf_veto", "pilot_mtf_threshold", "pilot_mtf_long_threshold",
      "pilot_mtf_short_threshold", "pilot_only_holdings", "trade_freshness_bars",
      "fibo_length", "f4_alpha", "f4_multiplier", "scalp_f4_multiplier",
      "swing_f4_multiplier", "f4_power_loss_threshold", "f4_slope_threshold",
      "long_squeeze_threshold", "short_squeeze_threshold", "f4_lookback_bars",
      "f4_squeeze_threshold", "min_power_loss", "scalp_length",
      "scalp_volume_multiplier", "swing_length", "swing_volume_multiplier",
      "pilot_tp_percent", "pilot_sl_percent"
    ];

    let updatedCount = 0;
    const updateLogs: string[] = [];

    for (const [key, value] of Object.entries(params)) {
      if (validColumns.includes(key)) {
        try {
          // Dinamik SQL için güvenli yapı
          await sql.raw(`UPDATE bot_configs SET ${key} = $1 WHERE id = 1`, [value]);
          updateLogs.push(`${key} → ${value}`);
          updatedCount++;
        } catch (err) {
          console.warn(`[AutonomousExecutor] ${key} güncellenemedi:`, err);
        }
      }
    }

    if (updatedCount > 0) {
      return { 
        ok: true, 
        message: `Başarıyla güncellendi: ${updateLogs.join(", ")}` 
      };
    }

    return { ok: false, message: "Hiçbir geçerli parametre güncellenemedi." };
  }

  /**
   * wiki_note: Wiki'ye yeni bir araştırma notu ekler.
   */
  private static async executeWikiNote(suggestion: AgentSuggestion): Promise<{ ok: boolean; message: string }> {
    try {
      const wikiInsightsPath = path.join(process.cwd(), "brain", "wiki", "research-insights.md");
      const timeStr = new Date().toLocaleString("tr-TR");
      
      const content = `\n### ✅ ONAYLANAN ANALİZ [${timeStr}]\n**Başlık:** ${suggestion.title}\n**Detay:** ${suggestion.description}\n\n---\n`;
      
      if (!fs.existsSync(wikiInsightsPath)) {
        fs.writeFileSync(wikiInsightsPath, "# 🧠 MexCBrain AI Research Insights\n\n---\n");
      }
      
      fs.appendFileSync(wikiInsightsPath, content);
      return { ok: true, message: "Wiki başarıyla güncellendi." };
    } catch (e) {
      return { ok: false, message: `Wiki yazma hatası: ${String(e)}` };
    }
  }

  /**
   * code_change: Dosya sistemine değişiklik uygular.
   * Şimdilik sadece log tutar ve Antigravity'ye raporlar.
   */
  private static async executeCodeChange(suggestion: AgentSuggestion): Promise<{ ok: boolean; message: string }> {
    // İleride buraya patch-apply mantığı gelecek.
    // Şimdilik sistem loglarına basıyoruz.
    console.log("[AutonomousExecutor] KOD DEĞİŞİKLİĞİ TALEBİ:", suggestion.title);
    
    return { 
      ok: true, 
      message: "Kod değişikliği onaylandı ve deploy sırasına alındı (Manuel müdahale bekleniyor)." 
    };
  }
}
