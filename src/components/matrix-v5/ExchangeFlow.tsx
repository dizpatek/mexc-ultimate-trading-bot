"use client";

import React, { useState } from "react";
import { MoveHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MultiExchangeFlowChart } from "@/components/matrix-v5/MakerTakerChart";

export function ExchangeFlow() {
  const [show, setShow] = useState(false);

  return (
    <div id="exchange-flow-section" className="w-full px-2">
      <div 
        className={cn(
          "relative z-20 flex items-center justify-between py-2 border-b border-slate-800/40 bg-slate-950/20 hover:bg-slate-900/40 transition-all backdrop-blur-sm font-mono cursor-pointer select-none",
          show ? "mb-0" : "mb-2"
        )}
        onClick={() => setShow(!show)}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-transparent shrink-0">
            <MoveHorizontal className="w-4 h-4 text-cyan-400" />
            <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase">
              EXCHANGE FLOW
            </h2>
          </div>
          <div className="w-px h-4 bg-slate-800/50 hidden sm:block" />
          <div className="flex items-center gap-2 px-3 py-1.5 bg-transparent shrink-0 hidden sm:flex">
            <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase">
              MAKER TAKER
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pr-1">
          <div className="flex items-center p-0.5 bg-slate-950/40 border border-slate-800/50 rounded-lg">
            <button
               className={cn(
                 "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                 show ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white"
               )}
               onClick={(e) => { e.stopPropagation(); setShow(!show); }}
            >
              {show ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span className="tracking-widest">{show ? "GİZLE" : "GÖSTER"}</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden bg-slate-900/10 px-6 pb-6"
          >
            <div className="mt-4">
              <MultiExchangeFlowChart symbol="BTC-USDT" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
