import React from 'react';
import { cn } from '@/lib/utils';

interface HorizonCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  glowColor?: "cyan" | "emerald" | "rose" | "amber" | "indigo";
}

export const HorizonCard: React.FC<HorizonCardProps> = ({ 
  children, 
  className,
  title,
  icon,
  glowColor = "indigo"
}) => {
  
  const glowMap = {
      cyan: "shadow-cyan-500/10 border-cyan-500/20",
      emerald: "shadow-emerald-500/10 border-emerald-500/20",
      rose: "shadow-rose-500/10 border-rose-500/20",
      amber: "shadow-amber-500/10 border-amber-500/20",
      indigo: "shadow-indigo-500/10 border-indigo-500/20",
  };

  return (
    <div className={cn(
        "relative bg-[#0f172a]/40 backdrop-blur-md rounded-xl border flex flex-col overflow-hidden transition-all duration-300 group",
        glowMap[glowColor],
        className
    )}>
        
        {/* Animated Border Gradient on Hover */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

        {/* Header (Optional) */}
        {title && (
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/5">
                {icon && <span className="text-slate-400 opacity-80">{icon}</span>}
                <span className="text-xs font-bold uppercase tracking-widest text-slate-300 font-mono">{title}</span>
            </div>
        )}

        {/* Content */}
        <div className="flex-1 relative z-10">
            {children}
        </div>

        {/* Tech Corners (Decorative) */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 rounded-tl pointer-events-none" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 rounded-tr pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/20 rounded-bl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 rounded-br pointer-events-none" />

    </div>
  );
};
