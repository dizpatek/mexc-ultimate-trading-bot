import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { api } from "@/services/api";
import { AxiosError } from "axios";
import { normalizeSymbol, extractBaseAsset } from "@/lib/symbol-utils";

export interface LogEntry {
  id: string;
  timestamp: number;
  type:
    | "EXECUTION"
    | "SYSTEM"
    | "AI_DECISION"
    | "WHALE_ALERT"
    | "STRUCTURE"
    | "F4_SIGNAL";
  message: string;
  details?: string;
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  /** Pre-parsed asset symbol (e.g. 'BTCUSDT') for efficient portfolio filtering */
  assetSymbol?: string;
  timeframe?: string;
  strategyName?: string;
  userId?: number;
  meta?: {
    aiScore?: number;
    regime?: string;
    prediction?: string;
    mtf?: string;
    veto?: string;
    confidence?: number;
    isWhale?: boolean;
    price?: number;
    f4Power?: number;
    f4PowerLoss?: number;
    insight?: string;
    originalIntent?: string;
    scanTimeframe?: string;
    pilotTimeframe?: string;
  };
}

/**
 * Extracts timeframe information from a string using regex
 */
function extractTimeframe(text: string): { timeframe: string; suffix: string } {
  const match = text.match(/\(([^)]+)\)$/) || text.match(/\[([^\]]+)\]$/);
  if (match) {
    return {
      timeframe: match[1].trim(),
      suffix: ` ${match[0]}`,
    };
  }
  return { timeframe: "", suffix: "" };
}

function extractMetaData(raw: any): {
  message?: string;
  meta?: LogEntry["meta"];
} {
  let extractedDetail: string | undefined;
  let metaData: LogEntry["meta"] = undefined;

  if (!raw) return { message: undefined, meta: undefined };

  try {
    let data = raw;

    // De-stringify if needed
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          data = JSON.parse(trimmed);
        } catch (e) {
          // Not valid JSON, continue with string
        }
      }
    }

    if (typeof data === "object" && data !== null) {
      extractedDetail =
        data.detail ||
        data.msg ||
        data.message ||
        data.reason ||
        data.reasonText;

      // Exhaustive search for indicator payload
      const indicators =
        data.indicators ||
        data.execution_result?.indicators ||
        data.meta?.rawSignal?.indicators ||
        data.meta?.indicators ||
        (typeof data.execution_result === "object"
          ? data.execution_result
          : undefined) ||
        data.meta ||
        data;

      const aiScoreRaw =
        indicators?.aiScore ?? data.aiScore ?? data.finalAiScore;
      const regimeRaw =
        indicators?.regime ??
        data.regime ??
        data.regimePrediction ??
        indicators?.regimePrediction;

      if (aiScoreRaw !== undefined || regimeRaw || indicators?.whaleDetected) {
        metaData = {
          aiScore: Number(aiScoreRaw) || 0,
          regime: String(regimeRaw || ""),
          prediction: String(
            indicators?.prediction?.text ??
            indicators?.prediction ??
            data.prediction?.text ??
            data.prediction ?? ""
          ),
          mtf: String(
            indicators?.mtfVerdict ??
            indicators?.mtfConsensus ??
            data.mtfConsensus ??
            data.mtfVerdict ?? ""
          ),
          veto: String(
            data.vetoReason ||
            data.meta?.vetoReason ||
            data.veto_reason ||
            indicators?.vetoReason ||
            raw?.veto_reason ||
            (typeof raw === "object" && raw !== null ? raw.veto_reason : "") || ""
          ),
          confidence: Number(
            data.confidence ||
            indicators?.confidence ||
            indicators?.saeConfidence || 0
          ),
          isWhale: !!(
            data.is_whale ||
            indicators?.whaleDetected ||
            data.whaleDetected ||
            indicators?.isWhale
          ),
          price: Number(data.price || data.meta?.rawSignal?.price || indicators?.price || 0),
          f4Power: Number(indicators?.f4Power ?? data.f4Power ?? 0),
          f4PowerLoss: Number(indicators?.f4PowerLoss ?? data.f4PowerLoss ?? 0),
          insight: String(indicators?.insight ?? data.insight ?? ""),
          originalIntent: String(data.originalIntent ?? indicators?.originalIntent ?? ""),
        };
      }

      if (indicators) {
        // Create a nice summary of key indicators
        const parts: string[] = [];
        if (indicators.rsi) parts.push(`RSI: ${Math.round(indicators.rsi)}`);
        if (indicators.mfi) parts.push(`MFI: ${Math.round(indicators.mfi)}`);
        if (indicators.volumeScore) parts.push(`VOL: ${indicators.volumeScore}`);
        if (indicators.trend) parts.push(`TRND: ${indicators.trend}`);
        if (indicators.mtfSummary) parts.push(indicators.mtfSummary);

        if (parts.length > 0) {
          const indicatorStr = parts.join(" | ");
          extractedDetail = extractedDetail 
            ? `${extractedDetail} — ${indicatorStr}` 
            : indicatorStr;
        }
      }
    }

    // Fallback for string-only or failed metadata
    if (typeof raw === "string" && !metaData) {
      extractedDetail = raw;
    }
  } catch (e) {
    console.warn("Meta Extraction Failed:", e);
  }

  return { message: extractedDetail, meta: metaData };
}

/**
 * Formats the primary display message for a log entry
 */
function formatLogMessage(sig: any, suffix: string, meta?: any): string {
  if (sig.type === "SYSTEM" || sig.symbol === "SYSTEM") return sig.detail;
  if (sig.type === "WHALE") return `劇 WHALE: ${sig.symbol}`;
  if (["BUY", "SELL", "STOP_LOSS", "TAKE_PROFIT"].includes(sig.type)) {
    return `${sig.type}: ${sig.symbol} @ ${sig.price}`;
  }
  if (sig.type === "STRUCTURE") return `📐 ${sig.type}: ${sig.symbol}`;
  if (sig.type?.startsWith("F4_")) {
    return `⚡ ${sig.type.replace(/_/g, " ")}: ${sig.symbol}`;
  }
  if (sig.type?.startsWith("VETOED_")) {
    const act = sig.type.replace("VETOED_", "");
    return `✋ VETO [${act}]: ${sig.symbol} @ ${sig.price}`;
  }
  if (sig.type?.startsWith("SCANNER_")) {
    const act = sig.type.replace("SCANNER_", "");
    return `🔭 TARAMA [${act}]: ${sig.symbol} @ ${sig.price}`;
  }
  
  const intent = meta?.originalIntent?.toUpperCase() || "";
  const side = sig.side || (sig.type?.includes("BUY") ? "BUY" : sig.type?.includes("SELL") ? "SELL" : (intent.includes("BUY") ? "BUY" : intent.includes("SELL") ? "SELL" : ""));
  const sideIcon = side === "BUY" ? "🟢" : side === "SELL" ? "🔴" : "🎯";
  const sidePrefix = side ? `[${side}] ` : "";
  
  return `${sideIcon} ${sidePrefix}YZ: ${sig.symbol}`.trim();
}

/**
 * Robustly parses a raw log entry from the database into a LogEntry object.
 */
export function parseLogEntry(sig: any, currentUserId?: number): LogEntry {
  const isTrade = ["BUY", "SELL", "STOP_LOSS", "TAKE_PROFIT"].includes(
    sig.type,
  );
  const isSystem = sig.type === "SYSTEM" || sig.symbol === "SYSTEM";

  const { message: extractedDetail, meta: metaDataFromDetail } =
    extractMetaData(sig.detail);
  const { message: execMessage, meta: metaDataFromExec } = extractMetaData(
    sig.execution_result,
  );

  // Combine meta data, prioritizing the structured execution_result
  const metaData = metaDataFromExec || metaDataFromDetail || {};

  if (sig.executed) {
    const isOwn = currentUserId && Number(sig.signal_user_id) === Number(currentUserId);
    if (isOwn) {
        metaData.veto = "✅ İŞLEME GİRİLDİ (Order Pipeline Sync)";
    } else {
        // Strict Isolation: If not own, mark as external to avoid confusion (API should ideally hide these anyway)
        metaData.veto = "🌐 DİĞER KULLANICI / SİSTEM İŞLEMİ";
    }
  } else if (sig.veto_reason) {
    const isOwn = currentUserId && Number(sig.signal_user_id) === Number(currentUserId);
    if (isOwn) {
        metaData.veto = sig.veto_reason;
    } else {
        metaData.veto = "🔍 DİĞER KULLANICI ANALİZİ";
    }
  } else if (execMessage) {
    metaData.veto = execMessage;
  }

  const isVetoed = !!metaData?.veto;

  let logType: LogEntry["type"] = "AI_DECISION";
  if (isTrade && !isVetoed) logType = "EXECUTION";
  else if (isSystem) logType = "SYSTEM";
  else if (sig.type === "WHALE" || sig.type === "WHALE_ALERT")
    logType = "WHALE_ALERT";
  else if (sig.type === "STRUCTURE") logType = "STRUCTURE";
  else if (sig.type?.startsWith("F4_")) logType = "F4_SIGNAL";

  let finalDetail = extractedDetail;
  // Fallback Kaldırıldı: Eğer detay yoksa boş kalmalı, "Pilot ON" yazmamalı.
  // if (!finalDetail && sig.strategy_name) {
  //   finalDetail = sig.executed ? `ONAYLANDI: ${sig.strategy_name}` : sig.strategy_name;
  // }

  const { timeframe: parsedTf, suffix: tfSuffix } = extractTimeframe(
    finalDetail || "",
  );
  const displayMessage = formatLogMessage(sig, tfSuffix, metaData);
  // Standardize timeframe strings for UI consistency
  let finalTimeframe = parsedTf || sig.timeframe || "";
  if (finalTimeframe === "1M") finalTimeframe = "1Mo";
  else if (finalTimeframe) finalTimeframe = finalTimeframe.toLowerCase();

  return {
    id: sig.id,
    timestamp: Number(sig.timestamp),
    type: logType,
    message: displayMessage,
    // Clear details if we have rich meta data to avoid UI clutter,
    // keep it only for SYSTEM messages or when no meta is found.
    details:
      isSystem || !metaData
        ? finalDetail
        : (finalDetail || (metaData.veto ? `VETO: ${metaData.veto}` : undefined)),
    assetSymbol: isSystem ? undefined : normalizeSymbol(sig.symbol),
    timeframe: finalTimeframe,
    strategyName:
      sig.strategy_name ||
      (Object.keys(metaData).length > 0 ? "MATRIX_V5" : undefined),
    meta: Object.keys(metaData).length > 0 ? metaData : undefined,
    userId: sig.signal_user_id ? Number(sig.signal_user_id) : undefined,
    sentiment: [
      "BUY",
      "SCANNER_BUY",
      "VETOED_BUY",
      "F4_CONFIRMED_BUY",
      "F4_EARLY_BUY",
    ].includes(sig.type)
      ? "POSITIVE"
      : [
          "SELL",
          "SCANNER_SELL",
          "VETOED_SELL",
          "F4_CONFIRMED_SELL",
          "F4_EARLY_SELL",
        ].includes(sig.type)
        ? "NEGATIVE"
        : isSystem
          ? /yetersiz|atlandı|hata|error|failed|veto|loss|düşüş|ayı/i.test(
              displayMessage,
            )
            ? "NEGATIVE"
            : /aktif|onaylandı|başarılı|success|long|boğa|📈|🎯|on/i.test(
                  displayMessage,
                )
              ? "POSITIVE"
              : "NEUTRAL"
          : "NEUTRAL",
  };
}

const SCAN_COOLDOWN_MS = 10000; // Safe margin (server is 5s)
let isScanningGlobal = false; // Shared lock for all hook instances in the SAME tab

export function useCombatLogs(
  timeframe: string = "4h",
  enabled: boolean = true,
) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "done">(
    "idle",
  );
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || !enabled || !user?.id) {
      if (!enabled || !token) setIsLoading(false);
      return;
    }

    try {
      // P3.2 Fix: Fetch ALL signals regardless of current UI timeframe
      // This ensures we keep history when switching views
      const response = await api.get(`/logs/signals?timeframe=${timeframe || "1m"}`, {
        timeout: 15000, // 15s threshold
      });
      const data = response.data;
      setError(null);

      if (Array.isArray(data)) {
        const formattedLogs: LogEntry[] = data
          .map((sig: any) => parseLogEntry(sig, user.id))
          .filter((log) => {
            // Hide any signals (AI, Execution, F4) that don't belong to the current user
            // to ensure strict privacy and prevent "BAŞKA KULLANICI" confusion.
            // SYSTEM logs with userId=null are kept for engine status visibility.
            if (log.type !== "SYSTEM" && log.userId && log.userId !== user.id) {
              return false;
            }
            return true;
          });
        setLogs(formattedLogs.slice(0, 1000)); // cap to keep filtering cost bounded
      }
    } catch (err) {
      console.error("Fetch Logs Error:", err);
      // Don't set error message for 401 as it's handled globally
      if (!(err instanceof AxiosError && err.response?.status === 401)) {
        const isTimeout = err instanceof AxiosError && (err.code === 'ECONNABORTED' || err.message?.includes('timeout'));
        setError(isTimeout ? "İstek Zaman Aşımına Uğradı (Yavaş Bağlantı)" : "Veri Çekilemedi");
      }
    } finally {
      setIsLoading(false);
    }
  }, [timeframe, user?.id, enabled]);

  const triggerScan = useCallback(
    async (isManual: boolean = false) => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token || !enabled) return;

      const now = Date.now();

      // 1. Same-tab shared lock
      if (isScanningGlobal) return;

      // 2. Cross-tab localStorage check
      const lastScanStored = Number(
        localStorage.getItem("last_signal_scan") || 0,
      );
      const timeSinceLast = now - lastScanStored;

      const currentCooldown = isManual ? 3000 : SCAN_COOLDOWN_MS;

      if (timeSinceLast < currentCooldown) {
        if (isManual) {
          console.log(
            `[P4.3-ULTRA-SAFE] Manual Throttle: Retry in ${Math.ceil((currentCooldown - timeSinceLast) / 1000)}s`,
          );
        }
        return;
      }

      try {
        isScanningGlobal = true;
        setScanStatus("scanning");
        const response = await api.get(`/signals/scan?timeframe=${timeframe}`, {
          timeout: 20000, // Slightly longer for heavy scan operations
        });

        const finishTime = Date.now();
        localStorage.setItem("last_signal_scan", finishTime.toString());
        setLastScanTime(finishTime);
        setScanStatus("done");
        await fetchLogs();
      } catch (err: unknown) {
        if (err instanceof AxiosError) {
          if (err.response?.status === 429) {
            const serverRetryMs =
              err.response.data?.retryAfterMs || SCAN_COOLDOWN_MS;
            // Sync exactly with server requirement + 2s padding
            localStorage.setItem(
              "last_signal_scan",
              (
                Date.now() -
                (SCAN_COOLDOWN_MS - serverRetryMs) +
                2000
              ).toString(),
            );
            console.warn(
              `[P4.3-ULTRA-SAFE] Server 429. Syncing lock for ${Math.ceil(serverRetryMs / 1000)}s`,
            );
            setScanStatus("idle");
          } else if (err.response?.status === 400) {
            const msg = err.response.data?.error || "Geçersiz İstek";
            setError(msg);
            setScanStatus("idle");
          } else if (err.response?.status === 401) {
            setScanStatus("idle");
          } else {
            console.error("Signal Scan Error:", err);
            setScanStatus("idle");
          }
        } else {
          console.error("Signal Scan Error:", err);
          setScanStatus("idle");
        }
      } finally {
        isScanningGlobal = false;
      }
    },
    [fetchLogs, timeframe],
  );

  useEffect(() => {
    if (!enabled) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000); // 15s - Optimized
    return () => clearInterval(interval);
  }, [fetchLogs, enabled]);

  useEffect(() => {
    // P4.3 Fix: REMOVED automatic scan interval to prevent "API Explosion" when multiple tabs are open.
    // Periodic scanning is now handled by the background bot-worker.mjs (every 90s).
    // Manual scan can still be triggered via UI button.
    
    const jitter = Math.random() * 5000;
    const timer = setTimeout(() => {
      triggerScan(false);
    }, jitter);

    return () => {
      clearTimeout(timer);
    };
  }, [triggerScan]);

  return {
    logs,
    scanStatus,
    lastScanTime,
    isLoading,
    error,
    fetchLogs,
    triggerScan,
  };
}

// --- Log Processing Utilities (exported to keep CombatLog as a pure UI layer) ---

const FILTERED_SYSTEM_PREFIXES = [
  "Matrix Engine Online:",
  "STRATEGY_CYCLE_START",
  "Sistem PİLOT çalışma durumunu değiştirdi.",
  "Kullanıcı oturumu başlatıldı",
];

export function deduplicateSystemLogs(logs: LogEntry[]): LogEntry[] {
  const seen = new Set<string>();
  return logs
    .filter((l) => {
      if (l.type !== "SYSTEM") return false;
      if (FILTERED_SYSTEM_PREFIXES.some((p) => l.message.startsWith(p)))
        return false;
      if (seen.has(l.message)) return false;
      seen.add(l.message);
      return true;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function filterSignalsByHoldings(
  tradeLogs: LogEntry[],
  holdings: { symbol: string }[] | null | undefined,
): LogEntry[] {
  // If holdings are null (loading state), don't fallback to all logs
  if (holdings === null || holdings === undefined) return [];

  const heldBases = new Set(
    holdings
      .filter((h) => h.symbol !== "USDT" && h.symbol !== "USDC")
      .map((h) => extractBaseAsset(h.symbol)),
  );

  return tradeLogs.filter((l) => {
    if (!l.assetSymbol) return true; // Keep system/generic logs
    // Always include global signals as they are relevant to everyone
    if (l.assetSymbol === "GLOBAL") return true;

    // Normalize log symbol using extractBaseAsset
    const logBase = extractBaseAsset(l.assetSymbol);
    return heldBases.has(logBase);
  });
}
