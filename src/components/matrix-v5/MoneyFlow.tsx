import React, { useState } from "react";
import { MoveRight, ChevronUp, ChevronDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalMarketData } from "@/lib/market-data";
import { LiquidityPulseLens } from "@/components/matrix-horizon/MatrixHorizon";

export function MoneyFlowHeader({ show, toggle }: { show: boolean, toggle: () => void }) {
  return (
    <div id="money-flow-header" className="w-full px-2">
      <div 
        className={cn(
          "relative z-20 flex items-center justify-between py-2 border-b border-slate-800/40 bg-slate-950/20 hover:bg-slate-900/40 transition-all backdrop-blur-sm font-mono cursor-pointer select-none",
          show ? "mb-0" : "mb-2"
        )}
        onClick={toggle}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-transparent shrink-0">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase">
              MONEY FLOW
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pr-1">
          <div className="flex items-center p-0.5 bg-slate-950/40 border border-slate-800/50 rounded-lg">
            <button
               className={cn(
                 "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
                 show ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white"
               )}
            >
              {show ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span className="tracking-widest">{show ? "GİZLE" : "GÖSTER"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MoneyFlowSection({ globalMarketData }: { globalMarketData: GlobalMarketData | null }) {
    const [show, setShow] = useState(false);
    if (!globalMarketData) return null;

    return (
        <div className="mb-2">
            <MoneyFlowHeader show={show} toggle={() => setShow(!show)} />
            {show && (
                <div className="px-2 mt-1">
                    <div className="p-4 bg-slate-900/40 border border-slate-800/50 rounded-xl">
                         <LiquidityPulseLens 
                            btcDom={globalMarketData.btcd} 
                            ethDom={globalMarketData.ethd} 
                            othersDom={globalMarketData.othersd} 
                            paxg={globalMarketData.paxg} 
                            marketFlow={{ label: globalMarketData.flow, color: globalMarketData.flowColor }} 
                            isExpanded={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
