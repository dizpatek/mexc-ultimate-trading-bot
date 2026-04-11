"use client";

import React, { useState } from "react";
import { MoveHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MultiExchangeFlowChart } from "@/components/matrix-v5/MakerTakerChart";

export function ExchangeFlow({ children }: { children?: React.ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div id="exchange-flow-section" className="w-full px-2 mb-4">
      {/* ADVANCED PANEL CONTAINER */}
      <div className={cn(
        "w-full rounded-xl border border-cyan-500/20 overflow-hidden relative backdrop-blur-md shadow-[0_0_40px_-15px_rgba(6,182,212,0.15)] transition-all duration-500",
        show ? "bg-slate-950/60" : "bg-slate-950/40"
      )}>
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-cyan-500/5 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[150px] h-[150px] bg-blue-500/5 blur-[100px] pointer-events-none" />

        {/* HIGH-TECH HEADER */}
        <div 
          className="relative z-20 flex flex-col lg:grid lg:grid-cols-3 items-center py-2 px-3 gap-3 border-b border-slate-800/40 bg-slate-950/20 hover:bg-slate-900/40 transition-colors backdrop-blur-sm font-mono cursor-pointer"
          onClick={() => setShow(!show)}
        >
          {/* LEFT: TITLES */}
          <div className="flex items-center gap-3 lg:justify-self-start w-full lg:w-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 shadow-lg">
              <MoveHorizontal className="w-4 h-4 text-cyan-500" />
              <span className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase block">
                PRO TERMINAL
              </span>
            </div>
          </div>

          {/* CENTER: STATUS INDICATORS */}
          <div className="flex items-center gap-4 lg:justify-self-center justify-center w-full lg:w-auto">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/40 border border-slate-800/40 rounded-lg">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest hidden sm:inline">SYSTEM ACTIVE • ZERO LATENCY</span>
              <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest sm:hidden">ACTIVE</span>
            </div>
          </div>

          {/* RIGHT: ACTIONS & TOGGLE */}
          <div className="flex items-center gap-2 lg:justify-self-end justify-between w-full lg:w-auto">
             {/* Decorative Data Points */}
             <div className="hidden lg:flex items-center gap-4 mr-2">
                <div className="flex flex-col items-end">
                   <span className="text-[8px] text-slate-500 font-mono uppercase tracking-widest">Global Flow</span>
                   <span className="text-[10px] text-emerald-400 font-black font-mono">OPTIMAL</span>
                </div>
                <div className="w-px h-6 bg-slate-800/50" />
                <div className="flex flex-col items-end">
                   <span className="text-[8px] text-slate-500 font-mono uppercase tracking-widest">Network</span>
                   <span className="text-[10px] text-cyan-400 font-black font-mono flex items-center gap-1">
                     <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> 24ms
                   </span>
                </div>
             </div>

            <div className="flex items-center p-1 bg-slate-950/60 gap-1">
              <button
                 className={cn(
                   "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                   show ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white"
                 )}
                 onClick={(e) => { e.stopPropagation(); setShow(!show); }}
              >
                {show ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span className="">{show ? "GİZLE" : "GÖSTER"}</span>
              </button>
            </div>
          </div>
        </div>


        {/* EXPANDABLE CONTENT */}
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: show ? "auto" : 0, opacity: show ? 1 : 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="relative z-10 w-full overflow-hidden"
        >
          <div className="p-2 md:p-4 w-full flex flex-col">
            {/* Unified Pro Terminal Payload */}
            {children && (
              <div className="w-full">
                {children}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
