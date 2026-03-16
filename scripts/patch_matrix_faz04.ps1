
# =============================================
# Matrix Horizon FAZ 4 Patch Script
# Kelly + aiSummary + projectionConfidence UI
# =============================================

$decisionBarFile = "src/components/matrix-horizon/DecisionBar.tsx"
$matrixHorizonFile = "src/components/matrix-horizon/MatrixHorizon.tsx"

# =============================================
# FAZ 4 PATCH 1: DecisionBar.tsx — yeni prop'lar + ROW 3 UI
# =============================================
$dbContent = Get-Content $decisionBarFile -Raw -Encoding UTF8

# Props genislet
$old1 = @'
import React from "react";
import { cn } from "@/lib/utils";
import { Shield, Sparkles, Play, Pause, Activity, Zap, X } from "lucide-react";

interface DecisionBarProps {
  decision: "İŞLEM AÇ ✅" | "BEKLE ❌" | "SATIŞ YAP 📉";
  aiSuggestion: string;
  className?: string;
  mode: string;
  riskMode: "safe" | "normal" | "aggressive";
  pilotStatus?: "IDLE" | "SCANNING" | "EXECUTING";
  onRiskModeChange: (mode: "safe" | "normal" | "aggressive") => void;
}

export const DecisionBar: React.FC<DecisionBarProps> = ({
  decision,
  aiSuggestion,
  className,
  mode,
  riskMode,
  pilotStatus = "IDLE",
  onRiskModeChange,
}) => {
'@

$new1 = @'
import React from "react";
import { cn } from "@/lib/utils";
import { Shield, Sparkles, Play, Pause, Activity, Zap, X, TrendingUp, TrendingDown, Brain } from "lucide-react";

interface DecisionBarProps {
  decision: "İŞLEM AÇ ✅" | "BEKLE ❌" | "SATIŞ YAP 📉";
  aiSuggestion: string;
  className?: string;
  mode: string;
  riskMode: "safe" | "normal" | "aggressive";
  pilotStatus?: "IDLE" | "SCANNING" | "EXECUTING";
  onRiskModeChange: (mode: "safe" | "normal" | "aggressive") => void;
  // === MATRIX HORIZON FAZ 4: Yeni bílesen prop'lari ===
  aiSummary?: string;
  kellyFraction?: number;       // 0-1 aralik, pozisyon boyutu onerisi
  projectionBias?: "BULLISH" | "BEARISH" | "NEUTRAL";
  projectionConfidence?: number; // 0-100
}

export const DecisionBar: React.FC<DecisionBarProps> = ({
  decision,
  aiSuggestion,
  className,
  mode,
  riskMode,
  pilotStatus = "IDLE",
  onRiskModeChange,
  aiSummary,
  kellyFraction = 0,
  projectionBias = "NEUTRAL",
  projectionConfidence = 50,
}) => {
'@

$dbContent = $dbContent.Replace($old1, $new1)

# ROW 2'den once ROW 3 AI Summary + Kelly bar ekle
$old2 = @'
      {/* ROW 2: RISK SWITCHES - Aligned with the above */}
'@

$new2 = @'
      {/* ROW 2: Matrix Horizon AI Summary + Kelly + Projeksiyon */}
      {aiSummary && (
        <div className="w-full relative z-10 px-1">
          <div className="flex flex-col gap-1.5 bg-slate-950/90 border border-slate-800/60 rounded-xl p-2 shadow-inner">
            {/* AI Summary Satiri */}
            <div className="flex items-start gap-2">
              <Brain className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0 animate-pulse" />
              <p className="text-[8px] sm:text-[9px] text-slate-300 font-medium leading-relaxed line-clamp-2">
                {aiSummary}
              </p>
            </div>

            {/* Kelly + Projeksiyon Satiri */}
            <div className="flex items-center gap-2">
              {/* Kelly Orani */}
              <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1 flex-shrink-0">
                <span className="text-[7px] uppercase font-black tracking-wider text-slate-500">KELLY</span>
                <span className={cn(
                  "text-[9px] font-black font-mono",
                  kellyFraction >= 0.15 ? "text-rose-400" : kellyFraction >= 0.08 ? "text-amber-400" : "text-emerald-400"
                )}>
                  %{(kellyFraction * 100).toFixed(0)}
                </span>
              </div>

              {/* Projeksiyon Guven */}
              <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-700/60 rounded-lg px-2 py-1 flex-shrink-0">
                {projectionBias === "BULLISH" ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : projectionBias === "BEARISH" ? (
                  <TrendingDown className="w-3 h-3 text-rose-400" />
                ) : (
                  <Activity className="w-3 h-3 text-slate-400" />
                )}
                <span className={cn(
                  "text-[8px] font-black font-mono",
                  projectionBias === "BULLISH" ? "text-emerald-400" :
                  projectionBias === "BEARISH" ? "text-rose-400" : "text-slate-400"
                )}>
                  {projectionBias} {projectionConfidence.toFixed(0)}%
                </span>
              </div>

              {/* Kelly Goster Cubugu */}
              <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    kellyFraction >= 0.15 ? "bg-rose-500" :
                    kellyFraction >= 0.08 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(100, kellyFraction * 400)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROW 3: RISK SWITCHES - Aligned with the above */}
'@

$dbContent = $dbContent.Replace($old2, $new2)
Set-Content -Path $decisionBarFile -Value $dbContent -Encoding UTF8 -NoNewline
Write-Host "DecisionBar.tsx FAZ 4 guncellendi."

# =============================================
# FAZ 4 PATCH 2: MatrixHorizon.tsx — DecisionBar cagrisina yeni prop'lari ekle
# =============================================
$mhContent = Get-Content $matrixHorizonFile -Raw -Encoding UTF8

$old3 = @'
<DecisionBar
'@

# DecisionBar cagrisinin tamamini bul ve prop ekle
$hasKelly = $mhContent.Contains("kellyFraction={signal?.kellyFraction")
if (-not $hasKelly) {
  # DecisionBar cagrisindaki mevcut prop sonuna ekle
  $old3b = 'onRiskModeChange={handleRiskModeChange}'
  $new3b = 'onRiskModeChange={handleRiskModeChange}
              aiSummary={signal?.aiSummary}
              kellyFraction={signal?.kellyFraction ?? 0}
              projectionBias={signal?.projectionBias ?? "NEUTRAL"}
              projectionConfidence={signal?.projectionConfidence ?? 50}'
  $mhContent = $mhContent.Replace($old3b, $new3b)
  Write-Host "MatrixHorizon.tsx DecisionBar cagrisina FAZ 4 prop'lari eklendi."
} else {
  Write-Host "MatrixHorizon.tsx zaten guncel, atlandı."
}

Set-Content -Path $matrixHorizonFile -Value $mhContent -Encoding UTF8 -NoNewline
Write-Host "FAZ 4 UI patch tamamlandi."
