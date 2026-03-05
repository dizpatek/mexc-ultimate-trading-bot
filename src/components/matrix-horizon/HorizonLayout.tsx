import React from "react";
import { cn } from "@/lib/utils";

export const HorizonLayout = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "h-screen overflow-hidden bg-[#020617] text-slate-300 font-sans selection:bg-cyan-500/30",
        className,
      )}
    >
      {/* GLOBAL BACKGROUND EFFECTS */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* 1. Base Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* 2. Top Glow */}
        <div className="absolute top-[-20%] left-[20%] w-[60%] h-[500px] bg-indigo-500/10 blur-[150px] rounded-full" />

        {/* 3. Bottom Glow */}
        <div className="absolute bottom-[-20%] right-[10%] w-[50%] h-[400px] bg-cyan-500/10 blur-[120px] rounded-full" />

        {/* 4. Scanline Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#020617_100%)]" />
      </div>

      {/* CONTENT WRAPPER */}
      <div className="relative z-10 flex flex-row h-screen">{children}</div>
    </div>
  );
};
