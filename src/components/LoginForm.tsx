"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useGoogleLogin } from "@react-oauth/google";
import axios from "axios";
import {
  Mail,
  Lock,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  Activity,
  Zap,
} from "lucide-react";
import { MatrixLogo } from "./MatrixLogo";

// ============================================================
// MATRIX HORIZON — AUTHENTIC "ENTER THE MATRIX" LOGIN
// ============================================================

/**
 * High-Density Canvas Matrix Rain
 */
const MatrixRainCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    const chars = "アカサタナハマヤラワガザダバパイキシチニヒミリヰギジヂビプウクスツヌフムユルグズヅブペエケセテネヘメレヱゲゼデベポオコソトノホモヨROヲ";
    const charArr = chars.split("");

    const baseFontSize = 14;
    const columns = Math.ceil(canvas.width / 14); 
    const colors = ["#0F0", "#F00", "#00F"]; 

    const drops: { y: number; z: number; colorIdx: number }[] = [];
    for (let x = 0; x < columns; x++) {
      drops[x] = {
        y: Math.random() * -100,
        z: 0.5 + Math.random() * 1.5,
        colorIdx: Math.floor(Math.random() * colors.length)
      };
    }

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i];
        const fontSize = Math.floor(baseFontSize * drop.z);
        const speed = drop.z * 0.8;
        const color = colors[drop.colorIdx];
        
        ctx.font = `bold ${fontSize}px font-mono`;
        const char = charArr[Math.floor(Math.random() * charArr.length)];
        
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, drop.z / 1.5)})`;
        ctx.fillText(char, i * 14, drop.y * fontSize);

        ctx.fillStyle = color;
        if (drop.z > 1.2) {
          ctx.shadowBlur = 10 * (drop.z - 1);
          ctx.shadowColor = color;
        } else {
          ctx.shadowBlur = 0;
        }
        
        const opacity = Math.min(0.8, drop.z / 2);
        ctx.fillStyle = color.replace("#", "rgba(").replace("0F0", "0, 255, 0, ").replace("F00", "255, 0, 0, ").replace("00F", "0, 0, 255, ") + opacity + ")";
        
        ctx.fillText(char, i * 14, (drop.y - 1) * fontSize);
        ctx.shadowBlur = 0;

        if (drop.y * fontSize > canvas.height && Math.random() > 0.98) {
          drop.y = 0;
          drop.z = 0.5 + Math.random() * 1.5;
          drop.colorIdx = Math.floor(Math.random() * colors.length);
        }
        drop.y += speed;
      }
    };

    const interval = setInterval(draw, 33);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-black" />;
};

const StatusPanel: React.FC = () => {
  return (
    <div className="mt-8 bg-transparent border-t border-emerald-500/30 pt-4 backdrop-blur-md">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-500/80">
        <div className="flex justify-between items-center">
          <span>System Status</span>
          <span className="text-white font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#0F0]" />
            ONLINE
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Sync Rate</span>
          <span className="text-white font-bold">99.8%</span>
        </div>
      </div>
    </div>
  );
};

const LoginForm: React.FC = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [glitch, setGlitch] = useState(false);
  const [code, setCode] = useState("");

  const { login, register, googleLogin } = useAuth();
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-500, 500], [15, -15]);
  const rotateY = useTransform(x, [-500, 500], [-15, 15]);
  
  const springConfig = { damping: 20, stiffness: 150 };
  const springX = useSpring(rotateX, springConfig);
  const springY = useSpring(rotateY, springConfig);

  const handleMouseMove = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(event.clientX - centerX);
    y.set(event.clientY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    setCode(Math.random().toString(16).substr(2, 8).toUpperCase());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.95) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 150);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (loading) {
      const messages = [
        "> PENETRATING FIREWALL...",
        "> HIJACKING SESSION TOKEN...",
        "> DECRYPTING RSA_H4SH...",
        "> ACCESSING THE SOURCE...",
        "> WELCOME TO THE MATRIX.",
      ];
      let i = 0;
      const interval = setInterval(() => {
        if (i < messages.length) {
          setLogs((prev) => [...prev, messages[i]]);
          i++;
        } else {
          clearInterval(interval);
        }
      }, 700);
      return () => clearInterval(interval);
    } else {
      setLogs([]);
    }
  }, [loading]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) {
      setError("PAROLA SIFIRLAMA TALEBI GONDERILDI (MOCK)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      let success = isLogin ? await login(email, password) : await register(username, email, password);
      if (success) router.push("/");
    } catch (err: any) {
      setError(err?.message || "ACCESS_DENIED: AUTHENTICATION_FAILED");
    } finally {
      setLoading(false);
    }
  }, [isLogin, email, password, username, login, register, router, isForgotPassword]);

  // Google Login Hook
  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
        });
        const { sub, email: gEmail, name, picture } = res.data;
        const success = await googleLogin({
          googleId: sub,
          email: gEmail,
          name: name,
          picture: picture
        });
        if (success) {
          router.push("/");
        }
      } catch (err) {
        console.error("Google login failure:", err);
        setError("GOOGLE_AUTH: CONNECTION_FAILED");
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError("GOOGLE_AUTH: ACCESS_DENIED");
    }
  });

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative p-4 overflow-hidden select-none perspective-1000"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <MatrixRainCanvas />
      <div className="absolute inset-0 pointer-events-none z-10 opacity-20 animate-scanline-fast" 
           style={{ background: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)", backgroundSize: "100% 4px" }} />

      <motion.div 
        style={{ rotateX: springX, rotateY: springY, transformStyle: "preserve-3d" }}
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className={`max-w-[380px] w-full relative z-20 group transition-transform ${glitch ? 'translate-x-[4px] skew-y-1' : ''}`}
      >
        <div className="relative bg-black/20 border border-emerald-500/30 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-2xl">
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-500/50" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-red-500/50" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-blue-500/50" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/20" />

          <div className="flex flex-col items-center mb-6" style={{ transform: "translateZ(60px)" }}>
            <div className="relative mb-4 group/logo" style={{ transformStyle: "preserve-3d" }}>
              {/* 3D Base Reflection / Shadow */}
              <div 
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-emerald-500/20 blur-md rounded-full" 
                style={{ transform: "translateZ(-20px) rotateX(90deg)" }}
              />
              
              <div className="absolute -inset-4 bg-emerald-500 blur-3xl opacity-10 group-hover/logo:opacity-20 transition-opacity animate-pulse" />
              
              {/* Primary 3D Container */}
              <motion.div 
                className="relative bg-slate-900/80 border border-slate-700/50 p-3 rounded-2xl group-hover:border-emerald-500/50 transition-colors shadow-[0_0_30px_rgba(16,185,129,0.1)] backdrop-blur-md"
                style={{ transform: "translateZ(30px)" }}
                animate={{ 
                  y: [0, -4, 0],
                  rotateY: [0, 5, 0, -5, 0],
                  rotateX: [0, -5, 0, 5, 0]
                }}
                transition={{ 
                  duration: 6, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
              >
                <div style={{ transform: "translateZ(20px)" }}>
                  <MatrixLogo size={36} />
                </div>
              </motion.div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl matrix-font tracking-[0.1em] text-white uppercase leading-tight">
                ENTER THE<br/>MATRIX
              </h1>
              <div className="h-[2px] w-full bg-gradient-to-r from-red-500 via-emerald-500 to-blue-500 mt-2 shadow-[0_0_10px_#0F0]" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" style={{ transform: "translateZ(30px)" }}>
            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-6">
                <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-400 rounded-full animate-spin shadow-[0_0_20px_#0F0]" />
                <div className="w-full bg-black/40 border border-emerald-500/20 p-4 font-mono h-32 overflow-hidden flex flex-col-reverse text-[11px] leading-relaxed text-emerald-600">
                  {logs.slice().reverse().map((log, i) => (
                    <div key={i} className={i === 0 ? "text-white animate-pulse" : ""}>{log}</div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {!isLogin && !isForgotPassword && (
                  <div className="space-y-1 group">
                    <label className="text-[10px] font-bold text-emerald-500 ml-1 uppercase tracking-widest block">Kullanıcı Adı</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-3 bg-black/30 border-2 border-white/5 text-white font-mono text-sm focus:outline-none focus:border-red-500/50 transition-all"
                        placeholder="NEO"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-900 group-focus-within:text-emerald-400" />
                    </div>
                  </div>
                )}

                <div className="space-y-1 group">
                  <label className="text-[10px] font-bold text-emerald-500 ml-1 uppercase tracking-widest block">Kullanıcı Mail</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 bg-black border-2 border-white/5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                      placeholder="MAIL@MATRIX.COM"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-900 group-focus-within:text-emerald-400" />
                  </div>
                </div>

                {!isForgotPassword && (
                  <div className="space-y-1 group">
                    <label className="text-[10px] font-bold text-emerald-500 ml-1 uppercase tracking-widest block">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        className="w-full px-4 py-3 bg-black border-2 border-white/5 text-white font-mono text-sm focus:outline-none focus:border-blue-500/50 transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-900 hover:text-emerald-400"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-950/30 border border-red-500/50 text-white text-[10px] font-mono font-bold uppercase tracking-widest animate-shake">
                    <div className="flex items-center gap-2">
                       <AlertCircle className="w-4 h-4 text-red-400" />
                       {error}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-[0.4em] relative overflow-hidden group/btn disabled:opacity-50 transition-all shadow-[0_0_30px_#F00]"
                >
                  <div className="absolute inset-0 bg-white/10 translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500" />
                  <div className="relative flex items-center justify-center gap-3">
                    <Zap className="w-4 h-4 fill-current" />
                    {isForgotPassword ? "SIFREMI SIFIRLA" : (isLogin ? ".:ENTER:." : "REGISTER_SIGNAL")}
                  </div>
                </button>

                {isLogin && !isForgotPassword && (
                  <button
                    type="button"
                    onClick={() => triggerGoogleLogin()}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-[0.4em] relative overflow-hidden group/google transition-all shadow-[0_0_30px_#00F]"
                  >
                    <div className="absolute inset-0 bg-white/10 translate-x-full group-hover/google:translate-x-0 transition-transform duration-500" />
                    <div className="relative flex items-center justify-center gap-3">
                      <div className="w-5 h-5 bg-white p-1 rounded-sm flex items-center justify-center group-hover/google:scale-110 transition-transform">
                        <svg viewBox="0 0 24 24" className="w-full h-full">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"/>
                        </svg>
                      </div>
                      GOOGLE
                    </div>
                  </button>
                )}
              </>
            )}

            <div className="pt-4 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setIsForgotPassword(false);
                }}
                className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 transition-all uppercase tracking-widest border-b border-emerald-500/20 pb-1"
              >
                {isLogin ? "[ // Yeni Hesap Oluştur ]" : "[ // BACK_TO_AUTH ]"}
              </button>
              
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(!isForgotPassword)}
                  className="text-[10px] font-bold animate-rgb-text transition-all uppercase tracking-widest pb-1"
                >
                  {isForgotPassword ? "[ // LOGIN_SCREEN ]" : "[ // Şifremi Unuttum ]"}
                </button>
              )}
            </div>
          </form>
          <StatusPanel />
        </div>
      </motion.div>

      <div className="absolute bottom-8 left-8 right-8 flex justify-between items-center text-[10px] font-mono text-emerald-900 uppercase font-bold tracking-[0.5em] z-20 pointer-events-none">
          <div className="flex items-center gap-3">
             <Activity className="w-4 h-4 animate-pulse" />
             <span>UPLINK_STATUS: SECURE</span>
          </div>
          <span>CODE: {code}</span>
      </div>
    </div>
  );
};

export default LoginForm;
