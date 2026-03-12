"use client";

import React from "react";
import { useNotification, NotificationType } from "@/context/NotificationContext";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const TOAST_ICONS: Record<NotificationType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
  error: <XCircle className="w-5 h-5 text-rose-400" />,
  info: <Info className="w-5 h-5 text-cyan-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
};

const TOAST_STYLES: Record<NotificationType, string> = {
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
  error: "border-rose-500/20 bg-rose-500/10 text-rose-100",
  info: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-100",
};

export default function TopToasts() {
  const { toasts, removeToast } = useNotification();

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-3 pointer-events-none w-[90%] max-w-md">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl",
              TOAST_STYLES[toast.type]
            )}
          >
            <div className="shrink-0">{TOAST_ICONS[toast.type]}</div>
            <p className="text-sm font-bold tracking-tight">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-auto p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
