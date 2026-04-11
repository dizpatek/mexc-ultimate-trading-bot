/**
 * RAM Dostu Anlık Bildirim Sistemi (NotificationService)
 * 
 * Amaç: Sistemde oluşan Al/Sat, Balina hareketleri gibi olayları Dashboard'a (veya API uclarına) iletmek 
 * ve bu esnada asla buffer şişmesine izin vermemek. Veriler gönderildikten sonra Garbage Collector'a terk edilir.
 */

import crypto from "crypto";

export type NotificationType = "INFO" | "TRADE_BUY" | "TRADE_SELL" | "WHALE_ALERT" | "PANIC" | "SYSTEM";

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  meta?: any;
}

// Olay dinleyicileri (örn: SSE Bağlantıları)
type NotificationListener = (notification: NotificationPayload) => void;
const listeners = new Set<NotificationListener>();

// Opsiyonel Telegram mesajlaşma entegrasyonu referansı (Eğer ileride node-telegram-bot eklenecekse buraya konabilir)
// Şimdilik sadece python script'ine mesaj yazabiliriz veya REST call yapabiliriz.

export class NotificationService {
  /**
   * Dinleyici ekler (Örn: Server-Sent Events bağlantısı açıldığında)
   */
  static subscribe(listener: NotificationListener) {
    listeners.add(listener);
    return () => listeners.delete(listener); // Unsubscribe callback
  }

  /**
   * Yeni bildirim oluşturur, dinleyen herkese anında iletir ve bellekten düşer.
   */
  static emit(type: NotificationType, title: string, message: string, meta?: any) {
    const notification: NotificationPayload = {
      id: crypto.randomBytes(8).toString("hex"),
      type,
      title,
      message,
      timestamp: Date.now(),
      meta,
    };

    console.log(`[NotificationService] 🔔 ${type} - ${title}: ${message}`);

    // RAM yönetimi: Eğer bekleyen dinleyici yoksa veri anında GC'ye gider. (Buffer yok)
    listeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (err) {
        console.error("[NotificationService] Dinleyici hatası:", err);
        listeners.delete(listener); // Hatalı dinleyiciyi çıkar
      }
    });

    // Telegram Bildirim Teçhizatı (INFO dışındakileri gönder)
    if (type !== "INFO") {
      import("./telegram-service").then(({ TelegramService }) => {
        TelegramService.sendNotification(type, title, message).catch(() => {});
      }).catch(Boolean);
    }
  }
}

