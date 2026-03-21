"use client";

import { useState } from "react";
import { Zap, Send, Terminal, Loader2 } from "lucide-react";
import { api } from "@/services/api";
import { useNotification } from "@/context/NotificationContext";

export function AdminTestLab() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [type, setType] = useState("BUY");
  const [loading, setLoading] = useState(false);
  const { notify } = useNotification();

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const res = await api.post("/admin/diagnostics", { symbol, type });
      if (res.data.success) {
        notify(`🚀 Test signal injected: ${symbol} ${type}`, "success");
      }
    } catch (err) {
      notify("Failed to inject signal", "error");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stat-card border-primary/30 relative overflow-hidden mt-8">
      <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
        <Zap className="w-32 h-32 text-primary" />
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Terminal className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-black italic tracking-tighter uppercase">Virtual Test Lab</h2>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1 w-full">
          <label className="text-[10px] font-black uppercase text-muted-foreground ml-2">Symbol</label>
          <input 
            type="text" 
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="input-field w-full text-sm font-mono"
            placeholder="e.g. BTCUSDT"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => setType('BUY')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-black text-xs transition-all border-2 ${type === 'BUY' ? 'border-primary bg-primary/10 text-primary' : 'border-white/5 bg-white/5 opacity-50'}`}
          >
            BUY
          </button>
          <button 
            onClick={() => setType('SELL')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-black text-xs transition-all border-2 ${type === 'SELL' ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-white/5 bg-white/5 opacity-50'}`}
          >
            SELL
          </button>
        </div>

        <button 
          onClick={handleTrigger}
          disabled={loading}
          className="btn-primary !px-8 h-[46px] flex items-center gap-2 w-full md:w-auto justify-center group"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
          <span className="font-black italic">INJECT SIGNAL</span>
        </button>
      </div>

      <div className="mt-4 p-3 bg-black/40 rounded-lg border border-white/5 italic text-[10px] text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-pulse text-primary" />
        This action directly manipulates the `strategy_signals` table in real-time.
      </div>
    </div>
  );
}
