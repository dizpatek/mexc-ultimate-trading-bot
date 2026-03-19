"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { HorizonLayout } from "@/components/matrix-horizon/HorizonLayout";
import { Header } from "@/components/Header";
import { HologramCard } from "@/components/HologramCard";
import { GUIDE_SECTIONS, type GuideSection } from "@/config/guide-data";
import { ArrowLeft, Shield, Terminal, Search } from "lucide-react";
import { MatrixLogo } from "@/components/MatrixLogo";

const GuidePageContent = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredSections = GUIDE_SECTIONS.filter((section) =>
    section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <HorizonLayout className="bg-[#020617]">
      <Header />

      <main className="flex-1 relative h-full overflow-y-auto no-scrollbar pb-32">
        {/* GLOBAL HUD OVERLAY */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full animate-pulse" />
          <div
            className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full animate-pulse"
            style={{ animationDelay: "2s" }}
          />
        </div>

        <div className="container mx-auto px-6 py-12 max-w-[1400px] relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-[1px] w-12 bg-cyan-500/50" />
                <span className="text-cyan-400 text-[10px] font-black tracking-[0.4em] uppercase">
                  User Manual v5.0
                </span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white uppercase leading-none">
                User{" "}
                <span
                  className="text-transparent border-t-text-white stroke-white"
                  style={{ WebkitTextStroke: "1px rgba(255,255,255,0.3)" }}
                >
                  Manual
                </span>
                <br />
                Center
              </h1>
              <p className="mt-6 text-slate-400 max-w-2xl text-lg leading-relaxed font-medium">
                Matrix terminalin son 2 aydaki tüm teknik yeteneklerini ve Matrix V5 operasyonel akışını
                keşfedin.
              </p>
            </div>

            {/* SEARCH BAR */}
            <div className="relative group w-full md:w-[400px]">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Özellik ara (ör: SMC, F4, Balina...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-medium"
              />
              {searchTerm && (
                <div className="absolute top-full left-0 mt-2 text-[10px] font-black text-cyan-500/50 uppercase tracking-widest pl-2">
                  {filteredSections.length} sonuç bulundu
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 transition-all duration-500">
            {filteredSections.length > 0 ? (
              filteredSections.map((section: GuideSection, idx: number) => (
                <HologramCard
                  key={section.id}
                  title={section.title}
                  content={section.content}
                  icon={section.icon}
                  image={section.image}
                  delay={idx % 15 * 50} // Optimize stagger animation for large lists
                />
              ))
            ) : (
              <div className="col-span-full py-20 text-center border border-dashed border-white/5 rounded-3xl bg-white/5">
                <div className="text-slate-500 text-lg font-bold italic uppercase tracking-widest">
                  Aradığınız özellik bulunamadı
                </div>
              </div>
            )}
          </div>

          {/* FUTURISTIC RETURN BUTTON */}
          <div className="mt-24 flex items-center justify-center">
            <button
              onClick={() => router.push("/")}
              className="group relative px-12 py-5 overflow-hidden rounded-2xl transition-all duration-500 hover:scale-105"
            >
              {/* Animated Background */}
              <div className="absolute inset-0 bg-slate-900 border border-white/10 group-hover:border-cyan-500/50 transition-colors" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-cyan-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative flex items-center gap-4">
                <div className="p-2 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                  <ArrowLeft className="w-5 h-5 text-cyan-400 group-hover:-translate-x-1 transition-transform" />
                </div>
                <span className="text-lg font-black italic tracking-wider text-white uppercase">
                  Return to Base
                </span>

                <div className="flex gap-1 ml-4 opacity-30 group-hover:opacity-100 transition-opacity">
                  <div className="w-1 h-3 bg-cyan-500 animate-scan-v" />
                  <div
                    className="w-1 h-3 bg-cyan-500 animate-scan-v"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <div
                    className="w-1 h-3 bg-cyan-500 animate-scan-v"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>

              {/* Scanning Line */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-cyan-500/50 opacity-0 group-hover:opacity-100 animate-sweep" />
              </div>
            </button>
          </div>

          {/* FOOTER METADATA */}
          <div className="mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3 text-cyan-500/50" />
                <span>Encrypted Manual v5.0.1</span>
              </div>
              <div className="flex items-center gap-2">
                <Terminal className="w-3 h-3 text-cyan-500/50" />
                <span>Agent Horizon-V5</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <MatrixLogo size={24} className="opacity-50" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                <span className="text-emerald-500/70">
                  System Neural Link Active
                </span>
              </div>
              <span>© 2026 Matrix Horizon Corp</span>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes sweep {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }

        @keyframes scan-v {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(60px);
            opacity: 0;
          }
        }

        .group:hover .animate-sweep {
          animation: sweep 1.5s infinite linear;
        }

        .group:hover .animate-scan-v {
          animation: scan-v 2s infinite linear;
        }

        @keyframes float-hologram {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .group:hover .hologram-effect {
          animation: float-hologram 3s ease-in-out infinite;
        }
      `}</style>
    </HorizonLayout>
  );
};

export default dynamic(() => Promise.resolve(GuidePageContent), { ssr: false });
