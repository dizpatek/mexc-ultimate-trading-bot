"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";

/* ═══════════════════════════════════════════════════════════════
   PILOT PIPELINE — ISOMETRIC 3D ROADMAP
   Uses AI-generated 3D station images positioned along
   a winding isometric SVG road (EZZSTAR reference style).
   ═══════════════════════════════════════════════════════════════ */

interface Worker {
  emoji: string;
  label: string;
  posX: number;
  posY: number;
}

interface Station {
  id: string;
  phase: string;
  phaseNum: string;
  title: string;
  codeRef: string;
  image: string;
  accentColor: string;
  glowColor: string;
  workers: Worker[];
  checkpoints: string[];
  x: number;
  y: number;
  phaseLabelPos: { x: number; y: number };
}

const STATIONS: Station[] = [
  {
    id: "scan",
    phaseNum: "PHASE I",
    phase: "SCAN",
    title: "TARAMA İSTASYONU",
    codeRef: "runPilotCycle()",
    image: "/pipeline/station-scanner.png",
    accentColor: "#a855f7",
    glowColor: "rgba(168,85,247,0.7)",
    x: 18,
    y: 18,
    phaseLabelPos: { x: 130, y: 70 },
    workers: [
      { emoji: "🤖", label: "Re-Entry Loader", posX: -35, posY: 95 },
      { emoji: "🔬", label: "Chunk Splitter", posX: 145, posY: 75 },
    ],
    checkpoints: ["ensureReEntryMapLoaded", "getActiveSmartTrades", "assetsToScan: top60 + holdings", "processPilotChunk(BATCH)"],
  },
  {
    id: "analyze",
    phaseNum: "PHASE II",
    phase: "ANALYZE",
    title: "ANALİZ MERKEZİ",
    codeRef: "MatrixV5.analyze()",
    image: "/pipeline/station-intelligence.png",
    accentColor: "#3b82f6",
    glowColor: "rgba(59,130,246,0.7)",
    x: 50,
    y: 15,
    phaseLabelPos: { x: -60, y: 80 },
    workers: [
      { emoji: "👨‍🔬", label: "F4 Analyzer", posX: -40, posY: 90 },
      { emoji: "🧠", label: "AI Scorer", posX: 150, posY: 70 },
    ],
    checkpoints: ["F4 Power Analysis", "SMC: Market Structure", "GIGA MASTER Score", "MTF Consensus (1m-4h)"],
  },
  {
    id: "guard",
    phaseNum: "PHASE III",
    phase: "GUARD",
    title: "GÜVENLİK NOKTASI",
    codeRef: "handleSignal() Guards",
    image: "/pipeline/station-guard.png",
    accentColor: "#f59e0b",
    glowColor: "rgba(245,158,11,0.7)",
    x: 82,
    y: 22,
    phaseLabelPos: { x: -80, y: 70 },
    workers: [
      { emoji: "🚔", label: "TF Isolator", posX: -45, posY: 90 },
      { emoji: "✋", label: "Veto Officer", posX: 150, posY: 70 },
    ],
    checkpoints: ["TF Match: scan vs pilot", "Deduplication: Recent trades", "Matrix/Hedge Mode Vetoes", "Trend Flipping: EXIT check"],
  },
  {
    id: "allocate",
    phaseNum: "PHASE IV",
    phase: "ALLOCATE",
    title: "SERMAYE KASASI",
    codeRef: "calculateAllocation()",
    image: "/pipeline/station-allocate.png",
    accentColor: "#f43f5e",
    glowColor: "rgba(244,63,94,0.7)",
    x: 82,
    y: 75,
    phaseLabelPos: { x: -80, y: 80 },
    workers: [
      { emoji: "💰", label: "Balance Calc", posX: -45, posY: 95 },
      { emoji: "♻️", label: "Re-Entry Check", posX: 145, posY: 75 },
    ],
    checkpoints: ["Free USDT Check", "Pilot Allocation %", "Re-Entry Proceeds Detect", "Risk/Reward >= 1.5x Validate"],
  },
  {
    id: "execute",
    phaseNum: "PHASE V",
    phase: "EXECUTE",
    title: "FIRLATMA RAMPA",
    codeRef: "SmartTrade Routing",
    image: "/pipeline/station-execute.png",
    accentColor: "#10b981",
    glowColor: "rgba(16,185,129,0.7)",
    x: 50,
    y: 85,
    phaseLabelPos: { x: 130, y: 80 },
    workers: [
      { emoji: "🚀", label: "Market Buy", posX: -40, posY: 95 },
      { emoji: "🔴", label: "Cover Exit", posX: 150, posY: 75 },
    ],
    checkpoints: ["executeNewBuy()", "executeReEntryBuy()", "executeCover()", "Position Adoption (useExisting)"],
  },
  {
    id: "audit",
    phaseNum: "PHASE VI",
    phase: "AUDIT",
    title: "DENETİM ARŞİVİ",
    codeRef: "recordSignalResult()",
    image: "/pipeline/station-audit.png",
    accentColor: "#06b6d4",
    glowColor: "rgba(6,182,212,0.7)",
    x: 18,
    y: 78,
    phaseLabelPos: { x: 130, y: 60 },
    workers: [
      { emoji: "📝", label: "Signal Archivery", posX: -35, posY: 95 },
      { emoji: "💡", label: "Insight Display", posX: 155, posY: 75 },
    ],
    checkpoints: ["Record Veto Reason", "Build CombatLog Insights", "Store strategy_signals", "UI Signal Card Notification"],
  },
];

// Road path: Bracket shape [ starting top right, going left, going down, ending bottom right
const ROAD_PATH =
  "M 216,162 C 350,110 700,120 984,198 C 1050,250 1080,600 984,630 C 700,700 350,700 216,702";

const IslandPlatform = ({ station, isActive }: { station: Station; isActive: boolean }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className="absolute pointer-events-none"
    style={{
      left: `${station.x}%`,
      top: `${station.y}%`,
      transform: "translate(-50%, -50%)",
      zIndex: 5,
    }}
  >
    {/* Isometric Square Platform with improved seating */}
    <div className="relative" style={{ width: "220px", height: "120px" }}>
      {/* Platform Surface with metallic texture/glow */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: "linear-gradient(135deg, rgba(30,41,59,0.9), rgba(0,0,0,1))",
          transform: "rotateX(55deg) rotateZ(45deg)",
          border: `2px solid ${station.accentColor}44`,
          boxShadow: `0 0 50px ${station.glowColor.replace("0.7", "0.2")}, inset 0 0 30px ${station.accentColor}33`,
        }}
      />
      {/* Platform Neon Edge (Bottom Left & Right) */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          isActive ? "opacity-100" : "opacity-40"
        )}
        style={{
          borderBottom: `5px solid ${station.accentColor}`,
          borderRight: `5px solid ${station.accentColor}`,
          transform: "rotateX(55deg) rotateZ(45deg) translate(3px, 3px)",
          filter: `drop-shadow(0 0 15px ${station.accentColor})`,
        }}
      />
    </div>
  </motion.div>
);

const StationNode = ({ station, index, isActive, onClick }: { station: Station; index: number; isActive: boolean; onClick: () => void }) => {
  return (
    <div
      className="absolute cursor-pointer group"
      onClick={onClick}
      style={{
        left: `${station.x}%`,
        top: `${station.y}%`,
        width: "240px",
        height: "240px",
        transform: "translate(-50%, -50%)",
        // Z-index logic for bottom-to-top perspective: nodes with higher y should have higher z-index
        zIndex: isActive ? 1000 : 30 + Math.round(station.y),
      }}
    >
      {/* Platform - Shifted slightly LEFT to align with isometric building footprint */}
      <div className="ml-[-15px]">
        <IslandPlatform station={station} isActive={isActive} />
      </div>

      {/* Large Phase Label */}
      <motion.div
        className="absolute pointer-events-none select-none font-black italic tracking-tighter text-white/5 whitespace-nowrap"
        style={{
          left: `${station.phaseLabelPos.x}px`,
          top: `${station.phaseLabelPos.y}px`,
          fontSize: "64px",
          transform: "rotateZ(-15deg)",
          textShadow: isActive ? `0 0 30px ${station.glowColor}` : "none",
          color: isActive ? station.accentColor + "22" : "rgba(255,255,255,0.02)",
        }}
      >
        {station.phaseNum}
      </motion.div>

      {/* Building Image - Seated on Platform */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: -25, opacity: 1 }} // Moved UP slightly to allow bottom of image to sit on island
        transition={{ delay: 0.2 + index * 0.1, duration: 0.8 }}
        whileHover={{ y: -35 }}
        className="relative z-40 w-full h-full flex flex-col items-center justify-center"
      >
        <Image
          src={station.image}
          alt={station.title}
          width={280}
          height={280}
          className="w-[85%] h-auto object-contain transition-all duration-500"
          style={{
            filter: isActive
              ? `drop-shadow(0 0 45px ${station.glowColor})`
              : `drop-shadow(0 20px 20px rgba(0,0,0,0.9))`,
            transform: isActive ? "scale(1.1)" : "scale(1)",
            marginBottom: "-10px" // Dock it tighter to the platform
          }}
        />
        {/* Subtle Docking Shadow - Shifted LEFT to match platform */}
        <div className="w-[120px] h-[20px] bg-black/40 blur-xl rounded-[50%] -mt-4 opacity-70 ml-[-15px]" />
      </motion.div>

      {/* Workers - Positioned on/around the platform */}
      {station.workers.map((w, wi) => (
        <div key={wi} className="absolute flex flex-col items-center" style={{ left: `${w.posX}px`, top: `${w.posY}px`, zIndex: 45 }}>
          <motion.span className="text-2xl" animate={{ y: [0, -5, 0] }} transition={{ duration: 2.2, repeat: Infinity, delay: wi * 0.7 }}>{w.emoji}</motion.span>
          <span className={cn("text-[8.5px] font-black text-white uppercase tracking-wider px-2 py-0.5 rounded border-l-2 transition-all duration-500", isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 group-hover:opacity-60")}
            style={{ background: "rgba(0,0,0,0.9)", borderColor: station.accentColor, backdropFilter: "blur(6px)" }}>{w.label}</span>
        </div>
      ))}

      {/* Station Title Tag */}
      <div className="absolute top-[80%] left-1/2 -translate-x-1/2 text-center pointer-events-none z-50 whitespace-nowrap">
        <div className="text-[7.5px] font-black tracking-[0.4em] uppercase text-white/30 mb-1">{station.phaseNum} • {station.phase}</div>
        <h4 className="text-[13px] font-black text-white uppercase tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">{station.title}</h4>
        <code className="text-[8.5px] text-slate-500 font-mono mt-1 opacity-60 bg-black/40 px-1 rounded block">{station.codeRef}</code>
      </div>

      {/* Detailed Checkpoints */}
      <AnimatePresence>
        {isActive && (
          <motion.div initial={{ opacity: 0, x: 25 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 25 }}
            className="absolute left-[110%] top-[-20px] w-[280px] bg-slate-950/95 border-2 border-white/10 rounded-2xl p-6 shadow-3xl backdrop-blur-3xl z-[150]">
            <div className="text-[12px] font-black text-white uppercase tracking-widest mb-5 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: station.accentColor, boxShadow: `0 0 10px ${station.accentColor}` }} />
              LOGİK DENETİMİ
            </div>
            {station.checkpoints.map((cp, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
                className="flex items-start gap-4 mb-4 text-slate-200">
                <span className="text-xs font-mono opacity-40">0{i + 1}</span>
                <span className="text-[11px] font-bold leading-snug tracking-tight">{cp}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


export const PilotPipeline3D = () => {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="relative w-full overflow-hidden bg-transparent min-h-[960px]">
      {/* Enhanced Background (Cyberpunk Deep) */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-purple-900/15 blur-[250px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[800px] h-[800px] bg-cyan-900/15 blur-[250px] rounded-full" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        {/* Subtle radial scan mask */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] opacity-40" />
      </div>

      <div className="relative z-10 px-6 py-12 max-w-[1100px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-20 flex items-end justify-between">
          <div className="text-left">
            <h2 className="text-5xl md:text-7xl font-black italic text-white uppercase tracking-tighter leading-none mb-4">
              PILOT <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-400">PIPELINE</span>
            </h2>
            <p className="text-slate-500 text-[10px] font-black tracking-[0.5em] uppercase opacity-70">Automated Strategy Execution Infrastructure v5.1.0</p>
          </div>
          <div className="hidden lg:block text-right">
            <div className="text-4xl font-black text-white/[0.03] select-none tracking-widest leading-none">NEXUS CORE SYSTEM</div>
          </div>
        </motion.div>

        {/* ═══ MAP VIEWPORT ═══ */}
        <div className="relative w-full" style={{ aspectRatio: "14/10" }}>
          {/* Cyber Highway Road SVG */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 900" style={{ zIndex: 10 }}>
            <defs>
              <linearGradient id="ezPath" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="30%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="70%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <filter id="hyperGlow"><feGaussianBlur stdDeviation="15" /></filter>
              <filter id="railGlow"><feGaussianBlur stdDeviation="4" /></filter>
            </defs>

            {/* Road Foundation (Glow + Asphalt) */}
            <path d={ROAD_PATH} stroke="url(#ezPath)" strokeWidth="45" fill="none" opacity="0.1" filter="url(#hyperGlow)" />
            <path d={ROAD_PATH} stroke="rgba(15,23,42,0.8)" strokeWidth="32" fill="none" strokeLinecap="round" />
            
            {/* Energy Rails (Dual Neon) */}
            <path d={ROAD_PATH} stroke="url(#ezPath)" strokeWidth="36" fill="none" strokeLinecap="round" opacity="0.15" filter="url(#railGlow)" />
            <path d={ROAD_PATH} stroke="url(#ezPath)" strokeWidth="1.5" fill="none" opacity="0.8" />
            
            {/* Digital Flow Particles (Dashes) */}
            <motion.path d={ROAD_PATH} stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" fill="none" strokeDasharray="15 35"
              animate={{ strokeDashoffset: [-100, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
              
            {/* Speed Particles (Thin) */}
            <motion.path d={ROAD_PATH} stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" fill="none" strokeDasharray="1 100"
              animate={{ strokeDashoffset: [-500, 0] }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
          </svg>

          {/* 🚗 SIGNAL VEHICLE (Optimized movement) */}
          <motion.div className="absolute z-[110] pointer-events-none" style={{ offsetPath: `path("${ROAD_PATH}")`, offsetRotate: "auto 90deg" }}
            animate={{ offsetDistance: ["0%", "100%"] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}>
            <div className="relative w-28 h-28 flex items-center justify-center translate-y-[-50%] translate-x-[-15%]">
              {/* Complex Glow */}
              <div className="absolute w-24 h-24 bg-cyan-500/25 blur-3xl rounded-full" />
              <div className="absolute w-12 h-12 bg-white/20 blur-xl rounded-full animate-pulse" />
              <img src="/pipeline/signal-vehicle.png" alt="Signal" className="relative w-20 h-20 object-contain filter drop-shadow(0 0 25px #06b6d4) brightness-125" />
            </div>
          </motion.div>

          {/* Station Nodes */}
          {STATIONS.map((station, idx) => (
            <StationNode key={station.id} station={station} index={idx} isActive={activeId === station.id} onClick={() => setActiveId(activeId === station.id ? null : station.id)} />
          ))}
        </div>

        {/* Bottom Status bar */}
        <div className="mt-28 border-t border-white/5 pt-10 flex items-center justify-between">
           <div className="flex gap-16 font-black text-[10px] uppercase tracking-[0.6em] text-slate-800">
             <div className="flex items-center gap-2 animate-pulse"><div className="w-1.5 h-1.5 bg-green-500 rounded-full" /><span>Core Link Active</span></div>
             <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" /><span>Neural Data Flow: 1.2 GB/s</span></div>
             <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-purple-500 rounded-full" /><span>Precision: 99.9%</span></div>
           </div>
           <div className="text-cyan-500/20 text-[10px] font-black uppercase tracking-[0.8em]">© 2026 PILOT EXECUTOR MULTI-AGENT SYSTEM</div>
        </div>
      </div>
    </div>
  );
};
