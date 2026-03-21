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
    title: "TARAMA",
    codeRef: "runPilotCycle()",
    image: "/pipeline/station-scanner.png",
    accentColor: "#a855f7",
    glowColor: "rgba(168,85,247,0.7)",
    x: 8,
    y: 40,
    phaseLabelPos: { x: 50, y: 70 },
    workers: [
      { emoji: "🤖", label: "Scanner", posX: -20, posY: 95 },
    ],
    checkpoints: ["ensureReEntryMapLoaded", "getActiveSmartTrades", "assetsToScan: top60 + holdings", "processPilotChunk(BATCH)"],
  },
  {
    id: "analyze",
    phaseNum: "PHASE II",
    phase: "ANALYZE",
    title: "ANALİZ",
    codeRef: "MatrixV5.analyze()",
    image: "/pipeline/station-intelligence.png",
    accentColor: "#3b82f6",
    glowColor: "rgba(59,130,246,0.7)",
    x: 25,
    y: 38,
    phaseLabelPos: { x: -40, y: 80 },
    workers: [
      { emoji: "🧠", label: "AI Scorer", posX: 140, posY: 70 },
    ],
    checkpoints: ["F4 Power Analysis", "SMC: Market Structure", "GIGA MASTER Score", "MTF Consensus (1m-4h)"],
  },
  {
    id: "guard",
    phaseNum: "PHASE III",
    phase: "GUARD",
    title: "GÜVENLİK",
    codeRef: "handleSignal() Guards",
    image: "/pipeline/station-guard.png",
    accentColor: "#f59e0b",
    glowColor: "rgba(245,158,11,0.7)",
    x: 42,
    y: 42,
    phaseLabelPos: { x: -60, y: 70 },
    workers: [
      { emoji: "🚔", label: "TF Isolator", posX: -30, posY: 90 },
    ],
    checkpoints: ["TF Match: scan vs pilot", "Deduplication: Recent trades", "Matrix/Hedge Mode Vetoes", "Trend Flipping: EXIT check"],
  },
  {
    id: "allocate",
    phaseNum: "PHASE IV",
    phase: "ALLOCATE",
    title: "SERMAYE",
    codeRef: "calculateAllocation()",
    image: "/pipeline/station-allocate.png",
    accentColor: "#f43f5e",
    glowColor: "rgba(244,63,94,0.7)",
    x: 59,
    y: 39,
    phaseLabelPos: { x: -60, y: 80 },
    workers: [
      { emoji: "💰", label: "Balance Calc", posX: -35, posY: 95 },
    ],
    checkpoints: ["Free USDT Check", "Pilot Allocation %", "Re-Entry Proceeds Detect", "Risk/Reward >= 1.5x Validate"],
  },
  {
    id: "execute",
    phaseNum: "PHASE V",
    phase: "EXECUTE",
    title: "FIRLATMA",
    codeRef: "SmartTrade Routing",
    image: "/pipeline/station-execute.png",
    accentColor: "#10b981",
    glowColor: "rgba(16,185,129,0.7)",
    x: 76,
    y: 41,
    phaseLabelPos: { x: 90, y: 80 },
    workers: [
      { emoji: "🚀", label: "Market Buy", posX: -30, posY: 95 },
    ],
    checkpoints: ["executeNewBuy()", "executeReEntryBuy()", "executeCover()", "Position Adoption (useExisting)"],
  },
  {
    id: "audit",
    phaseNum: "PHASE VI",
    phase: "AUDIT",
    title: "DENETİM",
    codeRef: "recordSignalResult()",
    image: "/pipeline/station-audit.png",
    accentColor: "#06b6d4",
    glowColor: "rgba(6,182,212,0.7)",
    x: 92,
    y: 40,
    phaseLabelPos: { x: 90, y: 60 },
    workers: [
      { emoji: "📝", label: "Signal Archivery", posX: -25, posY: 95 },
    ],
    checkpoints: ["Record Veto Reason", "Build CombatLog Insights", "Store strategy_signals", "UI Signal Card Notification"],
  },
];

// Road path: Straight horizontal flow with slight wave
const ROAD_PATH = "M 50,450 Q 600,400 1150,450";

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
    {/* Isometric Square Platform - Slightly smaller */}
    <div className="relative" style={{ width: "160px", height: "80px" }}>
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: "linear-gradient(135deg, rgba(30,41,59,0.9), rgba(0,0,0,1))",
          transform: "rotateX(55deg) rotateZ(45deg)",
          border: `2px solid ${station.accentColor}44`,
          boxShadow: `0 0 40px ${station.glowColor.replace("0.7", "0.2")}, inset 0 0 20px ${station.accentColor}33`,
        }}
      />
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          isActive ? "opacity-100" : "opacity-40"
        )}
        style={{
          borderBottom: `3px solid ${station.accentColor}`,
          borderRight: `3px solid ${station.accentColor}`,
          transform: "rotateX(55deg) rotateZ(45deg) translate(2px, 2px)",
          filter: `drop-shadow(0 0 10px ${station.accentColor})`,
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
        width: "180px",
        height: "180px",
        transform: "translate(-50%, -50%)",
        zIndex: isActive ? 1000 : 30 + index,
      }}
    >
      <div className="ml-[-10px]">
        <IslandPlatform station={station} isActive={isActive} />
      </div>

      {/* Very subtle background number */}
      <div
        className="absolute pointer-events-none select-none font-black italic tracking-tighter text-white/5 whitespace-nowrap"
        style={{
          left: `10px`,
          top: `20px`,
          fontSize: "42px",
          color: isActive ? station.accentColor + "11" : "rgba(255,255,255,0.01)",
        }}
      >
        0{index + 1}
      </div>

      {/* Building Image */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: -15, opacity: 1 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.6 }}
        className="relative z-40 w-full h-full flex flex-col items-center justify-center"
      >
        <Image
          src={station.image}
          alt={station.title}
          width={180}
          height={180}
          className="w-[75%] h-auto object-contain transition-all duration-500"
          style={{
            filter: isActive
              ? `drop-shadow(0 0 35px ${station.glowColor})`
              : `drop-shadow(0 15px 15px rgba(0,0,0,0.9))`,
            transform: isActive ? "scale(1.15)" : "scale(1)",
          }}
        />
        <div className="w-[80px] h-[10px] bg-black/40 blur-lg rounded-[50%] -mt-2 opacity-60 ml-[-10px]" />
      </motion.div>

      {/* Small title box */}
      <div className="absolute top-[85%] left-1/2 -translate-x-1/2 text-center pointer-events-none z-50 whitespace-nowrap bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/5">
        <h4 className="text-[10px] font-black text-white uppercase tracking-wider">{station.title}</h4>
      </div>

      {/* Workers */}
      {station.workers.map((w, wi) => (
        <div key={wi} className="absolute flex flex-col items-center" style={{ left: `${w.posX}px`, top: `${w.posY}px`, zIndex: 45 }}>
          <motion.span className="text-xl" animate={{ y: [0, -3, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: wi * 1 }}>{w.emoji}</motion.span>
        </div>
      ))}

      {/* Detail Tooltip */}
      <AnimatePresence>
        {isActive && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute left-1/2 -translate-x-1/2 top-[105%] w-[240px] bg-slate-950/98 border border-white/10 rounded-xl p-4 shadow-4xl backdrop-blur-xl z-[150]">
            <div className="text-[10px] font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: station.accentColor }} />
              {station.phaseNum} LOGİK
            </div>
            {station.checkpoints.map((cp, i) => (
              <div key={i} className="flex items-start gap-3 mb-2 text-slate-400">
                <span className="text-[9px] font-mono opacity-30 mt-0.5">0{i+1}</span>
                <span className="text-[10px] font-bold leading-tight">{cp}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PilotPipeline3D = () => {
  const [activeId, setActiveId] = useState<string | null>(STATIONS[0].id);

  return (
    <div className="relative w-full overflow-hidden bg-transparent min-h-[420px] lg:min-h-[480px]">
      {/* Dynamic BG */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-blue-900/5 blur-[150px] opacity-20" />
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[length:40px_40px]" />
      </div>

      <div className="relative z-10 px-4 py-6 max-w-[1240px] mx-auto">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8 flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h2 className="text-2xl md:text-3xl font-black italic text-white uppercase tracking-tighter">
              PILOT <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-400">PIPELINE</span>
            </h2>
            <div className="h-px w-12 bg-slate-800" />
            <span className="text-slate-500 text-[8px] font-black tracking-[0.4em] uppercase opacity-60">SYSTEM FLOW V5.1</span>
          </div>
          
          <div className="flex gap-6 font-black text-[8px] uppercase tracking-[0.4em] text-slate-700 hidden sm:flex">
             <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /><span>Link: OK</span></div>
             <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" /><span>99.9% PRECISE</span></div>
          </div>
        </motion.div>

        {/* ═══ MAP VIEWPORT ═══ */}
        <div className="relative w-full" style={{ aspectRatio: "24/8" }}>
          {/* Cyber Highway Road SVG */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 900" style={{ zIndex: 10 }}>
            <defs>
              <linearGradient id="flowPath" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <path d={ROAD_PATH} stroke="url(#flowPath)" strokeWidth="40" fill="none" opacity="0.05" filter="blur(20px)" />
            <path d={ROAD_PATH} stroke="rgba(15,23,42,0.9)" strokeWidth="22" fill="none" strokeLinecap="round" />
            <path d={ROAD_PATH} stroke="url(#flowPath)" strokeWidth="1" fill="none" opacity="0.5" />
            <motion.path d={ROAD_PATH} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" fill="none" strokeDasharray="10 40"
              animate={{ strokeDashoffset: [-100, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
          </svg>

          {/* 🚗 SIGNAL VEHICLE */}
          <motion.div className="absolute z-[110] pointer-events-none" style={{ offsetPath: `path("${ROAD_PATH}")`, offsetRotate: "auto 90deg" }}
            animate={{ offsetDistance: ["0%", "100%"] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }}>
            <div className="relative w-16 h-16 flex items-center justify-center translate-y-[-50%]">
              <div className="absolute w-12 h-12 bg-cyan-500/30 blur-2xl rounded-full" />
              <img src="/pipeline/signal-vehicle.png" alt="Signal" className="relative w-12 h-12 object-contain filter brightness-125" />
            </div>
          </motion.div>

          {/* Station Nodes */}
          {STATIONS.map((station, idx) => (
            <StationNode key={station.id} station={station} index={idx} isActive={activeId === station.id} onClick={() => setActiveId(activeId === station.id ? null : station.id)} />
          ))}
        </div>
      </div>
    </div>
  );
};
