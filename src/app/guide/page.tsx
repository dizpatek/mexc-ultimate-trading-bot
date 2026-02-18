"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { HorizonLayout } from '@/components/matrix-horizon/HorizonLayout';
import { Header } from '@/components/Header';
import { HologramCard } from '@/components/HologramCard';
import { 
    Terminal, 
    Shield, 
    Zap, 
    Globe, 
    Layout, 
    BarChart3, 
    Settings2,
    ArrowLeft
} from 'lucide-react';
import { MatrixLogo } from '@/components/MatrixLogo';

const GuidePageContent = () => {
    const router = useRouter();
    
    const guideSections = useMemo(() => [
        {
            id: 'overview',
            title: 'Genel Bakış',
            icon: Globe,
            visualType: 'overview' as const,
            content: `Matrix F4 Ultimate V4, TradingView tabanlı sinyal motorunu tam entegre bir web ticaret terminaline dönüştürür. Artık sadece sinyal izlemekle kalmaz, **Trailing Buy**, **Trailing Sell** ve **AI Tabanlı Duyarlılık** analizi ile işlemlerinizi tek bir ekrandan yönetebilirsiniz.`
        },
        {
            id: 'architecture',
            title: 'Yeni Arayüz Mimarisi',
            icon: Layout,
            visualType: 'architecture' as const,
            content: `Terminal, maksimum verimlilik için 3 ana dikey sütuna ayrılmıştır:
- **SOL (Navigasyon):** Ultra-slim (w-16) dikey bar.
- **ORTA (Operasyon):** Ana grafikler ve Matrix Horizon.
- **SAĞ (Kontrol):** Trading paneli ve AI skoru.`
        },
        {
            id: 'trailing',
            title: 'Akıllı Emir Sistemi (Trailing)',
            icon: Zap,
            visualType: 'trailing' as const,
            content: `**Trailing Buy (Düştükçe Al)**: Fiyat düşerken alım emrini takip eder. Geri dönüş sinyalinde alımı yapar.
            
**Trailing Sell (Yükseldikçe Sat)**: Kârı maksimize etmek için fiyatı yukarıdan takip eder. Trend dönünce satışı gerçekleştirir.`
        },
        {
            id: 'engine',
            title: 'Matrix Engine & AI Skoru',
            icon: BarChart3,
            visualType: 'engine' as const,
            content: `Sinyal kalitesi 10 farklı metrikle ölçülür:
- **65+ Puan:** ✅ İŞLEM AÇ
- **40-64 Puan:** ⚠️ DİKKATLİ OL
- **0-39 Puan:** ❌ BEKLE / YASAK`
        },
        {
            id: 'settings',
            title: 'Admin Ayarları',
            icon: Settings2,
            visualType: 'settings' as const,
            content: `Settings sayfasından şu parametreler anlık değiştirilebilir: **F4 Length**, **Whale Multiplier**, **Defense Mode** ve **Simulator Reset**.`
        },
        {
            id: 'defense',
            title: 'Sistem Koruması',
            icon: Shield,
            visualType: 'defense' as const,
            content: `S: Neden "İŞLEM YASAK" diyor?
C: BTC akışı zayıf olabilir veya volatilite çok yüksektir. Sistem sizi her zaman en kötü senaryodan korumayı amaçlar.`
        },
        {
            id: 'strategy',
            title: 'Strateji Rutini',
            icon: Terminal,
            visualType: 'strategy' as const,
            content: `1. **Rejim Kontrolü:** Sağ panelden Piyasa Rejimine bakın.
2. **AI Skor:** Karar vermeden önce AI skorunun 65+ olduğundan emin olun.
3. **Emir Girişi:** Trailing özelliğini aktif ederek giriş yapın.`
        },
        {
            id: 'routine',
            title: 'Hızlı Başlangıç',
            icon: Zap,
            visualType: 'routine' as const,
            content: `Sistemi saniyeler içinde devreye sokun. API anahtarlarınızı girin, simülasyon modunda stratejinizi test edin ve canlı piyasaya tek tuşla bağlanın.`
        }
    ], []);

    return (
        <HorizonLayout className="bg-[#020617]">
            <Header />
            
            <main className="flex-1 relative h-full overflow-y-auto no-scrollbar pb-32">
                {/* GLOBAL HUD OVERLAY */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full animate-pulse" />
                    <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                </div>

                <div className="container mx-auto px-6 py-12 max-w-[1400px] relative z-10">
                    <div className="flex flex-col gap-2 mb-16 animate-in fade-in slide-in-from-top-4 duration-1000">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-[1px] w-12 bg-cyan-500/50" />
                            <span className="text-cyan-400 text-[10px] font-black tracking-[0.4em] uppercase">Matrix Protocol v4.0</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white uppercase leading-none">
                            Visual <span className="text-transparent border-t-text-white stroke-white" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>Operation</span><br />Center
                        </h1>
                        <p className="mt-6 text-slate-400 max-w-2xl text-lg leading-relaxed font-medium">
                            Terminalin tüm teknik yeteneklerini ve operasyonel akışını keşfedin. 
                            Her modül maksimum işlem verimliliği için modernize edildi.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {guideSections.map((section, idx) => (
                            <HologramCard 
                                key={section.id}
                                title={section.title}
                                content={section.content}
                                icon={section.icon}
                                visualType={section.visualType}
                                delay={idx * 100}
                            />
                        ))}
                    </div>

                    {/* FUTURISTIC RETURN BUTTON */}
                    <div className="mt-24 flex items-center justify-center">
                        <button 
                            onClick={() => router.push('/')}
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
                                <span className="text-lg font-black italic tracking-wider text-white uppercase">Return to Base</span>
                                
                                <div className="flex gap-1 ml-4 opacity-30 group-hover:opacity-100 transition-opacity">
                                    <div className="w-1 h-3 bg-cyan-500 animate-scan-v" />
                                    <div className="w-1 h-3 bg-cyan-500 animate-scan-v" style={{ animationDelay: '0.2s' }} />
                                    <div className="w-1 h-3 bg-cyan-500 animate-scan-v" style={{ animationDelay: '0.4s' }} />
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
                                <span>Encrypted Manual</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3 h-3 text-cyan-500/50" />
                                <span>Agent V4.0.2</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <MatrixLogo size={24} className="opacity-50" />
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                                <span className="text-emerald-500/70">System Neural Link Active</span>
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
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }

                @keyframes scan-v {
                    0% { transform: translateY(0); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(60px); opacity: 0; }
                }

                .group:hover .animate-sweep {
                    animation: sweep 1.5s infinite linear;
                }

                .group:hover .animate-scan-v {
                    animation: scan-v 2s infinite linear;
                }
                
                @keyframes float-hologram {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .group:hover .hologram-effect {
                    animation: float-hologram 3s ease-in-out infinite;
                }
            `}</style>
        </HorizonLayout>
    );
};

export default dynamic(() => Promise.resolve(GuidePageContent), { ssr: false });
