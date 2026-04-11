"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WhaleAlert {
  id: string;
  symbol: string;
  volume: number;
  volumeLabel: string;
  side: "BUY" | "SELL";
  time: string;
}

const getWhaleIcon = (volume: number) => {
  if (volume >= 500000) return { icon: "🐋", tier: "MEGA", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/30" };
  if (volume >= 200000) return { icon: "🦈", tier: "SHARK", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/30" };
  if (volume >= 100000) return { icon: "🐬", tier: "DOLPHIN", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" };
  return { icon: "🐟", tier: "FISH", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/30" };
};

export const WhaleFeed = React.memo(() => {
  const [alerts, setAlerts] = useState<WhaleAlert[]>([]);

  useEffect(() => {
    let ws: WebSocket;
    let isActive = true;

    const connectWs = () => {
      ws = new WebSocket("wss://wbs.mexc.com/ws");
      
      ws.onopen = () => {
        // Dinleyeceğimiz ana pariteler (Balinaların aktif olduğu)
        ws.send(JSON.stringify({
          method: "SUBSCRIPTION",
          params: [
            "spot@public.deals.v3.api@BTCUSDT",
            "spot@public.deals.v3.api@ETHUSDT",
            "spot@public.deals.v3.api@TAOUSDT",
            "spot@public.deals.v3.api@INJUSDT"
          ]
        }));
      };

      ws.onmessage = (event) => {
        if (!isActive) return;
        try {
          const msg = JSON.parse(event.data);
          // Deals event = d.deals array
          if (msg.d && msg.d.deals && msg.d.deals.length > 0) {
             const sym = msg.s || msg.c || "BTCUSDT"; // Sembol yakalama
             
             for (const deal of msg.d.deals) {
               const price = parseFloat(deal.p);
               const qty = parseFloat(deal.v);
               const vol = price * qty;
               
               // $50k ve üzeri işlemleri balina kabul et
               if (vol >= 50000) {
                 const side: "BUY" | "SELL" = deal.S === 1 ? "BUY" : "SELL";
                 
                 setAlerts((prev) => {
                   const newAlert: WhaleAlert = {
                     id: Date.now().toString() + Math.random(),
                     symbol: sym,
                     volume: vol,
                     volumeLabel: vol >= 1000000 ? `$${(vol / 1000000).toFixed(1)}M` : `$${(vol / 1000).toFixed(0)}K`,
                     side,
                     time: new Date().toLocaleTimeString("tr-TR", { hour12: false })
                   };
                   return [newAlert, ...prev].slice(0, 10);
                 });
               }
             }
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        if (isActive) setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      isActive = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return (
    <div className="w-full card-glow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/40 flex justify-between items-center">
        <h3 className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          Whale Alert Feed
        </h3>
        <span className="text-[8px] text-slate-600 font-mono tracking-wider">LIVE · MAX 10</span>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar p-1.5 gap-1 max-h-[200px]">
        <AnimatePresence initial={false}>
          {alerts.map((alert) => {
            const whale = getWhaleIcon(alert.volume);
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, height: 0, x: -20 }}
                animate={{ opacity: 1, height: "auto", x: 0 }}
                exit={{ opacity: 0, height: 0, x: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${whale.bg}`}
              >
                {/* Whale Icon */}
                <span className="text-lg">{whale.icon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-200">{alert.symbol.replace("USDT","")}</span>
                    <span className={`text-[7px] font-black px-1 py-0.5 rounded ${
                      alert.side === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    }`}>
                      {alert.side}
                    </span>
                    <span className={`text-[7px] font-mono ${whale.color}`}>{whale.tier}</span>
                  </div>
                  <span className="text-[10px] font-black font-mono text-slate-300">{alert.volumeLabel}</span>
                </div>

                {/* Time */}
                <span className="text-[8px] font-mono text-slate-600 shrink-0">{alert.time}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {alerts.length === 0 && (
          <div className="py-8 flex flex-col items-center gap-2">
            <span className="text-2xl opacity-30">🐋</span>
            <span className="text-[9px] text-slate-600 font-mono italic">Balinalar izleniyor...</span>
          </div>
        )}
      </div>
    </div>
  );
});

WhaleFeed.displayName = "WhaleFeed";
