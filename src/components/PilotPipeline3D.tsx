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
    x: 6,
    y: 42,
    phaseLabelPos: { x: 50, y: 70 },
    workers: [
      { emoji: "🤖", label: "Scanner", posX: -15, posY: 100 },
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
    x: 24,
    y: 42,
    phaseLabelPos: { x: -40, y: 80 },
    workers: [
      { emoji: "🧠", label: "AI Scorer", posX: -15, posY: 100 },
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
      { emoji: "🚔", label: "TF Isolator", posX: -15, posY: 100 },
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
    x: 60,
    y: 42,
    phaseLabelPos: { x: -60, y: 80 },
    workers: [
      { emoji: "💰", label: "Balance Calc", posX: -15, posY: 105 },
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
    x: 78,
    y: 42,
    phaseLabelPos: { x: 90, y: 80 },
    workers: [
      { emoji: "🚀", label: "Market Buy", posX: -15, posY: 100 },
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
    x: 96,
    y: 42,
    phaseLabelPos: { x: 90, y: 60 },
    workers: [
      { emoji: "📝", label: "Signal Archivery", posX: -15, posY: 100 },
    ],
    checkpoints: ["Record Veto Reason", "Build CombatLog Insights", "Store strategy_signals", "UI Signal Card Notification"],
  },
];

// Road path: Straight horizontal flow with slight wave, shifted up by approx 30px (y=170 in 400 height)
const ROAD_PATH = "M 50,170 Q 600,155 1150,170";

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
      <div className="absolute inset-0">
        <IslandPlatform station={station} isActive={isActive} />
      </div>

      {/* Building Image - MUST SIT ON TOP OF PLATFORM (y: offset positive to seat) */}
      <motion.div
        initial={{ y: 0, opacity: 0 }}
        animate={{ y: 25, opacity: 1 }} // Moved DOWN to seat on the platform center
        transition={{ delay: 0.1 + index * 0.05, duration: 0.6 }}
        className="relative z-40 w-full h-full flex flex-col items-center justify-center"
      >
        <Image
          src={station.image}
          alt={station.title}
          width={220}
          height={220}
          className="w-[95%] h-auto object-contain transition-all duration-500"
          style={{
            filter: isActive
              ? `drop-shadow(0 0 35px ${station.glowColor})`
              : `drop-shadow(0 15px 15px rgba(0,0,0,0.8))`,
            transform: isActive ? "scale(1.1)" : "scale(1)",
          }}
        />
        {/* Docking Shadow */}
        <div className="w-[100px] h-[15px] bg-black/50 blur-lg rounded-[50%] absolute bottom-12 opacity-80" />
      </motion.div>

      {/* Small title box */}
      <div className="absolute top-[95%] left-1/2 -translate-x-1/2 text-center pointer-events-none z-50 whitespace-nowrap bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 shadow-xl">
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
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="absolute left-1/2 -translate-x-1/2 bottom-[115%] w-[250px] bg-slate-950/98 border border-white/10 rounded-xl p-4 shadow-4xl backdrop-blur-xl z-[150]">
            <div className="text-[10px] font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: station.accentColor }} />
              {station.phaseNum} LOGİK
            </div>
            {station.checkpoints.map((cp, i) => (
              <div key={i} className="flex items-start gap-2 mb-2 text-slate-400">
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
    <div className="relative w-full overflow-hidden bg-transparent min-h-[380px] lg:min-h-[440px]">
      {/* Dynamic BG */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-blue-900/5 blur-[150px] opacity-20" />
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[length:40px_40px]" />
      </div>

      <div className="relative z-10 px-4 py-6 max-w-[1240px] mx-auto">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-8 flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h2 className="text-lg md:text-xl font-black italic text-white uppercase tracking-tighter">
              PILOT <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-400">PIPELINE</span>
            </h2>
            <div className="h-px w-8 bg-slate-800" />
            <span className="text-slate-500 text-[8px] font-black tracking-[0.4em] uppercase opacity-60">SYSTEM FLOW V5.1</span>
          </div>
          
          <div className="flex gap-6 font-black text-[8px] uppercase tracking-[0.4em] text-slate-700 hidden sm:flex">
             <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /><span>Link: OK</span></div>
             <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" /><span>99.9% PRECISE</span></div>
          </div>
        </motion.div>

        {/* ═══ MAP VIEWPORT ═══ */}
        <div className="relative w-full" style={{ aspectRatio: "24/8" }}>
          {/* Cyber Highway Road SVG - Center aligned with 3:1 axis */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 400" preserveAspectRatio="none" style={{ zIndex: 10 }}>
            <defs>
              <linearGradient id="flowPath" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <path d={ROAD_PATH} stroke="url(#flowPath)" strokeWidth="45" fill="none" opacity="0.08" filter="blur(25px)" />
            <path d={ROAD_PATH} stroke="rgba(15,23,42,0.9)" strokeWidth="22" fill="none" strokeLinecap="round" />
            <path d={ROAD_PATH} stroke="url(#flowPath)" strokeWidth="1.5" fill="none" opacity="0.4" />
            
            {/* Energy flow - INSIDE SVG to guarantee sync */}
            <motion.path d={ROAD_PATH} stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" fill="none" strokeDasharray="15 45"
              animate={{ strokeDashoffset: [-120, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />

            {/* 🚗 SIGNAL VEHICLE - NOW INSIDE SVG TO SYNC COORDINATES */}
            <motion.path
                d={ROAD_PATH}
                fill="none"
                stroke="transparent"
                initial={{ pathLength: 0 }}
              />
              <motion.g
                animate={{
                  offsetDistance: ["0%", "100%"]
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{ offsetPath: `path("${ROAD_PATH}")` }}
              >
                <foreignObject width="100" height="100" x="-50" y="-50">
                  <div className="flex items-center justify-center w-full h-full">
                    <div className="relative">
                      <div className="absolute inset-0 bg-cyan-500/30 blur-xl rounded-full scale-150" />
                      <img 
                        src="/pipeline/signal-vehicle.png" 
                        alt="Vehicle" 
                        className="w-16 h-16 object-contain filter drop-shadow(0 0 15px cyan)"
                      />
                    </div>
                  </div>
                </foreignObject>
              </motion.g>
          </svg>

          {/* Station Nodes */}
          {STATIONS.map((station, idx) => (
            <StationNode key={station.id} station={station} index={idx} isActive={activeId === station.id} onClick={() => setActiveId(activeId === station.id ? null : station.id)} />
          ))}
        </div>
      </div>
    </div>
  );
};
