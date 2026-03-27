"use client";

import { useState, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { X, Bell, Info, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function NotificationModal() {
  const { latestUnread, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Show modal if there is a new unread notification of type POPUP or BOTH
    if (latestUnread && (latestUnread.type === 'POPUP' || latestUnread.type === 'BOTH')) {
      const shownKey = `notification_shown_${latestUnread.id}`;
      const alreadyShown = sessionStorage.getItem(shownKey);
      
      if (!alreadyShown) {
        setIsOpen(true);
        sessionStorage.setItem(shownKey, 'true');
      }
    }
  }, [latestUnread]);

  const handleClose = () => {
    setIsOpen(false);
    // Note: We DON'T mark as read here automatically if the user just closes it, 
    // unless you want closing to count as reading. 
    // The user said "Kapattıklarında en üstteki header'da bildirim işaretinde kalması gerekiyor."
    // So we don't mark as read.
  };

  const handleReadAndClose = () => {
    if (latestUnread) markAsRead(latestUnread.id);
    setIsOpen(false);
  };

  if (!latestUnread) return null;

  const isWarn = latestUnread.level === 'WARN' || latestUnread.level === 'ALERT';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "relative w-full max-w-md bg-[#0f172a] border rounded-3xl overflow-hidden shadow-2xl",
              isWarn ? "border-rose-500/30" : "border-cyan-500/30"
            )}
          >
            {/* Header Glow */}
            <div className={cn(
              "absolute top-0 inset-x-0 h-1",
              isWarn ? "bg-rose-500 animate-pulse" : "bg-cyan-500 animate-pulse"
            )} />

            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={cn(
                  "p-3 rounded-2xl",
                  isWarn ? "bg-rose-500/10 text-rose-500" : "bg-cyan-500/10 text-cyan-400"
                )}>
                  {isWarn ? <AlertTriangle size={24} /> : <Bell size={24} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter text-white uppercase">
                    YENİ MESAJ
                  </h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">
                    Sistem Duyurusu
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className={cn(
                  "text-lg font-black tracking-tight",
                  isWarn ? "text-rose-400" : "text-cyan-400"
                )}>
                  {latestUnread.title}
                </h3>
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                  <p className="text-sm font-medium text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {latestUnread.message}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={handleReadAndClose}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                    isWarn 
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20" 
                      : "bg-cyan-500 hover:bg-cyan-600 text-black shadow-lg shadow-cyan-500/20"
                  )}
                >
                  TAMAM, ANLADIM
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 transition-all font-black text-[10px] uppercase"
                >
                  SONRA
                </button>
              </div>
            </div>

            {/* Close Icon Corner */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
