"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimationFrame, animate } from "framer-motion";
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
    x: 4.2,
    y: 42,
    phaseLabelPos: { x: 50, y: 70 },
    workers: [
      { emoji: "🤖", label: "Scanner", posX: -15, posY: 100 },
    ],
    checkpoints: ["Re-Entry Haritasını Yükle", "Aktif Emirleri Getir", "Top 60 Varlık Taraması", "Pilot Batch İşleme"],
  },
  {
    id: "analyze",
    phaseNum: "PHASE II",
    phase: "ANALYZE",
    title: "ANALİZ",
    codeRef: "MatrixV5.analyze()",
    image: "/pipeline/station-intelligence.png",
    accentColor: "#00f3ff",
    glowColor: "rgba(0,243,255,0.8)",
    x: 22.5,
    y: 42,
    phaseLabelPos: { x: -40, y: 80 },
    workers: [
      { emoji: "🧠", label: "AI Scorer", posX: -15, posY: 100 },
    ],
    checkpoints: ["F4 Güç Analizi", "SMC: Pazar Yapısı", "GIGA MASTER Skoru", "MTF Konsensüs (1m-4s)"],
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
    x: 40.8,
    y: 42,
    phaseLabelPos: { x: -60, y: 70 },
    workers: [
      { emoji: "🚔", label: "TF Isolator", posX: -15, posY: 100 },
    ],
    checkpoints: ["TF Eşleşme Kontrolü", "Mükerrer İşlem Önleme", "Hedge Mod Veto Filtresi", "Trend Dönüş Tespiti"],
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
    x: 59.2,
    y: 42,
    phaseLabelPos: { x: -60, y: 80 },
    workers: [
      { emoji: "💰", label: "Balance Calc", posX: -15, posY: 105 },
    ],
    checkpoints: ["Boş USDT Bakiyesi", "Pilot Tahsis Oranı", "Maliyet Düşürme Tespiti", "Risk/Ödül >= 1.5x Onayı"],
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
    x: 77.5,
    y: 42,
    phaseLabelPos: { x: 90, y: 80 },
    workers: [
      { emoji: "🚀", label: "Market Buy", posX: -15, posY: 100 },
    ],
    checkpoints: ["Yeni Alım Emri", "Kademeli Alım Girişi", "Kapatma Emri (Cover)", "Pozisyon Adaptasyonu"],
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
    x: 95.8,
    y: 42,
    phaseLabelPos: { x: 90, y: 60 },
    workers: [
      { emoji: "📝", label: "Signal Archivery", posX: -15, posY: 100 },
    ],
    checkpoints: ["Veto Nedenini Kaydet", "CombatLog İçgörüsü", "Sinyal Arşivleme", "UI Bildirim Gönderimi"],
  },
];

// ══ CONSTANTS ══
const ROAD_PATH = "M 50,225 Q 600,210 1150,225";

const CyberPodium = ({ station, isActive }: { station: Station; isActive: boolean }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 1, ease: "easeOut" }}
    className="absolute inset-0 flex items-center justify-center pointer-events-none"
    style={{ zIndex: 5 }}
  >
    <div className="relative flex items-center justify-center" style={{ width: "160px", height: "160px" }}>
      {/* 1. LAYER: 3D DEPTH WALLS (Futuristic Neon Side) */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          background: `linear-gradient(135deg, ${station.accentColor}22, #000)`,
          clipPath: "polygon(50% 10%, 98% 30%, 98% 80%, 50% 100%, 2% 80%, 2% 30%)",
          transform: "rotateX(60deg) rotateZ(45deg) translateY(12px)",
          border: `2px solid ${station.accentColor}66`,
          boxShadow: `0 0 25px ${station.accentColor}44`,
        }}
      />

      {/* 2. LAYER: GLASS TOP SURFACE */}
      <div
        className="absolute inset-0 transition-all duration-700 backdrop-blur-sm"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.6), rgba(0,0,0,0.9))",
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          transform: "rotateX(60deg) rotateZ(45deg)",
          border: `2px solid ${station.accentColor}`,
          boxShadow: `inset 0 0 30px ${station.accentColor}33, 0 0 20px ${station.glowColor}`,
        }}
      />
      
      {/* 3. LAYER: CENTER ENERGY CORE (Pulsing) */}
      <motion.div
        animate={{ 
          opacity: isActive ? [0.6, 1, 0.6] : 0.3,
          scale: isActive ? [0.95, 1.1, 0.95] : 1
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute w-[90px] h-[90px]"
        style={{
          background: `radial-gradient(circle, ${station.accentColor} 0%, transparent 80%)`,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          transform: "rotateX(60deg) rotateZ(45deg) translateZ(8px)",
          filter: `blur(6px) drop-shadow(0 0 20px ${station.accentColor})`,
        }}
      />

      {/* 4. LAYER: ORBITAL FLOATING RING */}
      <motion.div
        animate={{ 
          rotateZ: -360,
          y: [-2, 2, -2]
        }}
        transition={{ 
          rotateZ: { duration: 12, repeat: Infinity, ease: "linear" },
          y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }}
        className="absolute w-[180px] h-[180px] border-[1px] border-dashed rounded-full"
        style={{
          borderColor: isActive ? station.accentColor : `${station.accentColor}88`,
          transform: "rotateX(78deg) translateZ(50px)",
          boxShadow: isActive 
            ? `0 0 30px ${station.accentColor}, inset 0 0 30px ${station.accentColor}`
            : `0 0 15px ${station.accentColor}44, inset 0 0 15px ${station.accentColor}44`,
        }}
      />

      {/* 5. ACTIVE GLOW / BEAM (Lights up when capsule arrives) */}
      <motion.div
        initial={false}
        animate={{ 
          opacity: isActive ? 1 : 0,
          scale: isActive ? 1.5 : 0.8
        }}
        className="absolute bottom-[40px] w-[6px] h-[150px]"
        style={{ 
          background: `linear-gradient(to top, transparent, ${station.accentColor}, transparent)`,
          filter: `blur(10px) drop-shadow(0 0 20px ${station.accentColor})`,
        }} 
      />
      {/* Ground Flare */}
      <motion.div
        animate={{ opacity: isActive ? [0.4, 0.8, 0.4] : 0 }}
        transition={{ repeat: Infinity, duration: 1 }}
        className="absolute w-[200px] h-[60px] blur-3xl -bottom-10"
        style={{ background: station.accentColor }}
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
        zIndex: isActive ? 450 : 30 + index, 
      }}
    >
      <CyberPodium station={station} isActive={isActive} />

      {/* Building Image - MUST SIT ON TOP OF PODIUM */}
      <motion.div
        initial={{ y: 0, opacity: 0 }}
        animate={{ y: -85, opacity: 1 }} // Moved UP significantly to sit ON TOP of the 3D stand
        transition={{ delay: 0.1 + index * 0.05, duration: 0.6 }}
        className="relative z-40 w-full h-full flex flex-col items-center justify-center"
      >
        <Image
          src={station.image}
          alt={station.title}
          width={180}
          height={180}
          className="w-[80%] h-auto object-contain transition-all duration-500"
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

      {/* Detail Tooltip - ALWAYS OPEN & UNDER THE STAND */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 top-[125%] w-[220px] bg-slate-950/80 border border-white/5 rounded-xl p-3 shadow-4xl backdrop-blur-md z-[150]"
      >
        <div className="text-[11px] font-black text-white uppercase tracking-widest mb-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: station.accentColor }} />
          {station.phaseNum.replace("PHASE", "AŞAMA")} {station.phase === "GUARD" ? "FİLTRE" : "MANTIK"}
        </div>
        {station.checkpoints.map((cp, i) => (
          <div key={i} className="flex items-start gap-2 mb-1.5 text-slate-400">
            <span className="text-[10px] font-mono opacity-30 mt-0.5">0{i+1}</span>
            <span className="text-[11px] font-bold leading-tight">
              {cp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const PilotPipeline3D = () => {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // ══ SYNC TIMER ══
    // Drives the capsule's 15s path animation and the progress state
    const controls = animate(0, 100, {
      duration: 15,
      repeat: Infinity,
      ease: "linear",
      onUpdate: (latest) => setProgress(latest),
    });
    return controls.stop;
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-transparent min-h-[400px] lg:min-h-[460px]">
      {/* 1. Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[300px] bg-blue-900/5 blur-[150px] opacity-20" />
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[length:40px_40px]" />
      </div>

      <div className="relative z-10 px-4 pt-3 pb-8 max-w-[1240px] mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-4 flex items-center justify-between">
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
          {/* Cyber Highway Road SVG - NOW ON TOP LAYER (z-index: 500) */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 400" preserveAspectRatio="none" style={{ zIndex: 500 }}>
            <defs>
              <linearGradient id="cyberFlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>

            {/* 1. Underlying Glow */}
            <path d={ROAD_PATH} stroke="url(#cyberFlow)" strokeWidth="50" fill="none" opacity="0.1" filter="blur(30px)" />
            
            {/* 2. Main High-Tech Road Foundation */}
            <path d={ROAD_PATH} stroke="#0f172a" strokeWidth="24" fill="none" strokeLinecap="round" opacity="0.9" />
            <path d={ROAD_PATH} stroke="url(#cyberFlow)" strokeWidth="2" fill="none" opacity="0.4" />

            {/* 3. Lateral Data Rails (Dotted) */}
            <path d={ROAD_PATH} stroke="rgba(255,255,255,0.05)" strokeWidth="18" fill="none" strokeDasharray="1 8" />

            {/* 4. Moving Energy Packets */}
            <motion.path d={ROAD_PATH} stroke="url(#cyberFlow)" strokeWidth="1.2" fill="none" strokeDasharray="30 180"
              animate={{ strokeDashoffset: [-1200, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
            
            <motion.path d={ROAD_PATH} stroke="white" strokeWidth="0.5" fill="none" strokeDasharray="2 60"
              animate={{ strokeDashoffset: [-600, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />

            {/* 🚗 SIGNAL CAPSULE - V2 RIGHTWARD ORIENTED */}
            <motion.g
              initial={{ offsetDistance: "0%" }}
              animate={{ offsetDistance: "100%" }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              style={{ offsetPath: `path("${ROAD_PATH}")` }}
            >
              <foreignObject width="100" height="100" x="-50" y="-50">
                <div className="flex items-center justify-center w-full h-full relative">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="relative"
                  >
                    <Image
                      src="/pipeline/signal-capsule-v3.png"
                      alt="Signal"
                      width={80}
                      height={80}
                      className="w-16 h-16"
                      style={{ transform: "none" }}
                    />
                  </motion.div>
                </div>
              </foreignObject>
            </motion.g>
          </svg>

          {/* Stations - Positioned relative to the viewport */}
          <div className="absolute inset-0">
            {STATIONS.map((station, index) => {
              // ══ PRECISION SYNC LOGIC ══
              // Road Start: 50/1200 * 100 = 4.167%
              // Road End: 1150/1200 * 100 = 95.833%
              const roadStart_X = 4.167;
              const roadWidth_X = 91.666;
              const currentCapsuleX = roadStart_X + (progress * roadWidth_X / 100);
              const isActive = Math.abs(station.x - currentCapsuleX) < 5; // Light up only when capsule is overhead

              return (
                <StationNode
                  key={station.id}
                  station={station}
                  index={index}
                  isActive={isActive}
                  onClick={() => setActiveId(activeId === station.id ? null : station.id)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
