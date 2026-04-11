import axios from "axios";

/**
 * Matrix V5 Telegram Bildirim Servisi
 * 
 * Northflank 512MB RAM limitine takılmamak için ağır kütüphaneler yerine 
 * doğrudan Telegram Bot API üzerinden (axios) mesaj gönderir.
 */
export class TelegramService {
  private static token = process.env.TELEGRAM_BOT_TOKEN;
  private static chatId = process.env.TELEGRAM_CHAT_ID;

  /**
   * Telegram'a mesaj gönderir. Botun ana döngüsünü engellememesi için 
   * her zaman asenkron (Promise.allSettled uyumlu) çalışır.
   */
  static async sendMessage(text: string): Promise<boolean> {
    if (!this.token || !this.chatId) {
      // Config eksikse sessizce logla (sistemi kilitme)
      if (process.env.NODE_ENV === "development") {
        console.warn("[TelegramService] ⚠️ TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID eksik. Bildirim gönderilemedi.");
      }
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
      await axios.post(url, {
        chat_id: this.chatId,
        text: text,
        parse_mode: "Markdown",
      }, { timeout: 5000 });

      return true;
    } catch (error: any) {
      console.error("[TelegramService] ❌ Mesaj gönderme hatası:", error?.message || error);
      return false;
    }
  }

  /**
   * Bildirim Tipine Göre Formatlanmış Mesaj Gönderir
   */
  static async sendNotification(type: string, title: string, message: string) {
    let emoji = "🔔";
    if (type === "TRADE_BUY") emoji = "🟢 [ALIŞ]";
    if (type === "TRADE_SELL") emoji = "🔴 [SATIŞ]";
    if (type === "WHALE_ALERT") emoji = "🐳 [BALİNA]";
    if (type === "PANIC") emoji = "🚨 [KRİTİK]";
    if (type === "SYSTEM") emoji = "⚙️ [SİSTEM]";

    const formattedText = `*${emoji} ${title}*\n\n${message}\n\n_Matrix V5 Alpha Terminal_`;
    return this.sendMessage(formattedText);
  }
}
