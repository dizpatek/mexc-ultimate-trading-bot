import { 
    Globe, 
    Layout, 
    Zap, 
    TrendingUp, 
    Shield, 
    Activity, 
    RefreshCw, 
    Target, 
    Terminal, 
    BarChart3,
    LucideIcon
} from 'lucide-react';

export interface GuideSection {
    id: string;
    title: string;
    icon: LucideIcon;
    image?: string;
    content: string;
}

export const GUIDE_SECTIONS: GuideSection[] = [
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
        image: '/assets/docs/guide_safety.png',
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
        image: '/assets/docs/guide_safety.png',
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
        image: '/assets/docs/guide_radar.png',
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
        image: '/assets/docs/guide_ai.png',
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
        image: '/assets/docs/regime_new.png',
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
        image: '/assets/docs/guide_market.png',
        content: `Piyasa şu an çok mu hızlı (patlamaya hazır) yoksa çok mu yavaş (uykuda) olduğunu söyler. Doğru zamanda işlemde olmanızı sağlar.`
    },
    {
        id: 'easy-zscore',
        title: 'Lastik Etkisi (Z-Score)',
        icon: RefreshCw,
        image: '/assets/docs/guide_market.png',
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
        image: '/assets/docs/guide_strategy.png',
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
        image: '/assets/docs/guide_strategy.png',
        content: `Çok kısa süreli, dakikalık grafiklerde yapılan hızlı al-sat işlemleridir. Küçük ama sık kârlar kovalamayı sevenler içindir.`
    },
    {
        id: 'easy-swing',
        title: 'Büyük Dalga (Swing)',
        icon: TrendingUp,
        image: '/assets/docs/guide_strategy.png',
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
        image: '/assets/docs/guide_strategy.png',
        content: `Fiyatı beklemeden, o an piyasada en iyi ne fiyat varsa oradan alım veya satım yapar. Hızın önemli olduğu anlar içindir.`
    },
    {
        id: 'easy-split-tp',
        title: 'Parça Parça Kazanç',
        icon: BarChart3,
        image: '/assets/docs/growth.png',
        content: `Tüm malınızı tek bir fiyatta satmak yerine, fiyat yükseldikçe kademeli olarak satmanızı sağlar. Kârınızı garanti altına alır.`
    },
    {
        id: 'easy-timeout',
        title: 'Tuzak Koruması (Timeout)',
        icon: Shield,
        image: '/assets/docs/guide_safety.png',
        content: `Fiyat anlık olarak "Zarar Durdur" seviyenize değip hemen geri çıkarsa, sistem sizi hemen oyundan atmaz. Birkaç saniye bekler ve bunun bir tuzak olup olmadığını anlar.`
    },
    {
        id: 'easy-tech-panel',
        title: 'Durum Özeti',
        icon: Terminal,
        image: '/assets/docs/guide_market.png',
        content: `Ekranın bir köşesinde piyasanın o anki fotoğrafını çeker. Trend ne yönde, güç ne durumda hepsini bir bakışta görürsünüz.`
    },
    {
        id: 'easy-decision',
        title: 'Sistemin Son Sözü',
        icon: Target,
        image: '/assets/docs/guide_ai.png',
        content: `Onlarca karmaşık hesaplamadan sonra sistem size tek bir kelime söyler: "İŞLEM AÇ" veya "BEKLE". Size sadece uymak kalır.`
    },
    {
        id: 'easy-simulator',
        title: 'Eğitim Simülatörü',
        icon: Terminal,
        image: '/assets/docs/overview.png',
        content: `Geçmişte piyasa nasıl hareket etmiş, sistem orada ne yapmış görebilirsiniz. Kendi stratejinizi geliştirmek için harika bir antrenman sahasıdır.`
    }
];
