import React from 'react';
import { cn } from '@/lib/utils';
import { Shield, Sparkles, Play, Pause, Activity, Zap, X } from 'lucide-react';

interface DecisionBarProps {
  decision: "İŞLEM AÇ ✅" | "BEKLE ❌" | "SATIŞ YAP 📉";
  aiSuggestion: string;
  className?: string;
  mode: string;
  riskMode: 'safe' | 'normal' | 'aggressive';
  onRiskModeChange: (mode: 'safe' | 'normal' | 'aggressive') => void;
}

export const DecisionBar: React.FC<DecisionBarProps> = ({ 
  decision, 
  aiSuggestion, 
  className,
  mode,
  riskMode,
  onRiskModeChange
}) => {
  const isLong = decision === "İŞLEM AÇ ✅";
  const isShort = decision === "SATIŞ YAP 📉";
  const isWait = decision === "BEKLE ❌";
  
  return (
    <div className={cn(
      "relative w-full h-[84px] rounded-xl overflow-hidden flex items-center justify-between px-6 border backdrop-blur-md shadow-2xl transition-all duration-500",
      isLong 
        ? "bg-emerald-950/40 border-emerald-500/30 shadow-emerald-500/20" 
        : isShort
        ? "bg-rose-950/40 border-rose-500/30 shadow-rose-500/20"
        : "bg-[#0a0f1e]/60 border-slate-700/50 shadow-slate-900/40",
      className
    )}>
      
      {/* Background Animated Stripes */}
      <div className="absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#fff_10px,#fff_12px)] pointer-events-none" />
      
      {/* LEFT: System Mode */}
      <div className="flex flex-col z-10 w-[20%]">
        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-cyan-400 mb-1">SİSTEM MODU</span>
        <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-black text-white tracking-widest uppercase">{mode}</span>
        </div>
      </div>

      {/* CENTER: The Big Button / Status */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center">
        <div className={cn(
            "min-w-[180px] px-6 py-2.5 rounded-full border transition-all duration-500 flex items-center justify-center gap-4 bg-black/40 backdrop-blur-xl",
            isLong 
                ? "border-emerald-500/50 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse" 
                : isShort
                ? "border-rose-500/50 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)] animate-pulse"
                : "border-slate-600/50 text-slate-300 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        )}>
            {isLong && <Play size={20} fill="currentColor" />}
            {isShort && <Play size={20} fill="currentColor" className="rotate-180" />}
            {isWait && <Pause size={20} />}
            
            <span className="text-xl font-black font-mono tracking-tighter uppercase">
                {decision.split(' ')[0]}
            </span>

            {isWait && <X size={24} className="text-rose-500 ml-1" />}
            {!isWait && <span className="text-xl ml-1">{decision.split(' ')[1]}</span>}
        </div>
      </div>

      {/* RIGHT: AI Suggestion & Risk Switches */}
      <div className="flex items-center gap-8 z-10">
        
        {/* AI Suggestion */}
        <div className="flex flex-col items-end text-right">
          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-indigo-400 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-300" /> YAPAY ZEKA ÖNERİSİ
          </span>
          <span className="text-[11px] font-black font-mono text-white/90 bg-indigo-950/40 px-3 py-1 rounded border border-indigo-500/30 uppercase tracking-tighter">
              {aiSuggestion}
          </span>
        </div>

        {/* Global Strategy Switcher (Translated) */}
        <div className="flex bg-slate-950/80 backdrop-blur border border-slate-800 rounded-xl p-1 gap-1">
            {[
                { id: 'safe', label: 'GİZLİ', icon: Shield, color: 'text-emerald-400' },
                { id: 'normal', label: 'SKALP', icon: Activity, color: 'text-cyan-400' },
                { id: 'aggressive', label: 'ALFA', icon: Zap, color: 'text-rose-400' }
            ].map((strategy) => (
                <button 
                    key={strategy.id}
                    onClick={() => onRiskModeChange(strategy.id as 'safe' | 'normal' | 'aggressive')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 group whitespace-nowrap",
                        riskMode === strategy.id 
                            ? "bg-slate-800 border border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)] scale-105" 
                            : "hover:bg-white/5 opacity-40 hover:opacity-100"
                    )}
                >
                    <strategy.icon className={cn("w-3.5 h-3.5", riskMode === strategy.id ? strategy.color : "text-slate-500")} />
                    <span className={cn("text-[10px] font-black tracking-widest", riskMode === strategy.id ? "text-slate-100" : "text-slate-500")}>
                        {strategy.label}
                    </span>
                </button>
            ))}
        </div>
      </div>

    </div>
  );
};
