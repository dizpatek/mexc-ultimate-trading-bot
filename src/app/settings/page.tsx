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
} from "lucide-react";
import { useNotification } from "@/context/NotificationContext";
import { setTradingModeClient, getTradingModeSync } from "@/lib/trading-mode";
import type { TradingMode } from "@/lib/trading-mode";
import { updateTradingMode } from "@/app/actions/trading-mode";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@/lib/db";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { notify, confirm } = useNotification();
  const [mode, setMode] = useState("test");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pendingReset, setPendingReset] = useState(false);

  // Admin States
  const [users, setUsers] = useState<User[]>([]);

  const fetchAdminData = useCallback(async () => {
    try {
      const usersRes = await api.get("/admin/users");
      setUsers(usersRes.data.users);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    }
  }, []);

  useEffect(() => {
    setMode(getTradingModeSync());
    if (user?.is_admin || user?.id === 1) {
      fetchAdminData();
    }
  }, [user, fetchAdminData]);

  const disablePilot = async () => {
    try {
      await api.post("/bot/config", { auto_trade: false });
      localStorage.removeItem("bot_config_cache_test");
      localStorage.removeItem("bot_config_cache_production");
      // Trigger a local event so useBotConfig updates immediately before reload 
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

    // 1. Client-side update (local storage, cookies)
    setTradingModeClient(newMode);

    // 2. Server-side update (database)
    if (user?.id) {
      await updateTradingMode(newMode, user.id);
    }

    setMode(m);
    window.location.reload();
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
    if (!apiKey || !apiSecret) return notify("Fill all fields", "warning");
    setSaving(true);
    try {
      await api.post("/settings/keys", { apiKey, apiSecret });
      notify("✅ API Keys updated.", "success");
      setApiKey("");
      setApiSecret("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Save keys failed:", message);
      notify("❌ Connection failed.", "error");
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

  return (
    <HorizonLayout>
      <Header />
      <main className="flex-1 px-4 py-8 max-w-full overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push("/")}
            className="btn-outline flex items-center gap-2 !px-4 !py-2 bg-white/5 border-white/10"
          >
            <ArrowLeft className="w-5 h-5 text-primary" />
            <span className="font-bold">BACK</span>
          </button>
          <h1 className="text-3xl font-black italic tracking-tighter">
            SETTINGS
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* Module 1: Active Environment */}
          <div className="stat-card border-primary/20 h-full">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" /> Active
              environment
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => toggleMode("test")}
                className={`p-4 rounded-xl border-2 transition-all font-bold ${mode === "test" ? "border-primary bg-primary/10" : "border-white/5 bg-white/5 opacity-50"}`}
              >
                {" "}
                TEST (SIM){" "}
              </button>
              <button
                onClick={() => toggleMode("production")}
                className={`p-4 rounded-xl border-2 transition-all font-bold ${mode === "production" ? "border-red-500 bg-red-500/10" : "border-white/5 bg-white/5 opacity-50"}`}
              >
                {" "}
                PRODUCTION{" "}
              </button>
            </div>
          </div>

          {/* Module 2: API Keys */}
          <div className="stat-card h-full">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 underline decoration-primary underline-offset-8">
              <Key className="w-5 h-5 text-yellow-500" /> API Keys
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input-field w-full text-sm font-mono"
                placeholder="API Key"
              />
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="input-field w-full text-sm font-mono"
                placeholder="API Secret"
              />
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="animate-spin" /> : <Save />}
                SAVE KEYS
              </button>
            </form>
          </div>

          {/* Module 3: Danger Zone */}
          <div className="stat-card bg-red-500/[0.03] border-red-500/20 h-full relative overflow-visible">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-extrabold text-red-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> DANGER ZONE
              </h3>
            </div>
            <p className="text-xs text-muted-foreground italic mb-4">
              Restores $100,000 USDT balance and deletes all simulation history.
            </p>

            {!pendingReset ? (
              <button
                onClick={() => setPendingReset(true)}
                disabled={resetting}
                className="w-full bg-red-500 hover:bg-red-600 px-6 py-3 rounded-xl font-bold text-xs uppercase transition-all shadow-lg shadow-red-500/10 flex items-center justify-center gap-2"
              >
                {resetting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : null}
                {resetting ? "Resetting..." : "Reset Simulator"}
              </button>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">
                    TÜM VERİLER SİLİNECEK. EMİN MİSİNİZ?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg"
                    >
                      SIFIRLA ✓
                    </button>
                    <button
                      onClick={() => setPendingReset(false)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-[10px] font-black uppercase transition-all border border-white/10"
                    >
                      İPTAL ✕
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Admin Modules */}
          {(user?.is_admin || user?.id === 1) && (
            <>
              {/* User List Management - Fits in 1 col */}
              <div className="stat-card border-primary/10 h-full">
                <h3 className="text-sm font-black mb-6 uppercase tracking-widest text-primary/70">
                  Intelligence Units
                </h3>
                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/[0.04] transition-all"
                    >
                      <div>
                        <p className="font-bold text-xs tracking-tight">
                          {u.username.toUpperCase()}
                        </p>
                        <p className="text-[9px] text-muted-foreground font-mono">
                          {u.email}
                        </p>
                      </div>
                      {u.id !== 1 && !u.is_admin && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-[9px] font-black text-red-500/50 hover:text-red-500 transition-colors uppercase"
                        >
                          KILL
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}
        </div>
      </main>
    </HorizonLayout>
  );
}
