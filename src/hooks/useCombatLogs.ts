import { useState, useCallback, useEffect } from "react";
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
      extractedDetail = data.detail || data.msg || data.message || data.reason || data.reasonText;
      
      // Exhaustive search for indicator payload
      const indicators = 
        data.indicators || 
        data.execution_result?.indicators ||
        data.meta?.rawSignal?.indicators || 
        data.meta?.indicators ||
        (typeof data.execution_result === 'object' ? data.execution_result : undefined) ||
        data.meta ||
        data;

      const aiScoreRaw = indicators?.aiScore ?? data.aiScore ?? data.finalAiScore;
      const regimeRaw = indicators?.regime ?? data.regime ?? data.regimePrediction ?? indicators?.regimePrediction;
      
      if (aiScoreRaw !== undefined || regimeRaw || indicators?.whaleDetected) {
        metaData = {
          aiScore: Number(aiScoreRaw),
          regime: regimeRaw,
          prediction: indicators?.prediction?.text ?? indicators?.prediction ?? data.prediction?.text ?? data.prediction,
          mtf: indicators?.mtfVerdict ?? indicators?.mtfConsensus ?? data.mtfConsensus ?? data.mtfVerdict,
          veto: data.vetoReason || data.meta?.vetoReason || data.veto_reason || indicators?.vetoReason,
          confidence: data.confidence || indicators?.confidence || indicators?.saeConfidence,
          isWhale: data.is_whale || indicators?.whaleDetected || data.whaleDetected || indicators?.isWhale,
          price: data.price || data.meta?.rawSignal?.price || indicators?.price,
          f4Power: indicators?.f4Power ?? data.f4Power,
          f4PowerLoss: indicators?.f4PowerLoss ?? data.f4PowerLoss,
        };
      }
    }

    // Fallback for string-only or failed metadata
    if (typeof raw === "string" && !metaData) {
      extractedDetail = raw;
    }

    if (!extractedDetail && metaData?.veto) {
      extractedDetail = `VETO: ${metaData.veto}`;
    }
  } catch (e) {
    console.warn("Meta Extraction Failed:", e);
  }

  return { message: extractedDetail, meta: metaData };
}

/**
 * Formats the primary display message for a log entry
 */
function formatLogMessage(sig: any, suffix: string): string {
  if (sig.type === "SYSTEM" || sig.symbol === "SYSTEM") return sig.detail;
  if (sig.type === "WHALE") return `劇 WHALE: ${sig.symbol}`;
  if (["BUY", "SELL", "STOP_LOSS", "TAKE_PROFIT"].includes(sig.type)) {
    return `${sig.type}: ${sig.symbol} @ ${sig.price}`;
  }
  if (sig.type === "STRUCTURE") return `📐 ${sig.type}: ${sig.symbol}`;
  if (sig.type?.startsWith("F4_")) {
    return `⚡ ${sig.type.replace(/_/g, " ")}: ${sig.symbol}`;
  }
  return `🎯 AI: ${sig.symbol}`;
}

/**
 * Robustly parses a raw log entry from the database into a LogEntry object.
 */
export function parseLogEntry(sig: any, isTestMode: boolean = true): LogEntry {
  const isTrade = ["BUY", "SELL", "STOP_LOSS", "TAKE_PROFIT"].includes(sig.type);
  const isSystem = sig.type === "SYSTEM" || sig.symbol === "SYSTEM";

  const { message: extractedDetail, meta: metaDataFromDetail } = extractMetaData(sig.detail);
  const metaDataFromExec = extractMetaData(sig.execution_result).meta;
  
  // Combine meta data, prioritizing the structured execution_result
  const metaData = metaDataFromExec || metaDataFromDetail;
  const isVetoed = !!metaData?.veto;

  let logType: LogEntry["type"] = "AI_DECISION";
  if (isTrade && !isVetoed) logType = "EXECUTION";
  else if (isSystem) logType = "SYSTEM";
  else if (sig.type === "WHALE" || sig.type === "WHALE_ALERT") logType = "WHALE_ALERT";
  else if (sig.type === "STRUCTURE") logType = "STRUCTURE";
  else if (sig.type?.startsWith("F4_")) logType = "F4_SIGNAL";

  let finalDetail = extractedDetail;

  if (!finalDetail && sig.strategy_name) {
    finalDetail = sig.executed
      ? `ONAYLANDI: ${sig.strategy_name}`
      : sig.strategy_name;
  }

  const { timeframe: parsedTf, suffix: tfSuffix } = extractTimeframe(finalDetail || "");
  const displayMessage = formatLogMessage(sig, tfSuffix);
  const finalTimeframe = parsedTf || sig.timeframe || "";

  return {
    id: sig.id,
    timestamp: Number(sig.timestamp),
    type: logType,
    message: displayMessage,
    // Clear details if we have rich meta data to avoid UI clutter,
    // keep it only for SYSTEM messages or when no meta is found.
    details: (isSystem || !metaData) ? finalDetail : (metaData.veto ? `VETO: ${metaData.veto}` : undefined),
    assetSymbol: isSystem ? undefined : normalizeSymbol(sig.symbol),
    timeframe: finalTimeframe,
    strategyName: sig.strategy_name || (metaData ? "MATRIX_V5" : undefined),
    meta: metaData,
    sentiment: ["BUY", "F4_CONFIRMED_BUY", "F4_EARLY_BUY"].includes(sig.type)
      ? "POSITIVE"
      : ["SELL", "F4_CONFIRMED_SELL", "F4_EARLY_SELL"].includes(sig.type)
        ? "NEGATIVE"
        : isSystem 
          ? (
            /yetersiz|atlandı|hata|error|failed|veto|loss|düşüş|ayı/i.test(displayMessage) ? "NEGATIVE" :
            /aktif|onaylandı|başarılı|success|long|boğa|📈|🎯|on/i.test(displayMessage) ? "POSITIVE" : 
            "NEUTRAL"
          )
          : "NEUTRAL",
  };
}

let globalLastScanTime = 0;

export function useCombatLogs(timeframe: string = "4h") {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "done">(
    "idle",
  );
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const response = await api.get(`/logs/signals?timeframe=${timeframe}`);
      const data = response.data;
      setError(null);

      if (Array.isArray(data)) {
        const formattedLogs: LogEntry[] = data.map((sig: any) => parseLogEntry(sig, true));
        setLogs(formattedLogs.slice(0, 200)); // cap to keep filtering cost bounded
      }
    } catch (err) {
      console.error("Fetch Logs Error:", err);
      setError("Veri Çekilemedi");
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  const triggerScan = useCallback(async () => {
    const now = Date.now();
    if (now - globalLastScanTime < 30000) return;

    try {
      setScanStatus("scanning");
      await api.get(`/signals/scan?timeframe=${timeframe}`);
      globalLastScanTime = Date.now();
      setLastScanTime(globalLastScanTime);
      setScanStatus("done");
      await fetchLogs();
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 429) {
          // Ignore rate limit 429 errors silently
          setScanStatus("idle");
        } else if (err.response?.status === 400) {
          // User errors (like missing keys) should be shown
          const msg = err.response.data?.error || "Geçersiz İstek";
          setError(msg);
          setScanStatus("idle");
        } else {
          console.error("Signal Scan Error:", err);
          setScanStatus("idle");
        }
      } else {
        console.error("Signal Scan Error:", err);
        setScanStatus("idle");
      }
    }
  }, [fetchLogs, timeframe]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    triggerScan();
    const scanInterval = setInterval(triggerScan, 60000);
    return () => clearInterval(scanInterval);
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

export function deduplicateSystemLogs(
  logs: LogEntry[],
): LogEntry[] {
  const seen = new Set<string>();
  return logs.filter((l) => {
    if (l.type !== "SYSTEM") return false;
    if (FILTERED_SYSTEM_PREFIXES.some((p) => l.message.startsWith(p)))
      return false;
    if (seen.has(l.message)) return false;
    seen.add(l.message);
    return true;
  }).sort(
    (a, b) => b.timestamp - a.timestamp,
  );
}

export function filterSignalsByHoldings(
  tradeLogs: LogEntry[],
  holdings: { symbol: string }[] | null | undefined,
): LogEntry[] {
  // P3.1 Fix: If holdings are null (loading state), don't fallback to all logs
  // returning an empty array prevents the "popping" effect where all signals appear briefly then disappear
  if (holdings === null || holdings === undefined) return [];

  // Normalize held symbols: remove slashes and USDT suffix if any, then upper
  // Filter out stablecoins to avoid noise
  const heldBases = new Set(
    holdings
      .filter((h) => h.symbol !== "USDT" && h.symbol !== "USDC")
      .map((h) => extractBaseAsset(h.symbol)),
  );

  return tradeLogs.filter((l) => {
    if (!l.assetSymbol) return false;
    // Always include global signals as they are relevant to everyone
    if (l.assetSymbol === "GLOBAL") return true;

    // Normalize log symbol using extractBaseAsset
    const logBase = extractBaseAsset(l.assetSymbol);
    return heldBases.has(logBase);
  });
}
