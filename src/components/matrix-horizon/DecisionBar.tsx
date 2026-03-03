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
      "relative w-full min-h-[100px] h-auto rounded-[2rem] overflow-hidden flex flex-col lg:flex-row items-center justify-between p-4 lg:px-8 border-2 backdrop-blur-3xl shadow-[0_0_60px_rgba(0,0,0,0.6)] transition-all duration-1000 group/bar gap-6 lg:gap-2",
      isLong 
        ? "bg-emerald-950/30 border-emerald-500/50 shadow-emerald-500/10" 
        : isShort
        ? "bg-rose-950/30 border-rose-500/50 shadow-rose-500/10"
        : "bg-slate-950/60 border-slate-800/80 shadow-black/90",
      className
    )}>
      
      {/* Background Premium Stripes (Taralı) */}
      <div 
        className="absolute inset-0 opacity-[0.1] pointer-events-none animate-stripes"
        style={{ 
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 15px, #fff 15px, #fff 17px)`,
        }} 
      />
      
      {/* LEFT: System Mode */}
      <div className="flex flex-col z-10 w-full lg:w-[22%] relative">
        <div className="flex items-center gap-2 mb-1.5 justify-center lg:justify-start">
            <div className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </div>
            <span className="text-[9px] uppercase font-black tracking-[0.3em] text-cyan-500/60">ANALİZ MODU</span>
        </div>
        <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="p-2 rounded-xl bg-slate-900/80 border border-white/10 shadow-2xl">
                <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex flex-col">
                <span className="text-base font-black text-white tracking-[0.1em] uppercase leading-none">{mode}</span>
                <span className="text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-widest hidden lg:block">Matrix Online</span>
            </div>
        </div>
      </div>

      {/* CENTER: THE CONSOLIDATED COCKPIT OUTCOME */}
      <div className="flex flex-col items-center gap-2 z-20 w-full lg:flex-1 lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 pointer-events-none">
        
        <div className={cn(
            "w-full max-w-[280px] px-8 py-3.5 rounded-[2rem] border-2 transition-all duration-700 flex items-center justify-center gap-4 bg-slate-950/90 backdrop-blur-3x relative group/decision overflow-hidden shadow-2xl pointer-events-auto hover:scale-[1.02]",
            isLong 
                ? "border-emerald-500/60 text-emerald-400 shadow-[0_0_50px_rgba(16,185,129,0.3)] animate-pulse" 
                : isShort
                ? "border-rose-500/60 text-rose-400 shadow-[0_0_50px_rgba(244,63,94,0.3)] animate-pulse"
                : "border-slate-700/80 text-slate-100 shadow-[20px_20px_40px_rgba(0,0,0,0.6)]"
        )}>
            {/* Inner Motion Glow */}
            <div className={cn(
                "absolute inset-0 opacity-10 blur-2xl group-hover/decision:opacity-20 transition-opacity",
                isLong ? "bg-emerald-500" : isShort ? "bg-rose-500" : "bg-white"
            )} />

            {isLong && <Play size={20} fill="currentColor" className="drop-shadow-[0_0_10px_currentColor]" />}
            {isShort && <Play size={20} fill="currentColor" className="rotate-180 drop-shadow-[0_0_10px_currentColor]" />}
            {isWait && <Pause size={20} className="drop-shadow-[0_0_10px_currentColor]" />}
            
            <span className="text-2xl font-black font-mono tracking-[-0.05em] uppercase drop-shadow-lg leading-none">
                {decision.split(' ')[0]}
            </span>

            {isWait && <X size={28} className="text-rose-500 ml-1 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]" />}
            {!isWait && <span className="text-2xl ml-1 drop-shadow-[0_0_15px_currentColor] leading-none">{decision.split(' ')[1]}</span>}
        </div>
      </div>

      {/* RIGHT: AI Suggestion & Risk Switches */}
      <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8 z-10 w-full lg:w-[45%] justify-end">
        
        {/* AI Insight */}
        <div className="flex flex-col items-center lg:items-end text-center lg:text-right shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] uppercase font-black tracking-[0.25em] text-indigo-400/80 uppercase">AI ANALİZİ</span>
            <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
          </div>
          <div className="relative group/suggest">
            <div className="bg-slate-950/90 border border-indigo-500/30 px-5 py-2 rounded-xl flex items-center justify-center min-w-[100px] shadow-inner">
                <span className="text-[11px] font-black font-mono text-white tracking-widest uppercase">
                    {aiSuggestion}
                </span>
            </div>
          </div>
        </div>

        {/* RISK SWITCHES - More Compact */}
        <div className="flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-3xl border-2 border-slate-800/80 rounded-[1.25rem] p-1.5 shadow-2xl shrink-0">
            {[
                { id: 'safe', label: 'SAFE', icon: Shield, color: 'text-emerald-400' },
                { id: 'normal', label: 'SCALP', icon: Activity, color: 'text-cyan-400' },
                { id: 'aggressive', label: 'AGGRESSIVE', icon: Zap, color: 'text-rose-500' }
            ].map((strategy) => (
                <button 
                    key={strategy.id}
                    onClick={() => onRiskModeChange(strategy.id as 'safe' | 'normal' | 'aggressive')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-500 group relative overflow-hidden",
                        riskMode === strategy.id 
                            ? "bg-slate-800 border border-slate-700 shadow-xl scale-[1.03] z-10" 
                            : "hover:bg-white/5 opacity-25 hover:opacity-100"
                    )}
                >
                    <strategy.icon className={cn(
                        "w-3.5 h-3.5", 
                        riskMode === strategy.id ? strategy.color : "text-slate-400"
                    )} />
                    <span className={cn(
                        "text-[10px] font-black tracking-[0.1em] transition-colors", 
                        riskMode === strategy.id ? "text-white" : "text-slate-500"
                    )}>
                        {strategy.label}
                    </span>
                    {strategy.id === 'aggressive' && riskMode === 'aggressive' && (
                        <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,1)] animate-ping" />
                    )}
                </button>
            ))}
        </div>
      </div>

    </div>
  );
};
