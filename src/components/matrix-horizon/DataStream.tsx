import React from 'react';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

interface DataStreamProps {
  title: string;
  data: { label: string; value: string; trend?: "UP" | "DOWN" | "NEUTRAL"; color?: string }[];
  side: "left" | "right";
  className?: string;
}

export const DataStream: React.FC<DataStreamProps> = ({ title, data, side, className }) => {
  return (
    <div className={cn(
        "flex flex-col gap-1 w-full h-full bg-slate-950/60 backdrop-blur-sm border border-slate-800/50 p-2 rounded-lg relative overflow-hidden",
        className
    )}>
      {/* Header with decorative line */}
      <div className={cn(
          "flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/50",
          side === "left" ? "flex-row" : "flex-row-reverse"
      )}>
        <div className="bg-cyan-500/20 p-1.5 rounded text-cyan-400">
            <Activity className="w-3 h-3" />
        </div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{title}</h3>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-cyan-500/0 via-cyan-500/30 to-cyan-500/0" />
      </div>

      {/* Vertical Data Stream */}
      <div className="flex flex-col gap-1.5 flex-1 relative">
        {/* Animated Scanline Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent h-[100px] w-full animate-[scan_4s_linear_infinite] pointer-events-none opacity-20" />

        {data.map((item, idx) => (
            <div key={idx} className="group relative flex items-center justify-between p-2 rounded bg-slate-900/40 hover:bg-cyan-900/10 border border-transparent hover:border-cyan-500/20 transition-all">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-cyan-300 transition-colors">
                    {item.label}
                </span>
                <span className={cn(
                    "text-xs font-mono font-medium",
                    item.color || "text-slate-200"
                )}>
                    {item.value} {item.trend === "UP" ? "▲" : item.trend === "DOWN" ? "▼" : ""}
                </span>
                
                {/* Active Indicator Dot */}
                {(item.trend === "UP" || item.trend === "DOWN") && (
                    <span className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[60%] rounded-r transition-all",
                        item.trend === "UP" ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                )}
            </div>
        ))}
      </div>
    </div>
  );
};
