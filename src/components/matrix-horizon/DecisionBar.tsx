import React from 'react';
import { cn } from '@/lib/utils';
import { Shield, Sparkles, Play, Pause } from 'lucide-react';

interface DecisionBarProps {
  decision: "İŞLEM AÇ ✅" | "BEKLE ❌" | "SATIŞ YAP 📉";
  aiSuggestion: string;
  className?: string;
  mode: string;
}

export const DecisionBar: React.FC<DecisionBarProps> = ({ 
  decision, 
  aiSuggestion, 
  className,
  mode
}) => {
  const isLong = decision === "İŞLEM AÇ ✅";
  const isShort = decision === "SATIŞ YAP 📉";
  
  return (
    <div className={cn(
      "relative w-full h-[80px] rounded-lg overflow-hidden flex items-center justify-between px-6 border backdrop-blur-md shadow-2xl transition-all duration-500",
      isLong 
        ? "bg-emerald-950/40 border-emerald-500/30 shadow-emerald-500/20" 
        : isShort
        ? "bg-rose-950/40 border-rose-500/30 shadow-rose-500/20"
        : "bg-slate-950/40 border-slate-500/30 shadow-slate-500/20",
      className
    )}>
      
      {/* Background Animated Stripes */}
      <div className="absolute inset-0 opacity-[0.1] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#fff_10px,#fff_12px)] pointer-events-none" />
      
      {/* LEFT: System Mode */}
      <div className="flex flex-col z-10">
        <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-cyan-400 mb-1">SİSTEM MODU</span>
        <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-300" />
            <span className="text-sm font-mono text-white tracking-widest">{mode}</span>
        </div>
      </div>

      {/* CENTER: The Big Button / Status (Visual Only for now) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[40%] text-center">
        <div className={cn(
            "text-2xl font-black font-mono tracking-tighter px-8 py-2 rounded-full border-2 shadow-[0_0_30px_currentColor] transition-all duration-300 inline-flex items-center gap-3",
            isLong 
                ? "bg-emerald-500/10 border-emerald-400 text-emerald-400 shadow-emerald-500/40 animate-pulse" 
                : isShort
                ? "bg-rose-500/10 border-rose-400 text-rose-400 shadow-rose-500/40 animate-pulse"
                : "bg-slate-500/10 border-slate-400 text-slate-400 shadow-slate-500/40"
        )}>
            {isLong ? <Play fill="currentColor" /> : isShort ? <Play fill="currentColor" className="rotate-180" /> : <Pause />}
            {decision}
        </div>
      </div>

      {/* RIGHT: AI Suggestion */}
      <div className="flex flex-col items-end z-10 text-right">
        <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-indigo-400 mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-300" /> YAPAY ZEKA ÖNERİSİ
        </span>
        <span className="text-sm font-mono text-white/90 bg-indigo-950/50 px-3 py-1 rounded border border-indigo-500/30">
            {aiSuggestion}
        </span>
      </div>

    </div>
  );
};
