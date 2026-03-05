import { api } from "@/services/api";

/**
 * Frontend Logger Utility
 * Designed to send detailed system events to the backend (`/api/logs/system`)
 * so they appear in the Matrix Dual Terminal (CombatLog).
 */

// Buffer for frontend system logs to prevent HTTP request flooding
interface LogEntry {
  level: string;
  message: string;
  details?: string;
  retries?: number;
}
const logBuffer: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

const enqueueLog = (level: string, message: string, details?: string) => {
  logBuffer.push({ level, message, details, retries: 0 });

  if (flushTimeout) clearTimeout(flushTimeout);

  // Flush immediately if buffer gets too large, otherwise wait 500ms
  if (logBuffer.length >= 5) {
    flushFrontendLogs();
  } else {
    flushTimeout = setTimeout(flushFrontendLogs, 500);
  }
};

const flushFrontendLogs = async () => {
  if (logBuffer.length === 0) return;

  // Take up to 20 logs per batch
  const batch = logBuffer.splice(0, 20);

  try {
    // Send as a single bulk request to prevent HTTP connection flooding
    await api.post("/logs/system/batch", batch);
  } catch {
    // If it fails, put them back to try again later, but only up to 3 times
    const retryable = batch
      .map((log) => ({ ...log, retries: (log.retries || 0) + 1 }))
      .filter((log) => log.retries <= 3);

    if (retryable.length > 0) {
      logBuffer.unshift(...retryable);
    }
  }
};

export const logger = {
  info: (message: string, details?: string) =>
    enqueueLog("INFO", message, details),
  warn: (message: string, details?: string) =>
    enqueueLog("WARN", message, details),
  error: (message: string, details?: string) =>
    enqueueLog("ERROR", message, details),
  success: (message: string, details?: string) =>
    enqueueLog("SUCCESS", message, details),
  ai: (message: string, details?: string) =>
    enqueueLog("INFO", `🤖 ${message}`, details),
  whale: (message: string, details?: string) =>
    enqueueLog("WARN", `🐋 ${message}`, details),
};
