"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { CyberMarkdown } from "./CyberMarkdown";
import { LucideIcon } from "lucide-react";

interface HologramCardProps {
  title: string;
  content: string;
  icon?: LucideIcon;
  visualType?:
    | "overview"
    | "architecture"
    | "trailing"
    | "engine"
    | "settings"
    | "defense"
    | "strategy"
    | "routine"
    | "whale"
    | "regime"
    | "smc"
    | "radar"
    | "killswitch"
    | "decay"
    | "bayesian"
    | "bridge"
    | "trailing_buy"
    | "trailing_sell"
    | "ai_score"
    | "stop_loss"
    | "breakeven"
    | "wick_protection"
    | "panic"
    | "test_mode"
    | "ob"
    | "volatility"
    | "zscore"
    | "capital"
    | "fvg"
    | "alarms"
    | "scalp"
    | "swing"
    | "performance"
    | "limit"
    | "market"
    | "split_tp"
    | "timeout"
    | "tech_panel"
    | "decision"
    | "simulator";
  image?: string;
  className?: string;
  delay?: number;
}

export const HologramCard: React.FC<HologramCardProps> = ({
  title,
  content,
  icon: Icon,
  visualType,
  image,
  className,
  delay = 0,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const tiltX = (y - 0.5) * 20; // Max 10 deg tilt
    const tiltY = (x - 0.5) * -20;

    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${isHovered ? 1.02 : 1})`,
        transition: isHovered
          ? "transform 0.1s ease-out"
          : "transform 0.5s ease-out",
        animationDelay: `${delay}ms`,
      }}
      className={cn(
        "group relative bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both min-h-[500px] flex flex-col",
        className,
      )}
    >
      {/* Hologram Glow Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50" />
        <div className="absolute -inset-px bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Scanning Light */}
        <div className="absolute top-0 left-[-100%] w-[200%] h-full bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg] group-hover:animate-shimmer" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex items-center gap-4 mb-6">
          {Icon && (
            <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <Icon className="w-6 h-6 text-cyan-400" />
            </div>
          )}
          <h2 className="text-xl font-black italic tracking-tighter text-white uppercase group-hover:text-cyan-400 transition-colors">
            {title}
          </h2>
        </div>

        {/* 3D Visual Content (CSS/SVG Visualization) OR AI Image */}
        {image ? (
          <div className="mb-8 relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 group/img">
            <Image
              src={image}
              alt={title}
              fill
              style={{
                objectFit: "cover",
              }}
              className="transition-transform duration-700 group-hover/img:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
          </div>
        ) : visualType ? (
          <div className="mb-8">
            <div className="w-full h-24 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-cyan-400/50 text-xs font-mono uppercase">
                {visualType}
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex-1">
          <CyberMarkdown content={content} className="prose-sm" />
        </div>

        {/* Cyber Footer Tag */}
        <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4 opacity-50 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-2">
            <div className="w-1 h-1 rounded-full bg-cyan-500" />
            <div className="w-1 h-1 rounded-full bg-cyan-500/50" />
            <div className="w-1 h-1 rounded-full bg-cyan-500/20" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Secure Protocol v4
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          from {
            transform: translateX(-100%) skewX(-20deg);
          }
          to {
            transform: translateX(100%) skewX(-20deg);
          }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};
