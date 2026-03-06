import React, { useState, useEffect } from "react";
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
  const [rotation, setRotation] = useState({ x: 15, y: -10, z: 0 });

  // PSEUDO-RANDOM MOTION ENGINE
  useEffect(() => {
    const intervalId = setInterval(() => {
      setRotation({
        x: (Math.random() * 40) - 20, // -20 to 20
        y: (Math.random() * 40) - 20, // -20 to 20
        z: (Math.random() * 10) - 5    // -5 to 5
      });
    }, 2500 + Math.random() * 3000); // Random interval between 2.5s and 5.5s

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="relative w-full aspect-square max-h-[350px] flex items-center justify-center p-4">
      {/* DYSON SPHERE - HIGH-VISIBILITY CAGE STRUCTURE */}
      <div className="absolute inset-0 perspective-[3000px] overflow-visible pointer-events-none">
        {[
          { rot: "rotateX(82deg) rotateZ(0deg)", dur: "10s", color: "border-cyan-400/60", scale: "inset-[-45%]" },
          { rot: "rotateX(79deg) rotateZ(30deg)", dur: "15s", color: "border-indigo-400/50", scale: "inset-[-40%]" },
          { rot: "rotateX(81deg) rotateZ(60deg)", dur: "12s", color: "border-emerald-400/40", scale: "inset-[-38%]" },
          { rot: "rotateX(78deg) rotateZ(90deg)", dur: "20s", color: "border-purple-400/50", scale: "inset-[-42%]" },
          { rot: "rotateX(83deg) rotateZ(120deg)", dur: "14s", color: "border-blue-400/40", scale: "inset-[-35%]" },
          { rot: "rotateX(80deg) rotateZ(150deg)", dur: "25s", color: "border-slate-400/50", scale: "inset-[-44%]" },
          { rot: "rotateX(81deg) rotateZ(180deg)", dur: "11s", color: "border-cyan-500/30", scale: "inset-[-32%]" },
          { rot: "rotateX(79deg) rotateZ(210deg)", dur: "18s", color: "border-indigo-500/20", scale: "inset-[-28%]" },
        ].map((ring, i) => (
          <div
            key={i}
            className={cn(
               "absolute border-[1.5px] rounded-[50%] transition-all duration-1000",
               ring.color,
               ring.scale
            )}
            style={{
              transform: ring.rot,
              animation: `dyson-spin-${i} ${ring.dur} linear infinite`,
              boxShadow: '0 0 15px rgba(0,0,0,0.4), inset 0 0 10px rgba(255,255,255,0.05)'
            }}
          >
            {/* Structural Ribs ( Cage Grid ) - 12 segments per ring */}
            {[...Array(12)].map((_, tickIdx) => (
              <div 
                key={tickIdx}
                className="absolute w-[1.5px] h-3 bg-current opacity-40"
                style={{
                  left: '50%',
                  top: '-1.5px',
                  transformOrigin: '50% 50%',
                  transform: `rotate(${(tickIdx * 30)}deg) translateY(${6 - i*2}px)`
                }}
              />
            ))}

            {/* Orbital Power Nodes */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_25px_white] animate-pulse z-10" />
            <div className="absolute top-1/4 right-[5%] w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
          </div>
        ))}

        {/* DYSON SWARM - DATA PULSARS */}
        <div className="absolute inset-[-10%] [transform-style:preserve-3d] animate-[spin_40s_linear_infinite]">
          {[...Array(15)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-1.5 h-1.5 bg-white/70 rounded-full shadow-[0_0_12px_white]"
              style={{
                transform: `rotateY(${i * 24}deg) rotateX(${i * 18}deg) translateZ(240px)`,
                animation: `float-${i} ${4 + Math.random() * 6}s ease-in-out infinite`
              }}
            />
          ))}
        </div>

        {/* Central Core Aura */}
        <div className="absolute inset-0 rounded-full bg-cyan-400/5 blur-[120px] animate-pulse" />
      </div>

      <style jsx>{`
        @keyframes dyson-spin-0 { from { transform: rotateX(82deg) rotateZ(0deg); } to { transform: rotateX(82deg) rotateZ(360deg); } }
        @keyframes dyson-spin-1 { from { transform: rotateX(79deg) rotateZ(30deg); } to { transform: rotateX(79deg) rotateZ(390deg); } }
        @keyframes dyson-spin-2 { from { transform: rotateX(81deg) rotateZ(60deg); } to { transform: rotateX(81deg) rotateZ(420deg); } }
        @keyframes dyson-spin-3 { from { transform: rotateX(78deg) rotateZ(90deg); } to { transform: rotateX(78deg) rotateZ(450deg); } }
        @keyframes dyson-spin-4 { from { transform: rotateX(83deg) rotateZ(120deg); } to { transform: rotateX(83deg) rotateZ(480deg); } }
        @keyframes dyson-spin-5 { from { transform: rotateX(80deg) rotateZ(150deg); } to { transform: rotateX(80deg) rotateZ(510deg); } }
        @keyframes dyson-spin-6 { from { transform: rotateX(81deg) rotateZ(180deg); } to { transform: rotateX(81deg) rotateZ(540deg); } }
        @keyframes dyson-spin-7 { from { transform: rotateX(79deg) rotateZ(210deg); } to { transform: rotateX(79deg) rotateZ(570deg); } }
        ${[...Array(15)].map((_, i) => `
          @keyframes float-${i} { 
            0%, 100% { transform: rotateY(${i * 24}deg) rotateX(${i * 18}deg) translateZ(240px); } 
            50% { transform: rotateY(${i * 24}deg) rotateX(${i * 18}deg) translateZ(280px); } 
          }
        `).join('\n')}
      `}</style>

      {/* 3D CORE COMPONENT - RANDOMIZED 3D MOTION */}
      <div 
        className={cn(
          "relative w-[70%] h-[70%] flex items-center justify-center transform-gpu [transform-style:preserve-3d] transition-all duration-[3000ms] ease-in-out group/core",
        )}
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`
        }}
      >
        {/* Holographic Glowing Base (No solid background) */}
        <div
          className={cn(
            "absolute inset-0 rounded-full opacity-30 blur-2xl transition-colors duration-1000 animate-pulse",
            score >= 65
              ? "bg-emerald-500/40 shadow-[0_0_60px_rgba(16,185,129,0.4)]"
              : score < 50
                ? "bg-rose-500/40 shadow-[0_0_60px_rgba(244,63,94,0.4)]"
                : "bg-slate-500/40 shadow-[0_0_60px_rgba(100,116,139,0.3)]",
          )}
        />

        <div className="flex flex-col items-center text-center z-10 gap-3 [transform:translateZ(60px)]">
          <Brain className="w-14 h-14 text-cyan-400 animate-pulse drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white/40 tracking-[0.4em] uppercase font-mono">
              NEURAL_LINK::SYSTEM
            </span>
            <span
              className={cn(
                "text-7xl font-black font-mono tracking-tighter transition-all duration-500",
                "drop-shadow-[0_0_25px_var(--glow-color)]",
                score >= 65
                  ? "text-emerald-400 [--glow-color:rgba(16,185,129,0.7)]"
                  : score < 50
                    ? "text-rose-400 [--glow-color:rgba(244,63,94,0.7)]"
                    : "text-slate-400 [--glow-color:rgba(148,163,184,0.7)]",
              )}
            >
              {score.toFixed(1)}%
            </span>
          </div>
          <div className="h-[2px] w-32 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent my-1" />
        </div>

        {/* 3D DEBRIS / DATA NODES ORBITING CORE */}
        <div className="absolute inset-0 [transform-style:preserve-3d] animate-[spin_12s_linear_infinite]">
            <div className="absolute top-0 left-1/2 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan] [transform:translateZ(100px)]" />
            <div className="absolute bottom-0 left-1/4 w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_10px_indigo] [transform:translateZ(-80px)]" />
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
