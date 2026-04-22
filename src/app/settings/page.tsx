"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { HorizonLayout } from "@/components/matrix-horizon/HorizonLayout";
import {
  Save,
  ArrowLeft,
  Key,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  Zap,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Shield,
  Database,
  Activity,
  Lock,
  Cpu,
  BookOpen,
} from "lucide-react";
import { useNotification } from "@/context/NotificationContext";
import { setTradingModeClient, getTradingModeSync } from "@/lib/trading-mode";
import type { TradingMode } from "@/lib/trading-mode";
import { updateTradingMode } from "@/app/actions/trading-mode";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@/lib/db";
import { useBotConfig } from "@/hooks/useBotConfig";
import { AdminArsenal } from "@/components/admin/AdminArsenal";
import { AutoResearchPanel } from "@/components/AutoResearchPanel";
import { AiTerminal } from "@/components/AiTerminal";
import { TrainingPanel } from "@/components/TrainingPanel";
import dynamic from "next/dynamic";

const AutoResearchMonitor = dynamic(() => import("@/components/dashboard/AutoResearchMonitor").then(m => m.AutoResearchMonitor), { ssr: false });
const AutonomousAgentPanel = dynamic(() => import("@/components/AutonomousAgentPanel").then(m => m.default), { ssr: false });

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { config } = useBotConfig();
  const { notify, confirm } = useNotification();
  const [mode, setMode] = useState("test");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [activeTab, setActiveTab] = useState<"api" | "environment" | "research" | "admin" | "brain" | "training" | "ailab">("api");

  // API Health States
  const [apiHealth, setApiHealth] = useState<"unknown" | "ok" | "error" | "loading">("unknown");
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hasKeys, setHasKeys] = useState(false);
  const [testing, setTesting] = useState(false);

  // Admin States
  const [users, setUsers] = useState<User[]>([]);

  const fetchKeyStatus = useCallback(async () => {
    try {
      setApiHealth("loading");
      const res = await api.get("/settings/keys", { timeout: 8000 });
      const data = res.data;
      setHasKeys(data.hasKeys);
      setApiKeyMasked(data.apiKeyMasked);
      setApiHealth(data.health);
      setApiError(data.error);
    } catch (err: any) {
      setApiHealth("unknown");
      if (err?.response?.status !== 401) {
        console.error("Failed to fetch key status", err);
      }
    }
  }, []);

  const fetchAdminData = useCallback(async () => {
    try {
      const usersRes = await api.get("/admin/users");
      setUsers(usersRes.data.users);
    } catch (err: any) {
      if (err?.response?.status !== 401) {
        console.error("Failed to fetch admin data", err);
      }
    }
  }, []);

  useEffect(() => {
    setMode(getTradingModeSync());
    fetchKeyStatus();
    if (user?.is_admin || user?.id === 1) {
      fetchAdminData();
    }
  }, [user, fetchAdminData, fetchKeyStatus]);

  const disablePilot = async () => {
    try {
      await api.post("/bot/config", { auto_trade: false });
      localStorage.removeItem("bot_config_cache_test");
      localStorage.removeItem("bot_config_cache_production");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("botConfigUpdated"));
      }
    } catch (e) {
      console.error("Failed to turn off auto_trade", e);
    }
  };

  const toggleMode = async (m: string) => {
    const newMode = m as TradingMode;
    await disablePilot();
    setTradingModeClient(newMode);
    if (user?.id) {
      await updateTradingMode(newMode, user.id);
    }
    setMode(m);
    window.location.reload();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setApiHealth("loading");
    try {
      const res = await api.get("/settings/keys", { timeout: 10000 });
      const data = res.data;
      setHasKeys(data.hasKeys);
      setApiKeyMasked(data.apiKeyMasked);
      setApiHealth(data.health);
      setApiError(data.error);
      if (data.health === "ok") {
        notify("✅ MEXC Bağlantısı Başarılı!", "success");
      } else if (data.health === "error") {
        notify(`❌ Bağlantı Hatası: ${data.error || "Bilinmeyen hata"}`, "error");
      } else {
        notify("⚠️ API anahtarları bulunamadı.", "warning");
      }
    } catch (err) {
      setApiHealth("error");
      notify("❌ Bağlantı testi başarısız.", "error");
    } finally {
      setTesting(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    confirm({
      message: "Are you sure you want to delete this user? All their data will be purged.",
      onConfirm: async () => {
        try {
          await api.delete(`/admin/users?id=${id}`);
          setUsers(users.filter((u) => u.id !== id));
          notify("User deleted successfully.", "success");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error("Delete failed:", message);
          notify("Failed to delete user", "error");
        }
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !apiSecret) return notify("Tüm alanları doldurun", "warning");
    setSaving(true);
    try {
      const res = await api.post("/settings/keys", { apiKey, apiSecret });
      const data = res.data;
      if (data.health === "ok") {
        notify("✅ API Anahtarları kaydedildi ve bağlantı doğrulandı!", "success");
        setApiHealth("ok");
      } else {
        notify(`⚠️ Kaydedildi ama bağlantı hatası: ${data.warning || ""}`, "warning");
        setApiHealth("error");
        setApiError(data.warning);
      }
      setApiKey("");
      setApiSecret("");
      fetchKeyStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Save keys failed:", message);
      notify("❌ Kayıt başarısız.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    confirm({
      message: "Tüm simülatör verileri (emirler, portföy, karlar) sıfırlanacak. Emin misiniz?",
      onConfirm: async () => {
        setResetting(true);
        setPendingReset(false);
        try {
          await disablePilot();
          const res = await api.post("/portfolio/reset-simulator");
          if (res.data.success) {
            localStorage.removeItem("bot_config_cache_test");
            localStorage.removeItem("bot_config_cache_live");
            notify("✅ Simülatör başarıyla sıfırlandı!", "success");
            window.location.href = "/";
          } else {
            throw new Error(res.data.error || "Sunucu hatası");
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Bilinmeyen hata";
          notify("❌ Sıfırlama başarısız: " + message, "error");
        } finally {
          setResetting(false);
        }
      }
    });
  };

  const HealthIndicator = () => {
    if (apiHealth === "loading") return (
      <div className="flex items-center gap-2 text-white/50">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
        <span className="text-[9px] font-black uppercase tracking-widest">Test Ediliyor...</span>
      </div>
    );
    if (apiHealth === "ok") return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Bağlı</span>
      </div>
    );
    if (apiHealth === "error") return (
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Hata</span>
      </div>
    );
    return (
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
        <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Bilinmiyor</span>
      </div>
    );
  };

  return (
    <HorizonLayout>
      <Header />
      <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-black/30">
        {/* ═══ SIDEBAR NAVIGATION ═══ */}
        <aside className="w-72 border-r border-white/10 bg-black/40 backdrop-blur-2xl flex flex-col p-6 space-y-3 relative overflow-hidden">
           {/* Futuristic UI Accent */}
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary via-cyan-500/20 to-transparent opacity-50" />
          
          <div className="mb-8 pl-2">
            <h1 className="text-xl font-black italic tracking-tighter flex items-center gap-3">
              <span className="text-white/80">
                <span className="text-primary font-mono opacity-50 mr-1 text-base">{"//"}</span>SYS_CONFIG
              </span>
            </h1>
            <div className="h-px w-12 bg-primary/30 mt-2" />
          </div>

          {[
            { id: "api", icon: Key, label: "API_GATEWAY", color: "text-yellow-500", bg: "bg-yellow-500/10" },
            { id: "environment", icon: ShieldAlert, label: "CORE_ENV", color: "text-primary", bg: "bg-primary/10" },
            { id: "research", icon: Activity, label: "RESEARCH_CORE", color: "text-cyan-400", bg: "bg-cyan-500/10" },
            { id: "training", icon: BookOpen, label: "TRAINING_LAB", color: "text-indigo-400", bg: "bg-indigo-500/10" },
            { id: "ailab", icon: Cpu, label: "AI_LAB", color: "text-violet-400", bg: "bg-violet-500/10" },
            { id: "admin", icon: Zap, label: "ADMIN_OVERRIDE", color: "text-rose-500", bg: "bg-rose-500/10", adminOnly: true },
            { id: "brain", icon: Cpu, label: "AI_CORE_TERMINAL", color: "text-emerald-400", bg: "bg-emerald-500/10" },
          ].map((tab) => {
            if (tab.adminOnly && !(user?.is_admin || user?.id === 1)) return null;
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`group relative flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isActive 
                    ? `border-${tab.id === 'api' ? 'yellow-500' : tab.id === 'environment' ? 'primary' : tab.id === 'research' ? 'cyan-500' : tab.id === 'training' ? 'indigo-500' : tab.id === 'brain' ? 'emerald-500' : 'rose-500'}/30 bg-white/5` 
                    : "border-white/5 bg-transparent opacity-40 hover:opacity-100 hover:bg-white/5"
                }`}
              >
                {isActive && (
                    <div className={`absolute left-0 top-0 w-1 h-full ${tab.bg.replace('bg-', 'bg-')}`} />
                )}
                <div className={`p-2.5 rounded-xl border ${isActive ? `border-${tab.id === 'api' ? 'yellow-500' : tab.id === 'environment' ? 'primary' : tab.id === 'research' ? 'cyan-500' : tab.id === 'training' ? 'indigo-500' : tab.id === 'brain' ? 'emerald-500' : 'rose-500'}/30 ${tab.bg}` : "border-white/10 bg-white/5"}`}>
                  <Icon className={`w-4 h-4 ${isActive ? tab.color : "text-white/30"} group-hover:scale-110 transition-transform`} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isActive ? "text-white" : "text-white/40"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}

          <div className="mt-auto pt-6 border-t border-white/5">
            <button
              onClick={() => router.push("/")}
              className="w-full flex items-center justify-center gap-2 py-4 border border-white/5 hover:bg-white/5 rounded-2xl transition-all group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-white/30 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">DASHBOARD_EXIT</span>
            </button>
          </div>
        </aside>

        {/* ═══ CONTENT AREA ═══ */}
        <main className="flex-1 px-10 py-10 overflow-y-auto cyber-scrollbar relative">
          {/* Subtle Ambient Background */}
          <div className="fixed inset-0 pointer-events-none opacity-20">
             <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] bg-primary/20 blur-[150px] rounded-full" />
             <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-cyan-500/10 blur-[120px] rounded-full" />
          </div>

          <div className={`${activeTab === "research" || activeTab === "ailab" ? "max-w-none" : "max-w-6xl"} mx-auto relative z-10`}>
            {activeTab === "api" && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">API_GATEWAY <span className="text-yellow-500 opacity-50 font-mono text-base ml-2">{"//"} 01</span></h2>
                    <HealthIndicator />
                </div>
                
                <div className="bg-black/40 backdrop-blur-xl border border-yellow-500/20 rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                  {hasKeys && apiKeyMasked && (
                    <div className="mb-10 p-6 rounded-2xl bg-black/50 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <Lock className="w-5 h-5 text-yellow-500/50" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] mb-1">CURRENT_AES_ENCRYPTED_KEY</span>
                            <span className="text-base font-mono text-white tracking-[0.2em] font-bold">{apiKeyMasked}</span>
                        </div>
                      </div>
                      <span className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-widest">VERIFIED_SECURE</span>
                    </div>
                  )}

                  <form onSubmit={handleSave} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] text-white/30 uppercase tracking-[0.4em] font-black block">MEXC_API_KEY</label>
                        <input
                          type="text"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="w-full text-sm font-mono py-4 px-6 bg-black/60 border border-white/10 rounded-2xl text-primary focus:outline-none focus:border-yellow-500 transition-all uppercase tracking-widest"
                          placeholder="MX0V..."
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] text-white/30 uppercase tracking-[0.4em] font-black block">MEXC_SECRET_KEY</label>
                        <div className="relative">
                          <input
                            type={showSecret ? "text" : "password"}
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            className="w-full text-sm font-mono py-4 px-6 pr-14 bg-black/60 border border-white/10 rounded-2xl text-primary focus:outline-none focus:border-yellow-500 transition-all tracking-widest"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                          >
                            {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-[2] py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] bg-yellow-500 text-black hover:bg-yellow-400 hover:shadow-[0_0_40px_rgba(234,179,8,0.4)] transition-all flex items-center justify-center gap-3 disabled:opacity-40"
                      >
                        {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        SAVE_CONFIG
                      </button>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="flex-1 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                      >
                        {testing ? <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" /> : <Wifi className="w-5 h-5" />}
                        PING_TEST
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "environment" && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col gap-8">
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">CORE_ENVIRONMENT <span className="text-primary opacity-50 font-mono text-base ml-2">{"//"} 02</span></h2>
                
                <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-10">
                   <div className="flex items-center gap-8">
                      <button
                        onClick={() => toggleMode("test")}
                        className={`group relative flex-1 p-8 rounded-[2rem] border transition-all duration-300 ${
                          mode === "test" 
                            ? "border-primary bg-primary/5 shadow-[0_0_40px_rgba(110,89,255,0.2)]" 
                            : "border-white/5 bg-black/40 opacity-40 hover:opacity-100"
                        }`}
                      >
                        <Database className={`w-12 h-12 mb-4 ${mode === "test" ? "text-primary" : "text-white/20"}`} />
                        <span className="text-sm font-black uppercase tracking-[0.3em] block mb-1">SIM_SIMULATOR</span>
                        <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono">Sanitised Environment</span>
                        {mode === "test" && <div className="absolute top-4 right-6 w-3 h-3 rounded-full bg-primary animate-ping" />}
                      </button>

                      <button
                        onClick={() => toggleMode("production")}
                        className={`group relative flex-1 p-8 rounded-[2rem] border transition-all duration-300 ${
                          mode === "production" 
                            ? "border-rose-500 bg-rose-500/5 shadow-[0_0_40px_rgba(244,63,94,0.2)]" 
                            : "border-white/5 bg-black/40 opacity-40 hover:opacity-100"
                        }`}
                      >
                        <Activity className={`w-12 h-12 mb-4 ${mode === "production" ? "text-rose-500" : "text-white/20"}`} />
                        <span className="text-sm font-black uppercase tracking-[0.3em] block mb-1">LIVE_EXCHANGE</span>
                        <span className="text-[9px] text-white/30 uppercase tracking-widest font-mono">Real Capital Risk ⚠️</span>
                        {mode === "production" && <div className="absolute top-4 right-6 w-3 h-3 rounded-full bg-rose-500 animate-ping" />}
                      </button>
                   </div>
                </div>

                <div className="bg-rose-950/20 backdrop-blur-xl border border-rose-500/20 rounded-[2.5rem] p-10 border-dashed">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/30">
                                <AlertTriangle className="w-8 h-8 text-rose-500 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-[0.2em] mb-1">PURGE_SIMULATOR</h3>
                                <p className="text-[10px] font-mono text-rose-500/60 uppercase tracking-widest">Wipes all simulated orders & resets to $100,000 USDT.</p>
                            </div>
                        </div>
                        
                        {!pendingReset ? (
                            <button
                                onClick={() => setPendingReset(true)}
                                className="px-10 py-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[11px] font-black uppercase tracking-[0.4em] hover:bg-rose-500 hover:text-black transition-all"
                            >
                                START_PURGE
                            </button>
                        ) : (
                            <div className="flex gap-4">
                                <button onClick={handleReset} className="px-10 py-5 rounded-2xl bg-rose-500 text-black font-black text-[11px] uppercase tracking-[0.4em] shadow-[0_0_30px_rgba(244,63,94,0.5)]">EXECUTE_WIPE</button>
                                <button onClick={() => setPendingReset(false)} className="px-8 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-[11px] uppercase tracking-[0.4em] hover:bg-white/10">CANCEL</button>
                            </div>
                        )}
                    </div>
                </div>
              </div>
            )}

            {activeTab === "research" && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">RESEARCH_CORE <span className="text-cyan-400 opacity-50 font-mono text-base ml-2">{"//"} 03</span></h2>
                </div>
                <AutoResearchPanel />
              </div>
            )}

            {activeTab === "admin" && (user?.is_admin || user?.id === 1) && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">ADMIN_OVERRIDE <span className="text-rose-500 opacity-50 font-mono text-base ml-2">{"//"} 04</span></h2>
                </div>
                <AdminArsenal />
              </div>
            )}

            {activeTab === "training" && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="flex items-center justify-between mb-10">
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">TRAINING_LAB <span className="text-indigo-400 opacity-50 font-mono text-base ml-2">{"//"} 05</span></h2>
                </div>
                <TrainingPanel />
              </div>
            )}

            {activeTab === "ailab" && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-6">
                <div className="flex items-center justify-between mb-10">
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">AI_LAB <span className="text-violet-400 opacity-50 font-mono text-base ml-2">{"//"} 05b</span></h2>
                  <span className="text-[9px] font-black uppercase tracking-widest text-violet-400/60 border border-violet-400/20 px-3 py-1.5 rounded-lg">OTONOM DÖNGÜ AKTİF</span>
                </div>
                {/* AutoResearch Monitor — En İyi Parametre Görüntüleyici */}
                <AutoResearchMonitor />
                {/* Otonom AI Ajan Konsolu */}
                <AutonomousAgentPanel />
              </div>
            )}

            {activeTab === "brain" && (
              <div className="animate-in fade-in slide-in-from-right-8 duration-500 h-[650px]">
                <AiTerminal />
              </div>
            )}
          </div>
        </main>
      </div>
    </HorizonLayout>
  );
};
