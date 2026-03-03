"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { HorizonLayout } from '@/components/matrix-horizon/HorizonLayout';
import { Header } from '@/components/Header';
import { HologramCard } from '@/components/HologramCard';
import { cn } from '@/lib/utils';
import { 
    Terminal, 
    Shield, 
    Zap, 
    Globe, 
    Layout, 
    BarChart3, 
    ArrowLeft,
    Activity,
    RefreshCw,
    Target,
    TrendingUp
} from 'lucide-react';
import { MatrixLogo } from '@/components/MatrixLogo';

import { LucideIcon } from 'lucide-react';

interface GuideSection {
    id: string;
    title: string;
    icon: LucideIcon;
    visualType?: 'overview' | 'architecture' | 'trailing' | 'engine' | 'settings' | 'defense' | 'strategy' | 'routine' | 'whale' | 'regime' | 'smc' | 'radar' | 'killswitch' | 'decay' | 'bayesian' | 'bridge' | 'trailing_buy' | 'trailing_sell' | 'ai_score' | 'stop_loss' | 'breakeven' | 'wick_protection' | 'panic' | 'test_mode' | 'ob' | 'volatility' | 'zscore' | 'capital' | 'fvg' | 'alarms' | 'scalp' | 'swing' | 'performance' | 'limit' | 'market' | 'split_tp' | 'timeout' | 'tech_panel' | 'decision' | 'simulator';
    image?: string;
    content: string;
}

const GuidePageContent = () => {
    const router = useRouter();
    
    const guideSections: GuideSection[] = useMemo(() => [
        {
            id: 'easy-overview',
            title: 'Matrix Nedir?',
            icon: Globe,
            image: '/assets/docs/matrix_nedir.png',
            content: `Matrix, sizin yerinize piyasayı 24 saat izleyen dijital bir yardımcıdır. Karmaşık grafikleri basitleştirir ve size ne zaman alıp satmanız gerektiğini söyler.`
        },
        {
            id: 'easy-architecture',
            title: 'Sistem Katmanları',
            icon: Layout,
            image: '/assets/docs/sistem_katmanlari.png',
            content: `Sistem arkada bir çok farklı katman ile çalışır. Balinaları izleyen motor, piyasa havası ve AI karar mekanizması gibi parçalar birleşerek en doğru sonucu üretir.`
        },
        {
            id: 'easy-trailing-buy',
            title: 'Düştükçe Al (Trailing Buy)',
            icon: Zap,
            image: '/assets/docs/trailing_buy_new.png',
            content: `Fiyat düşerken hemen almaz, düşüşü takip eder. Fiyat en dipten yukarı dönmeye başladığında alım yapar. Böylece her zaman en ucuzdan almayı hedefler.`
        },
        {
            id: 'easy-trailing-sell',
            title: 'Yüksekten Sat (Trailing Sell)',
            icon: TrendingUp,
            image: '/assets/docs/trailing_sell_new.png',
            content: `Kâr hedefinize ulaşıldığında hemen satmaz, fiyatın daha da yükselmesini bekler. Fiyat zirveden aşağı dönmeye başladığında satış yaparak kârınızı maksimize eder.`
        },
        {
            id: 'easy-ai-score',
            title: 'İşlem Güven Skoru',
            icon: Shield,
            image: '/assets/docs/ai_score_new.png',
            content: `Her sinyali 0-100 arası puanlar. 65 puan üstü "Yeşil Işık"tır. Teknik bilginiz olmasa bile bu puanı takip ederek güvenli işlemler yapabilirsiniz.`
        },
        {
            id: 'easy-whale',
            title: 'Balina Avcısı',
            icon: Activity,
            image: '/assets/docs/whale_new.png',
            content: `Büyük miktarda para yatıran (Balina) oyuncuların hareketlerini izler. Onlarla birlikte hareket ederek piyasada ezilmenizi engeller.`
        },
        {
            id: 'easy-regime',
            title: 'Piyasa Havası',
            icon: RefreshCw,
            image: '/assets/docs/regime_new.png',
            content: `Piyasanın genel havasını (Güneşli, Bulutlu, Fırtınalı) söyler. Fırtınalı havalarda sizi uyarır ve kaybetmenizi önler.`
        },
        {
            id: 'easy-stop-loss',
            title: 'Zarar Durdur (Trailing SL)',
            icon: Shield,
            image: '/assets/docs/safety.png',
            content: `Fiyat yükseldikçe "Zarar Durdurma" seviyesini de yukarı çeker. Böylece bir kez kâra geçtiğinizde, fiyat düşse bile kârınızın bir kısmını korumuş olursunuz.`
        },
        {
            id: 'easy-breakeven',
            title: 'Girişi Koru (Breakeven)',
            icon: Zap,
            image: '/assets/docs/safety.png',
            content: `İlk kârınızı aldıktan sonra, kalan işleminizin riskini sıfıra indirir. Fiyat düşse bile en kötü ihtimalle hiç kayıp yaşamadan işlemden çıkarsınız.`
        },
        {
            id: 'easy-wick-protection',
            title: 'İğne Koruması',
            icon: Target,
            image: '/assets/docs/safety.png',
            content: `Anlık ve geçici fiyat düşüşlerinde (iğne atma) panikleyip işlemin hemen kapanmasını engeller. Fiyatın kalıcı olarak düştüğünden emin olup öyle karar verir.`
        },
        {
            id: 'easy-panic',
            title: 'Panik Butonu',
            icon: Zap,
            image: '/assets/docs/safety.png',
            content: `Kötü bir durum olduğunda tek tuşla tüm işlemlerinizi kapatıp paranızı güvenli liman olan dolara (USDT) çevirir.`
        },
        {
            id: 'easy-killswitch',
            title: 'Sistem Durdurucu',
            icon: Terminal,
            image: '/assets/docs/safety.png',
            content: `Üst üste birkaç işlem kaybederseniz veya çok fazla işlem yaparsanız sistem sizi korumak için kendini kilitler. "Bugünlük yeter, yarın devam edelim" der.`
        },
        {
            id: 'easy-radar',
            title: 'Para Takibi (BTC Radar)',
            icon: Target,
            image: '/assets/docs/overview.png',
            content: `Paranın Bitcoin'e mi yoksa Altcoinlere mi aktığını izler. Yatırımınızı hangi yöne yapmanız gerektiği konusunda size ipucu verir.`
        },
        {
            id: 'easy-decay',
            title: 'Taze Sinyaller',
            icon: RefreshCw,
            image: '/assets/docs/overview.png',
            content: `Eski ve bayatlamış sinyallerle işlem yapmanızı engeller. Her zaman taze ve güncel fırsatları önünüze getirir.`
        },
        {
            id: 'easy-bayesian',
            title: 'Olasılık Takibi',
            icon: BarChart3,
            image: '/assets/docs/ai_score_new.png',
            content: `Sistemin geçmiş verilerine bakarak o anki işlemin tutma olasılığını hesaplar. Size "bu işlemin başarı ihtimali yüksek" veya "riskli" şeklinde bilgi verir.`
        },
        {
            id: 'easy-bridge',
            title: 'Köprü Kurulumu',
            icon: Layout,
            image: '/assets/docs/overview.png',
            content: `Sistemin kesintisiz çalışması için tarayıcınıza kurduğunuz küçük bir yardımcıdır. Teknik verilerin anlık ve hızlı gelmesini sağlar.`
        },
        {
            id: 'easy-test-mode',
            title: 'Sanal Para (Test Modu)',
            icon: Terminal,
            image: '/assets/docs/overview.png',
            content: `Kendi paranızı riske atmadan önce sistem size 100.000$ sanal para verir. Burada antrenman yapıp kendinize güvendiğinizde gerçek paraya geçebilirsiniz.`
        },
        {
            id: 'easy-smc',
            title: 'Piyasa İskeleti (SMC)',
            icon: Layout,
            image: '/assets/docs/smc_new.png',
            content: `Fiyatın hangi yöne kırıldığını (yukarı mı aşağı mı) otomatik tespit eder. Bir binanın iskeleti gibi, piyasanın sağlam basıp basmadığını gösterir.`
        },
        {
            id: 'easy-ob',
            title: 'Kurumsal Seviyeler',
            icon: Target,
            image: '/assets/docs/whale_new.png',
            content: `Bankaların ve büyük borsaların alım emri beklettiği bölgeleri boyayarak gösterir. Fiyat bu bölgelere geldiğinde genellikle tepki verir.`
        },
        {
            id: 'easy-volatility',
            title: 'Piyasa Hızı',
            icon: Activity,
            image: '/assets/docs/regime_new.png',
            content: `Piyasa şu an çok mu hızlı (patlamaya hazır) yoksa çok mu yavaş (uykuda) olduğunu söyler. Doğru zamanda işlemde olmanızı sağlar.`
        },
        {
            id: 'easy-zscore',
            title: 'Lastik Etkisi (Z-Score)',
            icon: RefreshCw,
            image: '/assets/docs/overview.png',
            content: `Fiyatın ortlamadan çok fazla uzaklaşıp uzaklaşmadığını ölçer. Fazla çekilmiş bir lastik gibi, fiyatın ne zaman geri döneceğini tahmin etmenize yardım eder.`
        },
        {
            id: 'easy-capital',
            title: 'Para Akışı',
            icon: Target,
            image: '/assets/docs/growth.png',
            content: `Paranın hangi altcoin gruplarına aktığını izler. Hangi trendlerin yükselişte olduğunu erkenden fark etmenizi sağlar.`
        },
        {
            id: 'easy-fvg',
            title: 'Fiyat Boşlukları (FVG)',
            icon: Zap,
            image: '/assets/docs/overview.png',
            content: `Fiyatın çok hızlı hareket edip arkasında bıraktığı boşluklardır. Fiyat genellikle bu boşlukları doldurmak için geri döner. Bir nevi "mıknatıs" görevi görürler.`
        },
        {
            id: 'easy-alarms',
            title: 'Anlık Bildirimler',
            icon: Activity,
            image: '/assets/docs/safety.png',
            content: `Ekran başında olmanıza gerek yok. Önemli bir hareket olduğunda sistem cebinize veya bilgisayarınıza anında haber uçurur.`
        },
        {
            id: 'easy-scalp',
            title: 'Hızlı Kazanç (Scalp)',
            icon: Zap,
            image: '/assets/docs/trailing_buy_new.png',
            content: `Çok kısa süreli, dakikalık grafiklerde yapılan hızlı al-sat işlemleridir. Küçük ama sık kârlar kovalamayı sevenler içindir.`
        },
        {
            id: 'easy-swing',
            title: 'Büyük Dalga (Swing)',
            icon: TrendingUp,
            image: '/assets/docs/trailing_sell_new.png',
            content: `Günlerce veya haftalarca süren büyük trendleri yakalamayı hedefler. Daha az işlem yapıp, daha büyük hareketleri bekleyenler için idealdir.`
        },
        {
            id: 'easy-performance',
            title: 'Başarı Takibi',
            icon: BarChart3,
            image: '/assets/docs/growth.png',
            content: `Sistem her 4 saatte bir kasanızın fotoğrafını çeker. Hangi günler kâr, hangi günler zarar ettiğinizi bir karne gibi önünüze koyar.`
        },
        {
            id: 'easy-limit',
            title: 'Sıraya Gir (Limit)',
            icon: Layout,
            image: '/assets/docs/smc_new.png',
            content: `İstediğiniz fiyata alış veya satış emri bırakmanızı sağlar. Market fiyatı oraya gelene kadar sabırla bekler.`
        },
        {
            id: 'easy-market',
            title: 'Hemen Al (Market)',
            icon: Zap,
            image: '/assets/docs/smc_new.png',
            content: `Fiyatı beklemeden, o an piyasada en iyi ne fiyat varsa oradan alım veya satım yapar. Hızın önemli olduğu anlar içindir.`
        },
        {
            id: 'easy-split-tp',
            title: 'Parça Parça Kazanç',
            icon: BarChart3,
            image: '/assets/docs/trailing_sell_new.png',
            content: `Tüm malınızı tek bir fiyatta satmak yerine, fiyat yükseldikçe kademeli olarak satmanızı sağlar. Kârınızı garanti altına alır.`
        },
        {
            id: 'easy-timeout',
            title: 'Tuzak Koruması (Timeout)',
            icon: Shield,
            image: '/assets/docs/safety.png',
            content: `Fiyat anlık olarak "Zarar Durdur" seviyenize değip hemen geri çıkarsa, sistem sizi hemen oyundan atmaz. Birkaç saniye bekler ve bunun bir tuzak olup olmadığını anlar.`
        },
        {
            id: 'easy-tech-panel',
            title: 'Durum Özeti',
            icon: Terminal,
            image: '/assets/docs/regime_new.png',
            content: `Ekranın bir köşesinde piyasanın o anki fotoğrafını çeker. Trend ne yönde, güç ne durumda hepsini bir bakışta görürsünüz.`
        },
        {
            id: 'easy-decision',
            title: 'Sistemin Son Sözü',
            icon: Target,
            image: '/assets/docs/ai_score_new.png',
            content: `Onlarca karmaşık hesaplamadan sonra sistem size tek bir kelime söyler: "İŞLEM AÇ" veya "BEKLE". Size sadece uymak kalır.`
        },
        {
            id: 'easy-simulator',
            title: 'Eğitim Simülatörü',
            icon: Terminal,
            image: '/assets/docs/overview.png',
            content: `Geçmişte piyasa nasıl hareket etmiş, sistem orada ne yapmış görebilirsiniz. Kendi stratejinizi geliştirmek için harika bir antrenman sahasıdır.`
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
                            <span className="text-cyan-400 text-[10px] font-black tracking-[0.4em] uppercase">User Manual v4.0</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white uppercase leading-none">
                            User <span className="text-transparent border-t-text-white stroke-white" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>Manual</span><br />Center
                        </h1>
                        <p className="mt-6 text-slate-400 max-w-2xl text-lg leading-relaxed font-medium">
                            Matrix terminalin tüm teknik yeteneklerini ve operasyonel akışını keşfedin. 
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {guideSections.map((section: GuideSection, idx: number) => (
                            <HologramCard 
                                key={section.id}
                                title={section.title}
                                content={section.content}
                                icon={section.icon}
                                visualType={section.visualType}
                                image={section.image}
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
