import React from "react";
import { cn } from "@/lib/utils"; // Assuming this utility exists, if not I'll just use template literals or install clsx/tailwind-merge

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  borderColor?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  children,
  className,
  borderColor = "border-cyan-900/20",
}) => {
  return (
    <div
      className={cn(
        "bg-[#0f172a]/80 backdrop-blur-md rounded-xl border overflow-hidden flex flex-col relative group shadow-lg shadow-black/20",
        borderColor,
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-500/10 bg-slate-900/50 backdrop-blur-sm">
        {icon && <span className="text-cyan-400/80">{icon}</span>}
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans shadow-black drop-shadow-sm">
          {title}
        </h3>
      </div>

      {/* Body */}
      <div className="p-3 flex-1 flex flex-col gap-2 relative">
        {/* Subtle Grid Background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#22d3ee 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        {children}
      </div>
    </div>
  );
};
