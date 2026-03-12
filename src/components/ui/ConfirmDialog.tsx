"use client";

import React from "react";
import { useNotification } from "@/context/NotificationContext";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";

export default function ConfirmDialog() {
  const { activeConfirm, closeConfirm } = useNotification();

  if (!activeConfirm) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeConfirm}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden"
        >
          {/* Decorative Corner Glow */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-cyan-500/10 blur-3xl rounded-full" />
          
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-amber-500" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white uppercase tracking-widest">Onay Gerekli</h3>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                {activeConfirm.message}
              </p>
            </div>

            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => {
                  activeConfirm.onCancel?.();
                  closeConfirm();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-black text-xs uppercase tracking-widest transition-all border border-white/5"
              >
                {activeConfirm.cancelText || "İPTAL"}
              </button>
              <button
                onClick={() => {
                  activeConfirm.onConfirm();
                  closeConfirm();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                {activeConfirm.confirmText || "TAMAM"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
