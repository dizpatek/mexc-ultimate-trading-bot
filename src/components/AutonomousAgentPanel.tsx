"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

// ─── Tipler ──────────────────────────────────────────────────────────────────

type AgentTaskType =
  | "error_analysis"
  | "strategy_review"
  | "parameter_suggest"
  | "wiki_update"
  | "dataset_monitor"
  | "autoresearch_review";

interface AgentSuggestion {
  id: string;
  taskId: string;
  title: string;
  description: string;
  actionType: "code_change" | "config_update" | "wiki_note" | "alert" | "info";
  approved: boolean;
  createdAt: number;
}

interface AgentConversationEntry {
  id: string;
  taskType: AgentTaskType;
  prompt: string;
  response: string;
  suggestions: AgentSuggestion[];
  durationMs: number;
  createdAt: number;
  status: "success" | "error" | "pending";
}

interface AgentStatus {
  isRunning: boolean;
  lastTaskAt: number | null;
  currentTask: unknown | null;
  totalTasksRun: number;
  totalSuggestions: number;
  pendingSuggestions: number;
}

// ─── Sabitler ────────────────────────────────────────────────────────────────

const TASK_LABELS: Record<AgentTaskType, { label: string; icon: string; desc: string }> = {
  error_analysis:      { label: "Hata Analizi",       icon: "🔍", desc: "Sistem loglarını tara ve hataları Gemma 4 ile analiz et" },
  strategy_review:     { label: "Strateji Değerlendirme", icon: "📊", desc: "Son trade geçmişini değerlendir" },
  parameter_suggest:   { label: "Parametre Önerisi",   icon: "⚙️", desc: "AutoResearch sonuçlarına göre optimum parametreler öner" },
  autoresearch_review: { label: "AutoResearch Analizi", icon: "🧪", desc: "En iyi backtest sonuçlarını analiz et" },
  dataset_monitor:     { label: "Dataset İzleme",      icon: "🎓", desc: "Eğitim dataset üretimini değerlendir" },
  wiki_update:         { label: "Wiki Güncelle",        icon: "📚", desc: "Wiki'yi son değişikliklerle güncelle" },
};

const ACTION_COLORS: Record<string, string> = {
  code_change:   "#f59e0b",
  config_update: "#3b82f6",
  wiki_note:     "#8b5cf6",
  alert:         "#ef4444",
  info:          "#10b981",
};

// ─── Bileşen ─────────────────────────────────────────────────────────────────

export default function AutonomousAgentPanel() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [log, setLog] = useState<AgentConversationEntry[]>([]);
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AgentConversationEntry | null>(null);
  const [activeTab, setActiveTab] = useState<"log" | "suggestions">("log");
  const [error, setError] = useState<string | null>(null);
  const [loopStatus, setLoopStatus] = useState<{ isActive: boolean; iteration: number; lastAction: string; nextRunAt: number | null; } | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // ─── Veri Yükle ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const res = await axios.get("/api/agent");
      if (res.data.ok) {
        setStatus(res.data.status);
        setLog(res.data.conversationLog || []);
        setSuggestions(res.data.suggestions || []);
        setError(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Ajan API bağlantı hatası: ${msg}`);
    }
  }, []);

  // Hızlı poll: görev çalışırken 2s, yoksa 5s
  useEffect(() => {
    fetchData();
    const interval = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      const ms = (status?.isRunning || isRunning) ? 2000 : 6000;
      pollRef.current = setInterval(fetchData, ms);
    };
    interval();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, status?.isRunning, isRunning]);

  // ─── Görev Tetikle (Fire-and-Forget) ────────────────────────────────────────

  const runTask = async (taskType: AgentTaskType) => {
    setIsRunning(true);
    setError(null);
    try {
      // POST anında döner (arka planda Gemma 4 çalışıyor)
      await axios.post("/api/agent", { action: "run", taskType }, { timeout: 10000 });
      setActiveTab("log");
      // Poll hızını artır — Gemma 4 bitince otomatik görünür
      await fetchData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Görev başlatılamadı: ${msg}`);
      setIsRunning(false);
    }
  };

  // ─── Infinite Loop Kontrolleri ──────────────────────────────────────────────

  const fetchLoopStatus = useCallback(async () => {
    try {
      const res = await axios.get("/api/agent/loop-control");
      if (res.data.ok) {
        setLoopStatus(res.data.status);
      }
    } catch (e) {
      console.error("Loop status alınamadı:", e);
    }
  }, []);

  const toggleLoop = async () => {
    try {
      const action = loopStatus?.isActive ? "stop" : "start";
      await axios.post("/api/agent/loop-control", { action });
      await fetchLoopStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Loop değiştirilemedi: ${msg}`);
    }
  };

  useEffect(() => {
    fetchLoopStatus();
    const interval = setInterval(fetchLoopStatus, Math.max(2000, loopStatus?.isActive ? 2000 : 8000));
    return () => clearInterval(interval);
  }, [fetchLoopStatus, loopStatus?.isActive]);

  // ─── Öneri Onayla ───────────────────────────────────────────────────────────

  const approveSuggestion = async (id: string) => {
    try {
      await axios.post("/api/agent", { action: "approve", suggestionId: id });
      await fetchData();
    } catch { /* sessiz */ }
  };

  const clearSuggestions = async () => {
    try {
      await axios.post("/api/agent", { action: "clear_suggestions" });
      setSuggestions([]);
    } catch { /* sessiz */ }
  };

  // ─── Yardımcılar ────────────────────────────────────────────────────────────

  const taskLabel = (t: AgentTaskType) => TASK_LABELS[t]?.label || t;
  const taskIcon  = (t: AgentTaskType) => TASK_LABELS[t]?.icon || "🤖";
  const timeAgo   = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s önce`;
    if (s < 3600) return `${Math.floor(s / 60)}dk önce`;
    return `${Math.floor(s / 3600)}sa önce`;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f1117 0%, #1a1d2e 100%)",
      border: "1px solid rgba(139, 92, 246, 0.3)",
      borderRadius: "16px",
      padding: "24px",
      fontFamily: "'Inter', sans-serif",
      color: "#e2e8f0",
      minHeight: "600px",
    }}>
      {/* ─── Header ─── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "12px",
          background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px",
        }}>🤖</div>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px" }}>
            Otonom AI Ajan Konsolu
          </h2>
          <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
            Antigravity × Gemma 4 — AI-to-AI Geliştirme Döngüsü
          </p>
        </div>
        {/* Durum Göstergesi ve Loop Kontrolü */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "16px", alignItems: "center" }}>
          
          {/* LOOOP ŞALTERİ */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: loopStatus?.isActive ? "#10b981" : "#64748b", paddingLeft: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Infinite Loop
              </div>
              <button 
                  onClick={toggleLoop}
                  style={{
                      background: loopStatus?.isActive ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      border: `1px solid ${loopStatus?.isActive ? "#10b981" : "#ef4444"}`,
                      color: loopStatus?.isActive ? "#10b981" : "#fca5a5",
                      padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                      transition: "all 0.2s"
                  }}
              >
                  {loopStatus?.isActive ? "⚡ AKTİF (Durdur)" : "⏸ KAPALI (Başlat)"}
              </button>
          </div>

          <div style={{ width: "1px", height: "30px", background: "rgba(255,255,255,0.1)" }} />

          {status && (
            <>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Toplam Görev</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#a78bfa" }}>{status.totalTasksRun}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Bekleyen Öneri</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#f59e0b" }}>{status.pendingSuggestions}</div>
              </div>
            </>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: (isRunning || status?.isRunning) ? "rgba(139, 92, 246, 0.15)" : "rgba(100, 116, 139, 0.15)",
            border: `1px solid ${(isRunning || status?.isRunning) ? "#8b5cf6" : "#475569"}`,
            borderRadius: "20px", padding: "6px 12px", fontSize: "12px",
          }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: (isRunning || status?.isRunning) ? "#a78bfa" : "#475569",
              animation: (isRunning || status?.isRunning) ? "pulse 1.5s infinite" : "none",
            }}/>
            {(isRunning || status?.isRunning) ? "Gemma Düşünüyor..." : "Hazır"}
          </div>
        </div>
      </div>

      {/* ─── Loop Bilgi Bandı (Eğer Aktifse) ─── */}
      {loopStatus?.isActive && (
        <div style={{
            background: "linear-gradient(90deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0) 100%)",
            borderLeft: "3px solid #10b981", borderRadius: "4px", padding: "10px 14px", marginBottom: "20px",
            display: "flex", alignItems: "center", gap: "10px"
        }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "pulse 1s infinite" }} />
            <div style={{ fontSize: "12px", color: "#64748b" }}>
                <span style={{ fontWeight: 700, color: "#cbd5e1" }}>Otonom Döngü İterasyon #{loopStatus.iteration}:</span> {loopStatus.lastAction}
            </div>
        </div>
      )}

      {/* ─── Hata Bandı ─── */}
      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
          fontSize: "13px", color: "#fca5a5",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ─── Görev Butonları ─── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>
          Görev Tetikle
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
          {(Object.entries(TASK_LABELS) as [AgentTaskType, typeof TASK_LABELS[AgentTaskType]][]).map(([type, info]) => (
            <button
              key={type}
              id={`agent-task-${type}`}
              onClick={() => runTask(type)}
              disabled={isRunning || status?.isRunning}
              title={info.desc}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                padding: "10px 12px",
                color: "#e2e8f0",
                cursor: (isRunning || status?.isRunning) ? "not-allowed" : "pointer",
                opacity: (isRunning || status?.isRunning) ? 0.5 : 1,
                textAlign: "left",
                transition: "all 0.2s",
                fontSize: "12px",
              }}
              onMouseEnter={e => { if (!isRunning) (e.target as HTMLElement).style.borderColor = "#8b5cf6"; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              <span style={{ fontSize: "16px" }}>{info.icon}</span>
              <div style={{ marginTop: "4px", fontWeight: 600 }}>{info.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Sekmeler ─── */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "4px" }}>
        {(["log", "suggestions"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: "8px", border: "none", borderRadius: "8px",
              cursor: "pointer", fontSize: "13px", fontWeight: 600,
              background: activeTab === tab ? "rgba(139, 92, 246, 0.3)" : "transparent",
              color: activeTab === tab ? "#a78bfa" : "#64748b",
              transition: "all 0.2s",
            }}
          >
            {tab === "log" ? `💬 Konuşma Logu (${log.length})` : `💡 Öneriler (${suggestions.length})`}
          </button>
        ))}
      </div>

      {/* ─── İçerik Alanı ─── */}
      <div style={{ maxHeight: "420px", overflowY: "auto" }}>

        {/* ─── Log Sekmesi ─── */}
        {activeTab === "log" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {log.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>🤖</div>
                <div style={{ fontSize: "14px" }}>Henüz görev çalıştırılmadı.</div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>Yukarıdaki butonlardan bir görev tetikle!</div>
              </div>
            ) : (
              log.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
                  style={{
                    background: entry.id.startsWith("ag-") ? "rgba(14, 165, 233, 0.05)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${entry.status === "error" ? "rgba(239,68,68,0.3)" : selectedEntry?.id === entry.id ? "rgba(139,92,246,0.5)" : entry.id.startsWith("ag-") ? "rgba(14, 165, 233, 0.3)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: "10px", padding: "12px 14px",
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: selectedEntry?.id === entry.id ? "12px" : 0 }}>
                    <span style={{ fontSize: "18px" }}>{entry.id.startsWith("ag-") ? "⚡" : taskIcon(entry.taskType)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: entry.id.startsWith("ag-") ? "#38bdf8" : "inherit" }}>
                        {entry.id.startsWith("ag-") ? "Antigravity" : taskLabel(entry.taskType)}
                      </div>
                      <div style={{ fontSize: "11px", color: entry.id.startsWith("ag-") ? "#0284c7" : "#64748b" }}>
                        {timeAgo(entry.createdAt)} {entry.durationMs > 0 ? `· ${(entry.durationMs / 1000).toFixed(1)}s` : ""}
                        {entry.suggestions.length > 0 && <span style={{ marginLeft: "8px", color: "#f59e0b" }}>+{entry.suggestions.length} öneri</span>}
                      </div>
                    </div>
                    <div style={{
                      fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
                      background: entry.id.startsWith("ag-") ? "rgba(14, 165, 233, 0.15)" : entry.status === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                      color: entry.id.startsWith("ag-") ? "#38bdf8" : entry.status === "success" ? "#10b981" : "#ef4444",
                    }}>
                      {entry.id.startsWith("ag-") ? "Ajan Tepkisi" : entry.status === "success" ? "✓ Başarılı" : "✗ Hata"}
                    </div>
                  </div>

                  {/* Genişletilmiş Görünüm */}
                  {selectedEntry?.id === entry.id && (
                    <div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "6px", fontWeight: 600 }}>YANIT:</div>
                      <div style={{
                        background: entry.id.startsWith("ag-") ? "rgba(14, 165, 233, 0.1)" : "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "12px",
                        fontSize: "13px", lineHeight: "1.7", color: entry.id.startsWith("ag-") ? "#e0f2fe" : "#cbd5e1",
                        maxHeight: "250px", overflowY: "auto", whiteSpace: "pre-wrap",
                        border: entry.id.startsWith("ag-") ? "1px solid rgba(14, 165, 233, 0.2)" : "none",
                      }}>
                        {entry.response}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        )}

        {/* ─── Öneriler Sekmesi ─── */}
        {activeTab === "suggestions" && (
          <div>
            {suggestions.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px" }}>
                <button
                  onClick={clearSuggestions}
                  style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "6px", padding: "5px 10px", color: "#fca5a5",
                    cursor: "pointer", fontSize: "12px",
                  }}
                >
                  🗑 Tümünü Temizle
                </button>
              </div>
            )}
            {suggestions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>💡</div>
                <div style={{ fontSize: "14px" }}>Henüz öneri yok.</div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>Bir görev çalıştırınca Gemma 4'ün önerileri burada görünür.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {suggestions.map(s => (
                  <div
                    key={s.id}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${ACTION_COLORS[s.actionType] || "#475569"}40`,
                      borderLeft: `3px solid ${ACTION_COLORS[s.actionType] || "#475569"}`,
                      borderRadius: "10px", padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                          {s.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                          {s.description}
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "11px" }}>
                          <span style={{
                            background: `${ACTION_COLORS[s.actionType]}20`,
                            color: ACTION_COLORS[s.actionType],
                            borderRadius: "10px", padding: "2px 8px",
                          }}>
                            {s.actionType}
                          </span>
                          <span style={{ marginLeft: "8px", color: "#475569" }}>{timeAgo(s.createdAt)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => approveSuggestion(s.id)}
                        disabled={s.approved}
                        style={{
                          background: s.approved ? "rgba(16,185,129,0.2)" : "rgba(139,92,246,0.2)",
                          border: `1px solid ${s.approved ? "#10b981" : "#8b5cf6"}`,
                          borderRadius: "8px", padding: "6px 12px",
                          color: s.approved ? "#10b981" : "#a78bfa",
                          cursor: s.approved ? "default" : "pointer",
                          fontSize: "12px", fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.approved ? "✓ Onaylandı" : "Onayla"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Son Görev Zamanı ─── */}
      {status?.lastTaskAt && (
        <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "11px", color: "#475569", textAlign: "right" }}>
          Son görev: {timeAgo(status.lastTaskAt)} · Toplam {status.totalSuggestions} öneri üretildi
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
