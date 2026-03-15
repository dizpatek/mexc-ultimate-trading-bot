import React from "react";
import { 
  Radar, 
  ChevronUp, 
  ChevronDown, 
  RefreshCw, 
  Zap,
  Archive
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TradeCommandBarProps {
  activeTradesCount: number;
  activeTab: "AKTIF" | "PASIF";
  setActiveTab: (tab: "AKTIF" | "PASIF") => void;
  onNewTrade?: () => void;
  handleClearAll: (type: "active" | "passive" | "archive") => void;
  clearingAction: "active" | "passive" | "archive" | null;
  isSectionExpanded: boolean;
  setIsSectionExpanded: (expanded: boolean) => void;
}

export const TradeCommandBar: React.FC<TradeCommandBarProps> = ({
  activeTradesCount,
  activeTab,
  setActiveTab,
  onNewTrade,
  handleClearAll,
  clearingAction,
  isSectionExpanded,
  setIsSectionExpanded,
}) => {
  return (
    <div 
      className="relative z-20 flex flex-wrap items-center justify-center sm:justify-between py-2 px-2 gap-3 border-b border-slate-800/40 bg-slate-950/20 hover:bg-slate-900/40 transition-colors backdrop-blur-sm rounded-t-xl mb-2 font-mono cursor-pointer"
      onClick={() => setIsSectionExpanded(!isSectionExpanded)}
    >
      {/* GROUP 1: SECTION TITLE */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl shadow-lg">
          <Radar className="w-4 h-4 text-cyan-400" />
          <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase hidden lg:block">
            Akıllı İşlemler
          </h2>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AKTİF:</span>
          <span className="text-[10px] font-black text-cyan-400">
            {activeTradesCount}
          </span>
        </div>
      </div>

      {/* GROUP 2: TABS SELECTOR */}
      <div className="flex items-center gap-2">
        <div className="flex items-center p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("AKTIF");
            }}
            className={cn(
              "px-3 py-1 text-[9px] font-black tracking-widest uppercase rounded-lg transition-all",
              activeTab === "AKTIF" ? "bg-cyan-500 text-slate-950 shadow-lg" : "text-slate-500 hover:text-white"
            )}
          >
            Takiptekiler
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("PASIF");
            }}
            className={cn(
              "px-3 py-1 text-[9px] font-black tracking-widest uppercase rounded-lg transition-all",
              activeTab === "PASIF" ? "bg-slate-700 text-white shadow-lg" : "text-slate-500 hover:text-white"
            )}
          >
            Arşiv
          </button>
        </div>
      </div>

      {/* GROUP 3: COMMAND ACTIONS */}
      <div className="flex items-center gap-2">
        <div className="flex items-center p-1 bg-slate-950/60 border border-slate-800/80 rounded-xl gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewTrade?.();
            }}
            className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all bg-emerald-500 text-slate-950 flex items-center gap-1"
          >
            <Zap className="w-3 h-3" /> YENİ İŞLEM
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearAll(activeTab === "AKTIF" ? "active" : "passive");
            }}
            className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
            title="Tümünü Temizle (Satış Yapar)"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", clearingAction === "active" && "animate-spin")} />
          </button>

          {activeTab === "AKTIF" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll("archive");
              }}
              className="p-1.5 rounded-lg border border-amber-500/20 text-amber-500 hover:bg-amber-500/10"
              title="Tümünü Arşivle (Satış Yapmaz)"
            >
              <Archive className={cn("w-3.5 h-3.5", clearingAction === "archive" && "animate-spin")} />
            </button>
          )}

          <div className="w-[1px] h-4 bg-slate-800 mx-1" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSectionExpanded(!isSectionExpanded);
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all",
              isSectionExpanded ? "bg-cyan-500 text-slate-950 shadow-md" : "text-slate-500 hover:text-white"
            )}
          >
            {isSectionExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span className="hidden sm:inline">{isSectionExpanded ? "GİZLE" : "GÖSTER"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
