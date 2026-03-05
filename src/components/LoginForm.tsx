"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import {
  Cpu,
  Mail,
  Lock,
  User,
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Terminal,
  Globe,
} from "lucide-react";

const LoginForm: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const { login, register } = useAuth();

  // Simulation logs effect
  useEffect(() => {
    if (loading) {
      const messages = [
        "> INITIALIZING ENCRYPTION PROTOCOLS...",
        "> CONNECTING TO MEXC SECURE GATEWAY...",
        "> VERIFYING NEURAL HANDSHAKE...",
        "> BYPASSING REGIONAL FIREWALLS...",
        "> ACCESSING CORE DATABANK...",
      ];
      let i = 0;
      const interval = setInterval(() => {
        if (i < messages.length) {
          setLogs((prev) => [...prev, messages[i]]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 800);
      return () => clearInterval(interval);
    } else {
      setLogs([]);
    }
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      let success = false;

      if (isLogin) {
        success = await login(email, password);
      } else {
        success = await register(username, email, password);
      }

      if (success) {
        router.push("/");
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "AUTH_FAILURE: ACCESS DENIED";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center cyber-bg relative px-4 bg-black overflow-hidden">
      {/* High-Tech Background Elements */}
      <div className="holo-grid" />
      <div className="scanline" />

      {/* Animated Decos */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse delay-700" />

      <div className="max-w-[440px] w-full relative group">
        {/* Corner Accents */}
        <div className="absolute -top-2 -left-2 w-10 h-10 border-t-2 border-l-2 border-cyan-500 z-20 group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-2 border-r-2 border-cyan-500 z-20 group-hover:scale-110 transition-transform duration-500" />

        <div className="cyber-border p-8 lg:p-10 relative overflow-hidden backdrop-blur-2xl">
          {/* Interior Scanline Texture */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-20" />

          <div className="flex flex-col items-center mb-8 relative text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full scale-150 animate-pulse" />
              <div className="bg-black/50 border border-cyan-500/50 p-5 rounded-2xl relative shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <Cpu className="w-10 h-10 text-cyan-400" />
              </div>
              <div className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500"></span>
              </div>
            </div>

            <h1 className="text-3xl font-black tech-font tracking-[0.2em] text-white cyber-glow-text uppercase">
              MEXC<span className="text-cyan-500">_ULTIMATE</span>
            </h1>
            <div className="cyber-accent-line w-full mt-4" />
            <p className="text-[10px] tech-font text-cyan-500/60 mt-3 uppercase tracking-widest">
              {isLogin
                ? "Secure Terminal Authorization Required"
                : "Initialize New Neural Uplink"}
            </p>
          </div>

          <form className="space-y-6 relative" onSubmit={handleSubmit}>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                  <Terminal className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-cyan-400 animate-pulse" />
                </div>
                <div className="w-full bg-black/40 p-4 border border-cyan-500/20 tech-font h-32 overflow-hidden flex flex-col-reverse items-start text-left">
                  {logs
                    .slice()
                    .reverse()
                    .map((log, idx) => (
                      <div
                        key={idx}
                        className={`text-[10px] ${idx === 0 ? "text-cyan-400" : "text-cyan-900"} leading-relaxed`}
                      >
                        {log}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <>
                {!isLogin && (
                  <div className="space-y-2">
                    <label className="text-[10px] tech-font font-bold text-cyan-500/70 ml-1 uppercase tracking-wider block text-left">
                      Ident_Username
                    </label>
                    <div className="relative group/field">
                      <input
                        type="text"
                        required
                        className="input-field w-full pr-10 bg-black/40 border-cyan-500/20 text-cyan-100 placeholder:text-cyan-900 tech-font text-sm"
                        placeholder="NODE_NAME"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-cyan-500/40 group-focus-within/field:text-cyan-400 transition-colors">
                        <User className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] tech-font font-bold text-cyan-500/70 ml-1 uppercase tracking-wider block text-left">
                    Auth_Email
                  </label>
                  <div className="relative group/field">
                    <input
                      type="email"
                      required
                      className="input-field w-full pr-10 bg-black/40 border-cyan-500/20 text-cyan-100 placeholder:text-cyan-900 tech-font text-sm"
                      placeholder="USER@NETWORK.INT"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-cyan-500/40 group-focus-within/field:text-cyan-400 transition-colors">
                      <Mail className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] tech-font font-bold text-cyan-500/70 ml-1 uppercase tracking-wider block text-left">
                    Secure_Key
                  </label>
                  <div className="relative group/field">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className="input-field w-full pr-16 bg-black/40 border-cyan-500/20 text-cyan-100 placeholder:text-cyan-900 tech-font text-sm"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-8 flex items-center pointer-events-none text-cyan-500/40 group-focus-within/field:text-cyan-400 transition-colors">
                      <Lock className="h-4 w-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-cyan-500/40 hover:text-cyan-400 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] tech-font font-bold uppercase tracking-tighter animate-pulse text-left">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full h-12 bg-cyan-600 disabled:opacity-50 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-cyan-400 transition-transform group-hover:translate-x-full duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-600 -translate-x-full transition-transform group-hover:translate-x-0 duration-500" />
                  <div className="relative flex items-center justify-center gap-2 text-black font-black tech-font text-sm uppercase tracking-widest">
                    <span>{isLogin ? "EXECUTE_AUTH" : "INIT_SEQUENCE"}</span>
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 px-3" />
                </button>
              </>
            )}

            <div className="pt-4 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-[10px] tech-font text-cyan-500/60 hover:text-cyan-400 transition-colors uppercase tracking-widest border-b border-cyan-500/20 hover:border-cyan-400 pb-1"
              >
                {isLogin ? "// REG_NEW_ENTITY" : "// RETURN_TO_AUTH"}
              </button>

              <div className="flex items-center gap-3 opacity-20 group-hover:opacity-40 transition-opacity">
                <Globe className="w-3 h-3 text-cyan-500" />
                <div className="w-32 h-[1px] bg-cyan-900" />
                <ShieldCheck className="w-3 h-3 text-cyan-500" />
              </div>
            </div>
          </form>
        </div>

        <div className="mt-6 flex justify-between items-center px-2 tech-font text-[9px] text-cyan-900 uppercase font-bold tracking-[0.3em]">
          <span>SYS_v2.0.26</span>
          <span className="flex items-center gap-2">
            <span className="w-1 h-1 bg-cyan-500 rounded-full animate-ping" />
            TERMINAL_ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
