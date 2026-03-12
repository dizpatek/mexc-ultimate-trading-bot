import React from "react";
import { cn } from "@/lib/utils";
import { Shield, Sparkles, Play, Pause, Activity, Zap, X } from "lucide-react";

interface DecisionBarProps {
  decision: "İŞLEM AÇ ✅" | "BEKLE ❌" | "SATIŞ YAP 📉";
  aiSuggestion: string;
  className?: string;
  mode: string;
  riskMode: "safe" | "normal" | "aggressive";
  pilotStatus?: "IDLE" | "SCANNING" | "EXECUTING";
  onRiskModeChange: (mode: "safe" | "normal" | "aggressive") => void;
}

export const DecisionBar: React.FC<DecisionBarProps> = ({
  decision,
  aiSuggestion,
  className,
  mode,
  riskMode,
  pilotStatus = "IDLE",
  onRiskModeChange,
}) => {
  const isLong = decision === "İŞLEM AÇ ✅";
  const isShort = decision === "SATIŞ YAP 📉";
  const isWait = decision === "BEKLE ❌";

  return (
    <div
      className={cn(
        "relative w-[98%] max-w-[850px] mx-auto h-auto rounded-xl overflow-hidden flex flex-col items-center justify-center py-3 px-3 border-2 backdrop-blur-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] transition-all duration-1000 group/bar gap-3",
        isLong
          ? "bg-emerald-950/30 border-emerald-500/50 shadow-emerald-500/10"
          : isShort
            ? "bg-rose-950/30 border-rose-500/50 shadow-rose-500/10"
            : "bg-slate-950/60 border-slate-800/80 shadow-black/90",
        className,
      )}
    >
      {/* Background Premium Stripes (Taralı) */}
      <div
        className="absolute inset-0 opacity-[0.1] pointer-events-none animate-stripes"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 15px, #fff 15px, #fff 17px)`,
        }}
      />

      {/* ROW 1: 3 Modules side by side */}
      <div className="grid grid-cols-3 w-full gap-2 lg:gap-3 relative z-10 items-stretch">
        
        {/* 1) System Mode Box */}
        <div className="flex flex-col items-center justify-center text-center p-2 rounded-xl bg-slate-950/90 border border-slate-800/80 shadow-inner h-full w-full">
          <div className="flex items-center gap-1 mb-2">
            <div className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
            </div>
            <span className="text-[8px] lg:text-[9px] uppercase font-black tracking-[0.2em] text-cyan-500/60 leading-none">
              ANALİZ MODU
            </span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <div className="p-1.5 rounded-lg bg-slate-900 border border-white/5 shadow-lg hidden lg:block">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[11px] sm:text-xs lg:text-sm font-black text-white tracking-[0.1em] uppercase leading-none truncate whitespace-nowrap">
                {mode}
              </span>
              <span className="text-[7px] lg:text-[8px] font-bold text-slate-500 uppercase mt-1 tracking-widest">
                Matrix Online
              </span>
              {pilotStatus !== "IDLE" && (
                <span className={cn(
                  "text-[8px] font-black uppercase mt-1 tracking-widest flex items-center gap-1 justify-center",
                  pilotStatus === "SCANNING" ? "text-cyan-400 animate-pulse" : "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                )}>
                  {pilotStatus === "SCANNING" ? (
                    <><Activity className="w-2 h-2 animate-spin" /> PİLOT TARANIYOR</>
                  ) : (
                    <><Zap className="w-2 h-2 animate-bounce" /> PİLOT AKTİF</>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2) CONSOLIDATED COCKPIT OUTCOME */}
        <div className="flex flex-col items-center justify-center h-full w-full">
          <div
            className={cn(
              "w-full h-full max-w-[200px] px-3 py-2 rounded-xl border border-b-2 transition-all duration-700 flex flex-col sm:flex-row items-center justify-center gap-2 bg-slate-950/90 backdrop-blur-3xl relative group/decision overflow-hidden shadow-xl pointer-events-auto hover:scale-[1.02]",
              isLong
                ? "border-emerald-500/60 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.4)] animate-pulse"
                : isShort
                  ? "border-rose-500/60 text-rose-400 shadow-[0_0_40px_rgba(244,63,94,0.4)] animate-pulse"
                  : "border-slate-700/80 text-slate-100 shadow-[10px_10px_20px_rgba(0,0,0,0.6)]",
            )}
          >
            {/* Inner Motion Glow */}
            <div
              className={cn(
                "absolute inset-0 opacity-10 blur-xl group-hover/decision:opacity-20 transition-opacity",
                isLong ? "bg-emerald-500" : isShort ? "bg-rose-500" : "bg-white",
              )}
            />

            {isLong && (
              <Play
                size={18}
                fill="currentColor"
                className="drop-shadow-[0_0_10px_currentColor] mb-1 sm:mb-0"
              />
            )}
            {isShort && (
              <Play
                size={18}
                fill="currentColor"
                className="rotate-180 drop-shadow-[0_0_10px_currentColor] mb-1 sm:mb-0"
              />
            )}
            {isWait && (
              <Pause size={18} className="drop-shadow-[0_0_10px_currentColor] mb-1 sm:mb-0" />
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-base font-black font-mono tracking-[-0.05em] uppercase drop-shadow-lg leading-none">
                {decision.split(" ")[0]}
              </span>

              {isWait && (
                <X
                  size={18}
                  className="text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.6)]"
                />
              )}
              {!isWait && (
                <span className="text-base drop-shadow-[0_0_10px_currentColor] leading-none">
                  {decision.split(" ")[1]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3) AI Suggestion Box */}
        <div className="flex flex-col items-center text-center justify-center p-2 rounded-xl bg-slate-950/90 border border-slate-800/80 shadow-inner h-full w-full">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[8px] lg:text-[9px] uppercase font-black tracking-[0.2em] text-indigo-400/80 leading-none">
              AI ANALİZİ
            </span>
            <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
          </div>
          <div className="relative group/suggest w-full flex justify-center h-full items-center">
            <div className="bg-slate-900 border border-indigo-500/30 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex items-center justify-center w-full shadow-sm max-w-[150px]">
              <span className="text-[9px] sm:text-[10px] lg:text-[11px] font-black font-mono text-white tracking-widest uppercase truncate whitespace-nowrap text-center leading-tight">
                {aiSuggestion}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ROW 2: RISK SWITCHES - Aligned with the above */}
      <div className="w-full flex justify-center z-10 px-0 sm:px-4">
        <div className="flex items-center justify-between w-full gap-1 bg-slate-950/90 backdrop-blur-3xl border border-slate-800/80 rounded-xl p-1 shadow-2xl">
          {[
            {
              id: "safe",
              label: "SAFE",
              icon: Shield,
              color: "text-emerald-400",
            },
            {
              id: "normal",
              label: "SCALP",
              icon: Activity,
              color: "text-cyan-400",
            },
            {
              id: "aggressive",
              label: "AGGRESSIVE",
              icon: Zap,
              color: "text-rose-500",
            },
          ].map((strategy) => (
            <button
              key={strategy.id}
              onClick={() =>
                onRiskModeChange(
                  strategy.id as "safe" | "normal" | "aggressive",
                )
              }
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-500 group relative overflow-hidden",
                riskMode === strategy.id
                  ? "bg-slate-800 border-b-2 border-slate-600 shadow-xl scale-[1.02] z-10"
                  : "hover:bg-white/5 opacity-40 hover:opacity-100",
              )}
            >
              <strategy.icon
                className={cn(
                  "w-3 h-3 md:w-3.5 md:h-3.5",
                  riskMode === strategy.id ? strategy.color : "text-slate-400",
                )}
              />
              <span
                className={cn(
                  "text-[9px] md:text-[10px] font-black tracking-[0.1em] transition-colors",
                  riskMode === strategy.id ? "text-white" : "text-slate-500",
                )}
              >
                {strategy.label}
              </span>
              {strategy.id === "aggressive" && riskMode === "aggressive" && (
                <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,1)] animate-ping" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
