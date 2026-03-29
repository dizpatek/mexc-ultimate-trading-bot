import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Waves, Zap, Clock, TrendingDown, Activity, ArrowUpRight } from 'lucide-react';

interface VisProps {
  value: number;
  min: number;
  max: number;
}

// 1. Balina (Hacim) Çarpanı
export function WhaleMultiplierVisualizer({ value, min, max }: VisProps) {
  return (
    <div className="mt-2 bg-slate-950/60 rounded p-2 border border-cyan-500/20 overflow-hidden group">
      <div className="flex justify-between items-center mb-1.5 opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        <span className="text-[6.5px] font-black text-cyan-500 uppercase flex items-center gap-1 tracking-widest">
          <Waves className="w-2 h-2" />
          Hacim Genleşmesi
        </span>
        <span className="text-[6px] font-bold text-slate-500">{value}x Etki</span>
      </div>
      <div className="relative h-6 w-full flex items-end justify-center gap-1 overflow-hidden">
        {/* Draw 5 volume bars representing normal vs whale */}
        {[15, 25, 20, 45, 30].map((baseHeight, i) => {
          const isWhale = i === 3; // The 4th bar is the "whale"
          const h = isWhale ? baseHeight * (1 + (value / 5)) : baseHeight;
          return (
            <motion.div
              key={i}
              className={`w-5 rounded-t-sm ${isWhale ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-slate-700/50'}`}
              animate={{ height: [`${h}%`, `${h * 0.8}%`, `${h}%`] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
            />
          );
        })}
      </div>
      <div className="text-[6px] text-slate-500 mt-2 text-justify leading-tight opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        Aşırı yüksek hacimli mumların (Balina) trend puanına etkisini <strong>{value} kat</strong> daha fazla dikkate alır. Çubuk (Hacim) ne kadar büyükse etki o kadar şiddetlidir.
      </div>
    </div>
  );
}

// 2. F4 Çarpanı (Sinyal Gücü Amplifikatörü)
export function SignalMultiplierVisualizer({ value, min, max }: VisProps) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="mt-2 bg-slate-950/60 rounded p-2 border border-emerald-500/20 overflow-hidden group">
      <div className="flex justify-between items-center mb-1.5 opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        <span className="text-[6.5px] font-black text-emerald-400 uppercase flex items-center gap-1 tracking-widest">
          <Zap className="w-2 h-2" />
          Sinyal Hassasiyeti
        </span>
        <span className="text-[6px] font-bold text-slate-500">{value}x Titreşim</span>
      </div>
      <div className="relative h-4 w-full bg-slate-800 rounded-full overflow-hidden flex items-center justify-center">
        <motion.div
           className="h-full bg-emerald-500/30 w-full"
           animate={{ scaleX: [0, 1, 0], opacity: [0.2, 0.8, 0.2] }}
           transition={{ duration: (max * 1.5) / Math.max(0.1, value), ease: "easeInOut", repeat: Infinity }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
           <span className="text-[7px] font-black text-emerald-400 opacity-80">FREKANS: {value}x</span>
        </div>
      </div>
      <div className="text-[6px] text-slate-500 mt-2 text-justify leading-tight opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        F4 sinyal puanı ana karara katılırken <strong>{value} kat</strong> ile çarpılır. Değer arttıkça (yüksek frekans) algoritmik bot çok daha agresif ve reaktif tepkiler verir.
      </div>
    </div>
  );
}

// 3. Uzunluk / Bar Taraması (Time Window)
export function LengthVisualizer({ value, min, max, label, desc, colorText, colorBg }: any) {
  // We represent "bars" as a timeline window
  const barCount = 20; 
  const activeCount = Math.ceil((value / max) * barCount);
  const cText = colorText || "text-blue-400";
  const cBg = colorBg || "bg-blue-400";
  
  return (
    <div className="mt-2 bg-slate-950/60 rounded p-2 border border-white/5 overflow-hidden group">
      <div className="flex justify-between items-center mb-1.5 opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        <span className={`text-[6.5px] font-black ${cText} uppercase flex items-center gap-1 tracking-widest`}>
          <Clock className="w-2 h-2" />
          {label}
        </span>
        <span className="text-[6px] font-bold text-slate-500">Son {value} Bar</span>
      </div>
      <div className="flex gap-[1px] h-4 w-full justify-end items-end border-b border-slate-700 pb-[1px]">
         {Array.from({ length: barCount }).map((_, i) => {
            const isActive = i >= barCount - activeCount;
            const h = 30 + (i % 5) * 10 + (Math.sin(i) * 15); // Pseudo-random chart shape
            return (
              <div 
                 key={i} 
                 className={`flex-1 rounded-t-sm transition-colors ${isActive ? cBg : 'bg-slate-800'}`}
                 style={{ height: `${h}%`, opacity: isActive ? 1 : 0.3 }}
              />
            );
         })}
      </div>
      <div className="text-[6px] text-slate-500 mt-2 text-justify leading-tight opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        {desc} Grafiğin sağından sola doğru taranan karanlık olmayan pencereler <strong>son {value} mumluk</strong> aktif okuma zaman dilimini (Looking Back) temsil eder.
      </div>
    </div>
  );
}

// 4. Güç Kaybı Zirve Düşüşü (Drawdown)
export function PowerLossVisualizer({ value, min, max, label, desc, colorText }: any) {
  const dropPercent = 100 - value; // if value is 85%, drop is 15% from top
  const cText = colorText || "text-amber-400";
  const cBorder = "border-[currentColor]";
  
  return (
    <div className="mt-2 bg-slate-950/60 rounded p-2 border border-amber-500/20 overflow-hidden group">
      <div className="flex justify-between items-center mb-2 opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        <span className={`text-[6.5px] font-black ${cText} uppercase flex items-center gap-1 tracking-widest`}>
          <TrendingDown className="w-2 h-2" />
          {label}
        </span>
        <span className="text-[6px] font-bold text-slate-500">-%{dropPercent.toFixed(0)} Tolerans</span>
      </div>
      <div className="relative h-8 w-full bg-slate-900 rounded border border-slate-800 flex items-end overflow-hidden pb-[1px] px-2">
         {/* Line Chart */}
         <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full opacity-60">
           <path d="M0,40 L20,30 L40,10 L50,0 L65,15 L80,5 L100,40" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
           <path d="M0,40 L20,30 L40,10 L50,0 L65,15 L80,5 L100,40 L100,40 L0,40 Z" fill="rgba(245, 158, 11, 0.1)" stroke="none" />
         </svg>
         
         {/* The Drop Tolerance Box at Peak (X:50) */}
         <motion.div 
            className="absolute border border-rose-500/50 bg-rose-500/10 flex items-center justify-center p-0.5"
            style={{ top: '0%', left: '40%', width: '15px' }}
            animate={{ height: ['0%', `${dropPercent}%`, '0%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
         >
           <span className="text-[4px] text-rose-400 rotate-90 scale-75 whitespace-nowrap">-{dropPercent}%</span>
         </motion.div>
      </div>
      <div className="text-[6px] text-slate-500 mt-2 text-justify leading-tight opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        {desc} İndikatör momentumu en son ulaştığı zirveden itibaren tam <strong>%{(100-value).toFixed(0)}</strong> düştüğünde sistem kar satışına veya ters işleme zorlanır.
      </div>
    </div>
  );
}

// 5. Eğim (Slope) Görselleştirici
export function SlopeVisualizer({ value, min, max }: VisProps) {
  // value is 0.001 to 0.1
  const maxDegrees = 60; // Increased max degrees for more visible swoop
  // We amplify small values so it's always clearly animating
  const angle = Math.max(15, (value / max) * maxDegrees); 
  
  return (
    <div className="mt-2 bg-slate-950/60 rounded p-2 border border-violet-500/20 overflow-hidden group">
      <div className="flex justify-between items-center mb-1.5 opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        <span className="text-[6.5px] font-black text-violet-400 uppercase flex items-center gap-1 tracking-widest">
          <ArrowUpRight className="w-2 h-2" />
          Ralli İvme (Eğim) Açısı
        </span>
        <span className="text-[6px] font-bold text-slate-500">{value} Delta</span>
      </div>
      <div className="relative h-8 w-full bg-slate-900 rounded flex flex-col items-center justify-center overflow-hidden">
         {/* Baseline reference */}
         <div className="absolute w-3/4 h-[1px] bg-slate-700 border-dashed border-b" />
         
         {/* Animated angled line swinging up and down */}
         <motion.div
           className="w-1/2 h-[1.5px] bg-violet-500 rounded-full shadow-[0_0_5px_#8b5cf6]"
           style={{ transformOrigin: "left center" }}
           animate={{ rotate: [0, -angle, 0, angle, 0] }}
           transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
         />
      </div>
      <div className="text-[6px] text-slate-500 mt-2 text-justify leading-tight opacity-80 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
        Piyasa yatay seyirde izlerken işleme onayı vermez. Osilatör çizgisinin bir sonraki bara geçerken eğimi (ivmesi / delta açısı) en az <strong>{value} derece</strong> olduğunda hareket tescillenir.
      </div>
    </div>
  );
}

// 6. Mevcut Threshold Visualizer (Aksiyon/Veto Bar)
// 6. Threshold Visualizer V3.0 (Flexible Action/Veto Bar)
export function ZoneVisualizer({ value, min, max, label, desc, colorText, colorBg, colorBorder, inverse }: any) {
  // Logic: 
  // inverse=false (Default): Left (0..value) = VETO, Right (value..100) = ONAY
  // inverse=true (Squeeze etc): Left (0..value) = ONAY, Right (value..100) = VETO
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  return (
    <div className="mt-2 bg-slate-950/40 rounded-lg p-2.5 border border-white/5 overflow-hidden group hover:border-white/10 transition-all duration-300">
      <div className="flex justify-between items-center mb-2 opacity-90 group-hover:opacity-100 transition-opacity">
        <span className={`text-[7px] font-black ${colorText} uppercase flex items-center gap-1.5 tracking-[0.15em]`}>
          <Activity className="w-3 h-3 animate-pulse" />
          {label}
        </span>
        <div className="flex items-center gap-1.5 bg-slate-900/80 px-1.5 py-0.5 rounded border border-white/5">
           <span className="text-[6px] font-bold text-slate-500 uppercase">SINIR:</span>
           <span className={`text-[7px] font-black font-mono ${colorText}`}>
              {value}
           </span>
        </div>
      </div>

      <div className="relative h-4 w-full bg-slate-900/80 rounded border border-white/5 overflow-hidden flex shadow-inner group/bar">
         {/* LEFT ZONE */}
         <div 
           className={`h-full ${inverse ? colorBg : 'bg-slate-800/40'} flex items-center justify-center transition-all duration-500 relative overflow-hidden ${inverse ? 'border-r border-white/20' : ''}`} 
           style={{ width: `${percent}%` }}
         >
            {percent > 25 && (
              <span className={`text-[6px] font-black uppercase tracking-widest z-10 transition-opacity ${inverse ? colorText : 'text-slate-500 opacity-40 group-hover/bar:opacity-60'}`}>
                {inverse ? "ONAY BÖLGESİ" : "İPTAL (VETO)"}
              </span>
            )}
            {inverse && (
              <div className={`absolute inset-0 opacity-10 pointer-events-none ${colorBg}`} style={{ filter: 'blur(10px)' }} />
            )}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #475569 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
         </div>

         {/* RIGHT ZONE */}
         <div 
           className={`h-full ${inverse ? 'bg-slate-800/40' : colorBg} flex items-center justify-center transition-all duration-500 relative ${!inverse ? 'border-l border-white/20' : ''}`} 
           style={{ width: `${100 - percent}%` }}
         >
            {(100 - percent) > 25 && (
              <span className={`text-[6px] font-black uppercase tracking-widest z-10 drop-shadow-sm ${inverse ? 'text-slate-500 opacity-40 group-hover/bar:opacity-60' : colorText}`}>
                {inverse ? "İPTAL (VETO)" : "ONAY BÖLGESİ"}
              </span>
            )}
            {!inverse && (
              <div className={`absolute inset-0 opacity-20 pointer-events-none ${colorBg}`} style={{ filter: 'blur(10px)' }} />
            )}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 50%, currentColor 50%, currentColor 75%, transparent 75%, transparent)', backgroundSize: '8px 8px', color: 'white' }} />
         </div>
         
         {/* THRESHOLD MARKER (Scanner) */}
         <motion.div
           className={`absolute top-0 bottom-0 w-1.5 rounded-full z-20 ${colorText} shadow-[0_0_15px_currentColor]`}
           style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}
           animate={{ opacity: [1, 0.5, 1], scaleY: [1, 1.1, 1] }}
           transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
         />

         {/* ACTIVE SCANNER BEAM */}
         <motion.div
           className="absolute top-0 bottom-0 w-[40%] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none z-10"
           animate={{ left: ["-50%", "150%"] }}
           transition={{ duration: 4, ease: "linear", repeat: Infinity }}
         />
      </div>

      <div className="text-[6.5px] text-slate-500 mt-2 text-justify leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">
        {desc}
      </div>
    </div>
  );
}
