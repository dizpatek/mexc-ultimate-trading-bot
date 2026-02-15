import React from 'react';
import { cn } from '@/lib/utils';
import { Brain, Disc, Target } from 'lucide-react';

interface CentralCommandProps {
  score: number;
  status: string;
  prediction: string;
}

export const CentralCommand: React.FC<CentralCommandProps> = ({ score, status, prediction }) => {
  const rotation = (score / 100) * 360; // Calculate rotation for circular progress
  
  return (
    <div className="relative w-full aspect-square max-h-[350px] flex items-center justify-center p-4">
      
      {/* OUTER RING (DECORATIVE) */}
      <div className="absolute inset-0 rounded-full border border-slate-800/50 animate-[spin_20s_linear_infinite_reverse]" />
      <div className="absolute inset-4 rounded-full border border-dashed border-slate-700/30 animate-[spin_60s_linear_infinite]" />

      {/* AI SCORE CIRCLE */}
      <div className="relative w-[70%] h-[70%] rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl">
         
         {/* Dynamic Halo */}
         <div 
            className={cn(
                "absolute inset-0 rounded-full opacity-20 blur-xl transition-colors duration-1000",
                score > 65 ? "bg-emerald-500" : score < 40 ? "bg-rose-500" : "bg-cyan-500"
            )} 
         />

         <div className="flex flex-col items-center text-center z-10 gap-2">
            <Brain className="w-8 h-8 text-cyan-400 animate-pulse" />
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 tracking-[0.2em] uppercase">AI CONFIDENCE</span>
                <span className={cn(
                    "text-5xl font-black font-mono tracking-tighter transition-colors duration-500 drop-shadow-2xl",
                    score > 65 ? "text-emerald-400" : score < 40 ? "text-rose-400" : "text-amber-400"
                )}>
                    {score}
                </span>
            </div>
            <div className="h-[1px] w-16 bg-slate-700/50 my-1" />
            <span className={cn(
                "text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border bg-opacity-10 backdrop-blur-md",
                score > 65 ? "border-emerald-500/30 text-emerald-400 bg-emerald-500" : "border-rose-500/30 text-rose-400 bg-rose-500"
            )}>
                {status}
            </span>
         </div>
      </div>

      {/* ORBITING PREDICTION SATELLITE */}
      <div className="absolute bottom-0 w-full text-center">
         <div className="inline-flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-full backdrop-blur-md shadow-lg transform translate-y-1/2">
            <Target className="w-3 h-3 text-cyan-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase mr-2">PREDICTION:</span>
            <span className="text-xs font-mono font-bold text-white">{prediction}</span>
         </div>
      </div>

    </div>
  );
};
