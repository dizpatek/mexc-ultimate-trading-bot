"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function NotificationBell() {
  const { unreadCount, latestUnread, markAsRead } = useNotifications();
  const [showList, setShowList ] = useState(false);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowList(!showList);
        }}
        className={cn(
          "p-1.5 rounded-lg transition-all relative group",
          unreadCount > 0
            ? "text-amber-400 bg-amber-400/10 border border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.2)]"
            : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
        )}
      >
        <Bell className={cn("w-3.5 h-3.5 transition-transform", unreadCount > 0 && "animate-bounce")} />
        
        {unreadCount > 0 && (
          <>
            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shadow-[0_0_8px_#fbbf24]" />
            <div className="absolute -inset-0.5 bg-amber-400/10 blur-sm rounded-full animate-pulse" />
          </>
        )}
      </button>

      <AnimatePresence>
        {showList && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-3 w-64 bg-[#0f172a]/98 backdrop-blur-2xl border border-white/10 rounded-xl p-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.9)] z-[200]"
          >
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">İletiler</span>
              {unreadCount > 0 && (
                <button 
                  onClick={() => markAsRead()} 
                  className="text-[8px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-tighter"
                >
                  TEMİZLE
                </button>
              )}
            </div>
            
            <div className="max-h-60 overflow-y-auto no-scrollbar space-y-2">
              {unreadCount === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Bildirim Yok</p>
                </div>
              ) : (
                latestUnread && (
                  <div className="p-2.5 bg-white/[0.03] rounded-lg border border-white/5 hover:border-amber-500/30 transition-colors group/msg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-0.5 h-full bg-amber-500/50" />
                    <h4 className="text-[11px] font-black text-amber-400 mb-0.5 uppercase italic">{latestUnread.title}</h4>
                    <p className="text-[10px] text-slate-400 leading-snug line-clamp-3">{latestUnread.message}</p>
                    <button 
                      onClick={() => markAsRead(latestUnread.id)}
                      className="mt-2 text-[8px] font-black text-slate-500 group-hover/msg:text-amber-500 transition-colors uppercase flex items-center gap-1"
                    >
                      <div className="w-1 h-1 rounded-full bg-current" />
                      OKUNDU
                    </button>
                  </div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
