import React from "react";
import { cn } from "@/lib/utils";
import { Brain, Target } from "lucide-react";

interface CentralCommandProps {
  score: number;
  status: string;
  prediction: string;
}

export const CentralCommand: React.FC<CentralCommandProps> = ({
  score,
  status,
  prediction,
}) => {
  return (
    <div className="relative w-full aspect-square max-h-[350px] flex items-center justify-center p-4">
      {/* OUTER RING (DECORATIVE) */}
      <div className="absolute inset-0 rounded-full border border-slate-800/50 animate-[spin_20s_linear_infinite_reverse]" />
      <div className="absolute inset-4 rounded-full border border-dashed border-slate-700/30 animate-[spin_60s_linear_infinite]" />

      {/* AI SCORE CIRCLE */}
      <div className="relative w-[70%] h-[70%] rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {/* Dynamic Halo - Red below 50, Green above 65, Amber in between */}
        <div
          className={cn(
            "absolute inset-0 rounded-full opacity-20 blur-xl transition-colors duration-1000",
            score >= 65
              ? "bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]"
              : score < 50
                ? "bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.4)]"
                : "bg-slate-500 shadow-[0_0_40px_rgba(100,116,139,0.3)]",
          )}
        />

        <div className="flex flex-col items-center text-center z-10 gap-3">
          <Brain className="w-12 h-12 text-cyan-400 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-500 tracking-[0.25em] uppercase">
              AI CONFIDENCE
            </span>
            <span
              className={cn(
                "text-6xl font-black font-mono tracking-tighter transition-colors duration-500 drop-shadow-2xl",
                score >= 65
                  ? "text-emerald-400"
                  : score < 50
                    ? "text-rose-400"
                    : "text-slate-400",
              )}
            >
              {score.toFixed(1)}%
            </span>
          </div>
          <div className="h-[1px] w-24 bg-slate-700/50 my-1" />

          {/* Status moved to consolidated satellite at bottom */}
        </div>
      </div>

      {/* CONSOLIDATED INFORMATION SATELLITE */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-max text-center">
        <div className="inline-flex items-center gap-4 bg-slate-900/90 border-2 border-slate-800 px-8 py-3.5 rounded-full backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] transform translate-y-1/2 transition-all duration-300">
          {/* System Status Integration */}
          {status && (
            <>
              <div
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors",
                  score >= 65
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : score < 50
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      : "bg-slate-800/40 border-slate-700 text-slate-400",
                )}
              >
                {status}
              </div>
              <div className="w-[1px] h-6 bg-slate-800" />
            </>
          )}

          {/* Prediction Flow */}
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">
              TAHMİN:
            </span>
            <span className="text-xl font-mono font-black text-white tracking-tighter glow-text-white">
              {prediction}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
