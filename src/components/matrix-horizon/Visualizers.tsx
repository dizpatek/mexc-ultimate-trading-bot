import React from 'react';
import { motion } from 'framer-motion';
import { Waves, Zap, Clock, TrendingDown, Activity, ArrowUpRight } from 'lucide-react';

interface VisProps {
  value: number;
  min: number;
  max: number;
  label?: string;
  desc?: string;
  colorText?: string;
  colorBg?: string;
  colorBorder?: string;
  inverse?: boolean;
}

// 1. Balina (Hacim) Çarpanı
export function WhaleMultiplierVisualizer({ value, min, max }: VisProps) {
  return (
    <div className="mt-2 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 shadow-inner group transition-all duration-300 hover:border-cyan-500/30">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] font-black text-cyan-400 uppercase flex items-center gap-1.5 tracking-widest drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
          <Waves className="w-3 h-3" />
          Hacim Genleşmesi
        </span>
        <span className="text-[8px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{value}x Etki</span>
      </div>
      <div className="relative h-12 w-full flex items-end justify-between gap-[2px] overflow-hidden px-1 border-b border-slate-800/80 pb-[1px]">
        {/* Draw volume histogram */}
        {[15, 20, 10, 15, 25, 12, 10, 50, 18, 15].map((baseHeight, i) => {
          const isWhale = i === 7; 
          const h = isWhale ? Math.min(100, baseHeight * (1 + (value / 5))) : baseHeight;
          const isRed = i % 3 === 0 && !isWhale;
          const bg = isWhale 
            ? 'bg-gradient-to-t from-cyan-600 to-cyan-300 shadow-[0_0_10px_#22d3ee]' 
            : (isRed ? 'bg-slate-700/60' : 'bg-slate-600/60');
            
          return (
            <motion.div
              key={i}
              className={`flex-1 rounded-t-sm w-full transition-all duration-300 ${bg}`}
              style={{ minHeight: '4px' }}
              animate={{ height: [`${h}%`, `${h * 0.85}%`, `${h}%`] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
            />
          );
        })}
      </div>
      <div className="text-[8.5px] leading-relaxed text-slate-400 mt-3 text-justify">
        <span className="text-cyan-300 font-bold">Piyasaya giren devasa hacimleri katsayılar.</span> Normal bir mumun hacmi düşükken aniden giren bir balina hacmi Otopilot tarafından siradan bir mum gibi okunmaz. Değer arttıkça <strong>{value}x</strong> daha güçlü dikkate alınır.
      </div>
    </div>
  );
}

// 2. F4 Çarpanı (Sinyal Frekansı)
export function SignalMultiplierVisualizer({ value, min, max }: VisProps) {
  const frequency = ((max - value + 1) / max) * 1.5; // Lower values = slower animation. Higher multiplier = higher frequency.
  return (
    <div className="mt-2 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 shadow-inner group transition-all duration-300 hover:border-emerald-500/30">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] font-black text-emerald-400 uppercase flex items-center gap-1.5 tracking-widest drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]">
          <Zap className="w-3 h-3" />
          Sinyal Titreşimi
        </span>
        <span className="text-[8px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{value}x Frekans</span>
      </div>
      <div className="relative h-10 w-full bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
        {/* Heartbeat / Audio Wave visualization */}
        <div className="flex items-center justify-center gap-[2px] w-full h-full px-2 opacity-80">
           {Array.from({length: 15}).map((_, i) => (
             <motion.div 
               key={i}
               className="w-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]"
               animate={{ 
                 height: ['10%', `${Math.random() * 80 + 20}%`, '10%'] 
               }}
               transition={{ 
                 duration: Math.max(0.2, frequency), 
                 repeat: Infinity, 
                 delay: i * 0.05,
                 ease: "easeInOut"
               }}
             />
           ))}
        </div>
      </div>
      <div className="text-[8.5px] leading-relaxed text-slate-400 mt-3 text-justify">
        <span className="text-emerald-300 font-bold">F4 Motorunun refleks hızını ayarlar.</span> Algoritma ufak fiyat değişimlerine karşı bile <strong>{value} kat</strong> daha agresif sinyaller üretir. Düşük tutulunca (Örn: 1.0x) dalgalanmaları yoksayıp trende sadık kalır.
      </div>
    </div>
  );
}

// 3. Uzunluk / Bar Taraması (Looking Back)
export function LengthVisualizer({ value, min, max, label, desc, colorText, colorBg }: VisProps) {
  const barCount = 30; 
  const activeCount = Math.min(barCount, Math.ceil((value / max) * barCount));
  const cText = colorText || "text-blue-400";
  const dropShadow = cText === "text-blue-400" ? "drop-shadow-[0_0_5px_rgba(96,165,250,0.5)]" : "drop-shadow-[0_0_5px_rgba(167,139,250,0.5)]";
  const gradient = colorBg || "from-blue-500 to-blue-400";
  
  return (
    <div className="mt-2 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 shadow-inner group transition-all duration-300 hover:border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <span className={`text-[8px] font-black ${cText} uppercase flex items-center gap-1.5 tracking-widest ${dropShadow}`}>
          <Clock className="w-3 h-3" />
          {label}
        </span>
        <span className="text-[8px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{value} BAR ALANI</span>
      </div>
      <div className="relative h-10 w-full flex items-end border-b border-slate-700/80 pb-0.5 gap-[1px]">
         {/* Draw Candlesticks */}
         {Array.from({ length: barCount }).map((_, i) => {
            const isActive = i >= barCount - activeCount;
            const h = 20 + Math.sin(i * 0.5) * 15 + (i % 3) * 5; 
            return (
              <div 
                 key={i} 
                 className={`flex-1 rounded-t-sm transition-all duration-500 ${isActive ? 'bg-current opacity-90 scale-y-110' : 'bg-slate-700/50 opacity-30 grayscale'}`}
                 style={{ height: `${h}%`, color: isActive ? (cText.includes('indigo') ? '#818CF8' : '#60A5FA') : '' }}
              >
                  {isActive && <div className="w-[1px] h-[5px] bg-white/50 mx-auto -mt-1" />}
              </div>
            );
         })}
         
         {/* Overlay Selection Area */}
         <div 
            className="absolute right-0 bottom-0 top-2 border-l-2 border-t-2 border-r-2 rounded-t-lg bg-gradient-to-t pointer-events-none transition-all duration-500"
            style={{ 
              width: `${(activeCount / barCount) * 100}%`,
              borderColor: cText.includes('indigo') ? 'rgba(129, 140, 248, 0.4)' : 'rgba(96, 165, 250, 0.4)',
              backgroundImage: cText.includes('indigo') ? 'linear-gradient(to top, rgba(129, 140, 248, 0.1), transparent)' : 'linear-gradient(to top, rgba(96, 165, 250, 0.1), transparent)'
            }}
         >
            <div className={`absolute -top-4 w-full text-center text-[7px] font-black ${cText} tracking-widest`}>TARANAN BÖLGE</div>
         </div>
      </div>
      <div className="text-[8.5px] leading-relaxed text-slate-400 mt-4 text-justify">
        {desc || <><span className={`font-bold ${cText}`}>Geriye dönük hafıza penceresi.</span> Soldaki sönük mumlar yoksayılır. Algoritma kararlarını sadece son sağdaki <strong>{value} mumluk (Bar)</strong> alanda gelişen fiyat hareketleri ve momentum dipleri/tepeleri üzerine kurar.</>}
      </div>
    </div>
  );
}

// 4. Güç Kaybı Zirve Düşüşü (Drawdown / Power Loss)
export function PowerLossVisualizer({ value, min, max, label, desc, colorText }: VisProps) {
  const dropPercent = 100 - value; 
  
  return (
    <div className="mt-2 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 shadow-inner group transition-all duration-300 hover:border-amber-500/30">
      <div className="flex justify-between items-center mb-2">
        <span className={`text-[8px] font-black ${colorText} uppercase flex items-center gap-1.5 tracking-widest drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]`}>
          <TrendingDown className="w-3 h-3" />
          {label}
        </span>
        <span className="text-[8px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">-%{dropPercent.toFixed(0)} DÜŞÜŞ TOLERANSI</span>
      </div>
      <div className="relative h-14 w-full bg-slate-900 rounded-lg border border-slate-800 flex items-end overflow-hidden px-1">
         
         <div className="absolute inset-0 pt-2 opacity-50">
            {/* Background grid */}
            {Array.from({length: 4}).map((_, i) => (
              <div key={i} className="border-b border-slate-800/50 h-1/4 w-full" />
            ))}
         </div>

         {/* Line Chart rising to peak then dropping */}
         <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full overflow-visible">
           <path d="M0,40 L15,30 L25,35 L40,15 L50,5 L80,5" fill="none" stroke="#f59e0b" strokeWidth="1.5" className="opacity-40" strokeDasharray="2 2" />
           {/* Solid line up to peak */}
           <path d="M0,40 L15,30 L25,35 L40,15 L50,5" fill="none" stroke="#fbbf24" strokeWidth="2.5" />
           <path d="M0,40 L15,30 L25,35 L40,15 L50,5 L50,40 Z" fill="url(#amberGrad)" stroke="none" />
           <defs>
             <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
               <stop offset="0%" stopColor="rgba(251,191,36,0.3)" />
               <stop offset="100%" stopColor="rgba(251,191,36,0)" />
             </linearGradient>
           </defs>
         </svg>

         {/* The simulated drop tracking */}
         <motion.div 
            className="absolute border-l-2 border-b-2 border-rose-500 bg-rose-500/10 flex items-center justify-center"
            style={{ top: '12.5%', left: '50%', width: '30%', transformOrigin: 'top left' }}
            animate={{ height: ['0%', `${dropPercent * 0.8}%`, '0%'] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
         >
           <div className="absolute -right-10 top-1/2 -translate-y-1/2 flex items-center text-rose-400 font-bold bg-rose-500/20 px-1 py-[1px] rounded text-[6px]">
             -%{dropPercent.toFixed(0)} VETO
           </div>
         </motion.div>
         
         <div className="absolute left-[50%] top-0 h-full w-[1px] bg-slate-700 border-l border-dashed border-slate-600" />
         <div className="absolute left-[50%] top-[12.5%] -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fcd34d]" />
      </div>
      <div className="text-[8.5px] leading-relaxed text-slate-400 mt-3 text-justify">
        <span className="text-amber-300 font-bold">Trendin gücünü kaybedip VETO (Red) olacağı sınır.</span> İndikatör momentumu zirve yaptığı en üst noktadan %{(100-value).toFixed(0)} kayıp yaşarsa Otopilot bunu risk/kırılım addeder ve ters işleme zorlanır.
      </div>
    </div>
  );
}

// 5. Eğim (Slope) Görselleştirici
export function SlopeVisualizer({ value, min, max }: VisProps) {
  // Angle calculated intuitively for visual max
  const visualAngle = Math.min(65, Math.max(5, (value / max) * 75)); 
  
  return (
    <div className="mt-2 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 shadow-inner group transition-all duration-300 hover:border-violet-500/30">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[8px] font-black text-violet-400 uppercase flex items-center gap-1.5 tracking-widest drop-shadow-[0_0_5px_rgba(167,139,250,0.5)]">
          <ArrowUpRight className="w-3 h-3" />
          MİNİMUM KALKIŞ İVMESİ
        </span>
        <span className="text-[8px] font-bold text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{value} DELTA AÇISI</span>
      </div>
      <div className="relative h-14 w-full bg-slate-900 rounded-lg flex flex-col items-center justify-center overflow-hidden border border-slate-800">
         
         {/* Cartesian Grid */}
         <div className="absolute w-full h-full opacity-20" style={{ backgroundImage: 'linear-gradient(#475569 1px, transparent 1px), linear-gradient(90deg, #475569 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
         
         {/* Baseline reference */}
         <div className="absolute w-full h-[1px] bg-slate-600 top-1/2 -translate-y-1/2" />
         <div className="absolute w-[1px] h-full bg-slate-600 left-1/4 -translate-x-1/2" />

         <div className="absolute left-1/4 top-1/2 border-t border-r border-violet-500/50 rounded-tr-full bg-violet-500/10" 
              style={{ width: '40px', height: '40px', transform: 'translate(0, -100%)' }} />

         {/* Animated angled rocket/slope line */}
         <motion.div
           className="w-[60%] h-[3px] bg-violet-500 rounded-full shadow-[0_0_10px_#8b5cf6]"
           style={{ position: 'absolute', left: '25%', top: '50%', transformOrigin: "left center" }}
           animate={{ rotate: [0, -visualAngle, 0] }}
           transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
         >
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_15px_#ffffff]" />
         </motion.div>

         <span className="absolute left-[35%] top-[20%] text-[8px] font-black text-violet-300 shadow-slate-900 drop-shadow-md">
            MIN: {value}° İVME
         </span>
      </div>
      <div className="text-[8.5px] leading-relaxed text-slate-400 mt-3 text-justify">
        <span className="text-violet-300 font-bold">Yatay Piyasayı (Chop) Filtreler.</span> Fiyat hafif dalgalanarak gidiyorsa işlemi yoksayar. Ancak osilatör eğimi radikal bir şekilde (dik olarak) {value} eşiğini aşarsa güçlü momentum tescillenir.
      </div>
    </div>
  );
}

// 6. Mevcut Threshold Visualizer (Aksiyon/Veto Bar)
export function ZoneVisualizer({ value, min, max, label, desc, colorText, colorBg, colorBorder, inverse }: VisProps) {
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  return (
    <div className="mt-2 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 shadow-inner group transition-all duration-300 group hover:border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <span className={`text-[8px] font-black ${colorText} uppercase flex items-center gap-1.5 tracking-widest drop-shadow-md`}>
          <Activity className="w-3 h-3" />
          {label}
        </span>
        <span className={`text-[8px] font-bold ${colorText} bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded shadow-sm`}>
          EŞİK: {value}
        </span>
      </div>

      <div className="relative h-6 w-full rounded-lg border border-slate-700/50 bg-slate-900 overflow-hidden flex shadow-inner group-hover:border-slate-600 transition-colors">
         {/* LEFT ZONE */}
         <div 
           className={`h-full flex flex-col justify-center items-center transition-all duration-300 relative overflow-hidden ${inverse ? colorBg : 'bg-slate-800/80 grayscale'}`} 
           style={{ width: `${percent}%` }}
         >
            {percent > 20 && (
              <span className={`text-[6px] font-black uppercase tracking-widest ${inverse ? colorText : 'text-slate-500'} z-10 drop-shadow-md`}>
                {inverse ? "ONAY (AKTİF)" : "VETO (İPTAL)"}
              </span>
            )}
            {/* Pattern */}
            <div className={`absolute inset-0 opacity-10 ${inverse ? 'bg-[radial-gradient(circle,#ffffff_1px,transparent_1px)] bg-[size:4px_4px]' : 'bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[size:8px_8px]'}`} />
         </div>

         {/* RIGHT ZONE */}
         <div 
           className={`h-full flex flex-col justify-center items-center transition-all duration-300 relative overflow-hidden ${inverse ? 'bg-slate-800/80 grayscale' : colorBg}`} 
           style={{ width: `${100 - percent}%` }}
         >
            {(100 - percent) > 20 && (
              <span className={`text-[6px] font-black uppercase tracking-widest ${!inverse ? colorText : 'text-slate-500'} z-10 drop-shadow-md`}>
                {!inverse ? "ONAY (AKTİF)" : "VETO (İPTAL)"}
              </span>
            )}
            {/* Pattern */}
            <div className={`absolute inset-0 opacity-10 ${!inverse ? 'bg-[radial-gradient(circle,#ffffff_1px,transparent_1px)] bg-[size:4px_4px]' : 'bg-[linear-gradient(45deg,#000_25%,transparent_25%,transparent_50%,#000_50%,#000_75%,transparent_75%,transparent)] bg-[size:8px_8px]'}`} />
         </div>
         
         {/* Threshold Limit Marker */}
         <motion.div
           className={`absolute top-0 bottom-0 w-1.5 rounded-full z-20 bg-white ${colorBorder} shadow-[0_0_15px_#ffffff]`}
           style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}
           animate={{ scaleY: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
           transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
         >
           <div className={`absolute top-full text-[6px] font-bold ${colorText} -translate-x-1/2 pt-1 font-mono hidden group-hover:block`}>{value}</div>
         </motion.div>

         {/* Scanning laser beam effect */}
         <motion.div
           className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-10 mix-blend-overlay"
           animate={{ left: ["-10%", "110%"] }}
           transition={{ duration: 2.5, ease: "linear", repeat: Infinity }}
         />
      </div>

      <div className="text-[8.5px] leading-relaxed text-slate-400 mt-4 text-justify min-h-[30px]">
        {desc} Sınırın (Veto) karanlık tarafındaki tüm hesaplamalar riskli kabul edilip işlem engellenir.
      </div>
    </div>
  );
}
