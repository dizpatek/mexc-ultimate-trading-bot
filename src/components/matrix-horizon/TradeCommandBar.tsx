import React from "react";
import { 
  Radar, 
  ChevronUp, 
  ChevronDown, 
  RefreshCw, 
  Zap,
  Archive,
  Skull
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
      className={cn(
        "relative z-20 flex flex-col lg:grid lg:grid-cols-3 items-center py-2 px-2 gap-3 border-b border-slate-800/40 bg-slate-950/20 hover:bg-slate-900/40 transition-colors backdrop-blur-sm rounded-t-xl font-mono cursor-pointer",
        isSectionExpanded ? "mb-0" : "mb-0"
      )}
      onClick={() => setIsSectionExpanded(!isSectionExpanded)}
    >
      {/* GROUP 1: SECTION TITLE */}
      <div className="flex flex-wrap items-center gap-2 lg:justify-self-start w-full lg:w-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/20 shadow-lg">
          <Radar className="w-4 h-4 text-cyan-400" />
          <h2 className="text-[10px] font-black tracking-[0.2em] text-cyan-100 uppercase hidden xl:block">
            Akıllı İşlemler
          </h2>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/20">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AKTİF:</span>
          <span className="text-[10px] font-black text-cyan-400">
            {activeTradesCount}
          </span>
        </div>
      </div>

      {/* GROUP 2: TABS SELECTOR */}
      <div className="flex items-center gap-2 lg:justify-self-center justify-center w-full lg:w-auto">
        <div className="flex items-center p-1 bg-slate-950/20">
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
      <div className="flex items-center gap-2 lg:justify-self-end justify-between w-full lg:w-auto">
        <div className="flex items-center p-1 bg-slate-950/20 gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewTrade?.();
            }}
            className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all bg-emerald-500 text-slate-950 flex items-center gap-1 hover:bg-emerald-400"
          >
            <Zap className="w-3 h-3" />
            <span className="hidden sm:inline">YENİ İŞLEM</span>
            <span className="sm:hidden">YENİ</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearAll(activeTab === "AKTIF" ? "active" : "passive");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-600/60 bg-red-950/40 text-red-500 hover:bg-red-600 hover:text-white transition-colors shadow-[0_0_15px_rgba(220,38,38,0.2)]"
            title={activeTab === "AKTIF" ? "DİKKAT: HER ŞEYİ SAT (PANİK BUTONU)" : "GEÇMİŞİ KOMPLE SİL"}
          >
            {clearingAction === (activeTab === "AKTIF" ? "active" : "passive") ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Skull className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest">{activeTab === "AKTIF" ? "HER ŞEYİ SAT" : "GEÇMİŞİ SİL"}</span>
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
