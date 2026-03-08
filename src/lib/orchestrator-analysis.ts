import {
  calcRSI,
  calcMACD,
  calcSupertrend,
  calcBB,
  calcADX,
  calcVWAP,
  calcEmaRibbon,
  calcWaveTrend,
  calcZScore,
  calcSlope,
  calcVolumeAnalysis,
  detectSwingTrend,
  calcVixFix,
  calcATR,
} from "./orchestra-indicators";

const TF_UPPER: Record<string, string> = {
  "1m": "1h",
  "5m": "1h",
  "15m": "1h",
  "30m": "4h",
  "1h": "4h",
  "4h": "1d",
  "1d": "1w",
  "1w": "1w",
};

import { getKlines } from "./mexc-wrapper";

export async function fetchKlinesBackendSide(
  symbol: string,
  interval: string,
  limit = 200
) {
  try {
    const klinesList = await getKlines(symbol, interval, limit);
    return klinesList;
  } catch (error) {
    console.error("fetchKlinesBackendSide failed", error);
    return [];
  }
}

export async function fetchBTCDominance() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global", { cache: "no-store"});
    if(!res.ok) throw new Error();
    const d = await res.json();
    const pct = d.data.market_cap_percentage;
    return {
      btc: +(pct.btc || 55).toFixed(2),
      others: +(
        100 -
        (pct.btc || 0) -
        (pct.eth || 0) -
        (pct.bnb || 0) -
        (pct.xrp || 0) -
        (pct.sol || 0)
      ).toFixed(2),
    };
  } catch {
    return { btc: 55, others: 20 };
  }
}

export async function runFullOrchestraAnalysis(symbol: string, tfValue: string, isMeme = false) {
  const htfTF = TF_UPPER[tfValue] || "4h";
  
  // P4.3 PERFORMANCE FIX: Parallelize multi-timeframe fetching
  const [klines, htfKlines, dailyKlines, globalData] = await Promise.all([
     fetchKlinesBackendSide(symbol, tfValue, 200),
     fetchKlinesBackendSide(symbol, htfTF, 60),
     (tfValue !== "1d" && tfValue !== "1w") ? fetchKlinesBackendSide(symbol, "1d", 50) : Promise.resolve([]),
     fetchBTCDominance()
  ]);

  if (klines.length < 10) throw new Error(`Insufficient data for ${symbol}`);

  const opens = klines.map((k: any) => parseFloat(k[1]));
  const highs = klines.map((k: any) => parseFloat(k[2]));
  const lows = klines.map((k: any) => parseFloat(k[3]));
  const closes = klines.map((k: any) => parseFloat(k[4]));
  const vols = klines.map((k: any) => parseFloat(k[5]));

  let htfBull = false,
    dailyBull = false;

  if (htfKlines.length > 0) {
    const htfC = htfKlines.map((k: any) => parseFloat(k[4]));
    htfBull = calcSlope(htfC, 20) > 0;
  }

  if (dailyKlines.length > 0) {
    const dC = dailyKlines.map((k: any) => parseFloat(k[4]));
    dailyBull = calcSlope(dC, 20) > 0;
  } else if (tfValue === "1d" || tfValue === "1w") {
    dailyBull = htfBull;
  }

  const price = closes[closes.length - 1];
  const rsi = calcRSI(closes, 14);
  const rsiPrev = calcRSI(closes.slice(0, -1), 14);
  const macd = calcMACD(closes);
  const atr = calcATR(highs, lows, closes, 14);
  const st = calcSupertrend(highs, lows, closes, 10, 3);
  const bb = calcBB(closes, 20);
  const adx = calcADX(highs, lows, closes, 14);
  const vwap = calcVWAP(highs, lows, closes, vols);
  const ribbon = calcEmaRibbon(closes);
  const wt = calcWaveTrend(highs, lows, closes);
  const zScore = calcZScore(closes, 50);
  const vol = calcVolumeAnalysis(closes, opens, highs, lows, vols);
  const swing = detectSwingTrend(highs, lows, closes);
  const slope = calcSlope(closes, 20);
  const vix = calcVixFix(closes, lows);
  const pctChange =
    ((closes[closes.length - 1] - closes[closes.length - 2]) /
      closes[closes.length - 2]) *
    100;
  const mtfBull = (slope > 0 ? 1 : 0) + (htfBull ? 1 : 0) + (dailyBull ? 1 : 0);

  const data = {
    meta: {
      symbol,
      timeframe: tfValue,
      price: +price.toFixed(4),
      change24h: +pctChange.toFixed(2),
      timestamp: new Date().toLocaleTimeString("tr-TR"),
      higherTF: htfTF,
    },
    trend: {
      swing: swing.text,
      supertrend: st.bullish ? "YUKARI↑" : "AŞAĞI↓",
      supertrendBull: st.bullish,
      slopeDir: slope > 0 ? "YUKARI" : "AŞAĞI",
      htfTrend: `${htfTF} ${htfBull ? "BOĞA" : "AYI"}`,
      dailyMacro: dailyBull ? "BOĞA" : "AYI",
      mtf: `${mtfBull}/3 ${mtfBull >= 2 ? "BOĞA" : mtfBull === 1 ? "KARIŞIK" : "AYI"}`,
    },
    momentum: {
      rsi: +rsi.toFixed(1),
      rsiInterpretation:
        rsi < 30 ? "AŞIRI SATIM → Potansiyel AL fırsatı" : rsi > 70 ? "AŞIRI ALIM → SAT baskısı riski" : rsi > 55 ? "Boğa bölgesi" : rsi < 45 ? "Ayı bölgesi" : "Nötr",
      rsiTrend: rsi > rsiPrev ? "YÜKSELİYOR" : "DÜŞÜYOR",
      macdHist: +macd.hist.toFixed(6),
      macdState:
        macd.hist > 0 && macd.hist > macd.prevHist
          ? "GÜÇLÜ BOĞA"
          : macd.hist > 0
          ? "BOĞA (zayıflıyor)"
          : macd.hist < 0 && macd.hist < macd.prevHist
          ? "GÜÇLÜ AYI"
          : "AYI (zayıflıyor)",
      macdCrossUp: macd.crossUp,
      macdCrossDown: macd.crossDown,
      stochRsi: wt.wt1 > 60 ? "80+(Overbought)" : wt.wt1 < -60 ? "20-(Oversold — fırsat)" : wt.wt1 > 0 ? "50-80 (Boğa)" : "20-50 (Ayı)",
      waveTrend: wt.os ? "DİPTE (AL fırsatı)" : wt.ob ? "TEPEDE (dikkat)" : wt.bull ? "Momentum artıyor" : "Momentum azalıyor",
      wt1: wt.wt1,
      wt2: wt.wt2,
    },
    volatility: {
      atr: +atr.toFixed(4),
      atrPct: +(atr / price * 100).toFixed(2),
      bbSqueeze: bb.squeeze,
      bbInterpretation: bb.squeeze ? "SIKIŞTIRMA → Patlama yakın (yön belirsiz)" : "Normal volatilite",
      zScore: zScore,
      zScoreInterpretation:
        zScore < -2.5 ? "ÇOK UCUZ → reversal fırsatı" : zScore < -1.5 ? "Ucuz bölge" : zScore > 2.5 ? "ÇOK PAHALI → dikkat" : zScore > 1.5 ? "Pahalı bölge" : "Normal fiyat bölgesi",
      vixFix: vix.wvf,
      vixDipSignal: vix.dipSignal,
    },
    volume: {
      volRatio: vol.ratio,
      regime: vol.regime,
      isWhale: vol.isWhale,
      whaleBuy: vol.whaleBuy,
      whaleSell: vol.whaleSell,
      vpaPressure: vol.vpa,
      vpaInterpretation: vol.vpa > 30 ? "GÜÇLÜ ALIM BASKISI → Bullish" : vol.vpa < -30 ? "GÜÇLÜ SATIM BASKISI → Bearish" : "Nötr hacim",
    },
    ema: {
      vwapAbove: price > vwap,
      vwapState: price > vwap ? "FİYAT VWAP ÜSTÜNDE (boğa bağlamı)" : "FİYAT VWAP ALTINDA (ayı bağlamı)",
      ribbonBull: ribbon.bull,
      ribbonBear: ribbon.bear,
      ribbonState: ribbon.bull ? "TAM BOĞA HIZALANMASI (güçlü)" : ribbon.bear ? "TAM AYI HIZALANMASI" : ribbon.e8 > ribbon.e55 ? "Boğa eğilim" : "Ayı eğilim",
      adx: adx.adx,
      adxTrending: adx.adx > 25,
      adxState: adx.adx < 20 ? "YATAY PİYASA (sinyal zayıf)" : adx.adx < 25 ? "Trend oluşuyor" : adx.diP > adx.diM ? "GÜÇLÜ YUKARI TREND" : "GÜÇLÜ AŞAĞI TREND",
    },
    market: {
      btcDominance: globalData.btc,
      othersDominance: globalData.others,
      btcDomContext: globalData.btc > 57 ? "Yüksek BTC baskınlığı (bitcoin sezonu, altcoin riskli)" : globalData.btc < 48 ? "Düşük BTC dom (altcoin sezonu)" : "Nötr",
    },
  };

  return { data, isMeme };
}

const TF_PARAMS: Record<string, any> = {
  "1m": { slPct: 0.3, tpR: "1:1.5", style: "ultra scalp", noise: "ÇOK YÜKSEK" },
  "5m": { slPct: 0.5, tpR: "1:2", style: "scalp", noise: "YÜKSEK" },
  "15m": { slPct: 0.8, tpR: "1:2.5", style: "scalp", noise: "ORTA-YÜKSEK" },
  "30m": { slPct: 1.2, tpR: "1:2.5", style: "intraday", noise: "ORTA" },
  "1h": { slPct: 1.5, tpR: "1:3", style: "intraday", noise: "DÜŞÜK" },
  "4h": { slPct: 2.5, tpR: "1:3.5", style: "swing", noise: "ÇOK DÜŞÜK" },
  "1d": { slPct: 4.0, tpR: "1:4", style: "pozisyon", noise: "MİNİMAL" },
  "1w": { slPct: 8.0, tpR: "1:5+", style: "uzun vadeli", noise: "MİNİMAL" },
};

export const buildOrchestraPrompt = (symbol: string, tf: string, data: any, isMeme: boolean, dashboardState?: any) => {
  const p = TF_PARAMS[tf] || TF_PARAMS["1h"];
  
  let dsText = "";
  if (dashboardState) {
    // We sanitize large arrays to not overflow the context
    const cleanSignal = dashboardState.signal ? { ...dashboardState.signal } : {};
    if (cleanSignal.smc) {
      cleanSignal.smc = { ...cleanSignal.smc };
      if (cleanSignal.smc.orderBlocks) cleanSignal.smc.orderBlocks = `[${cleanSignal.smc.orderBlocks.length} OBs]`;
      if (cleanSignal.smc.fvgs) cleanSignal.smc.fvgs = `[${cleanSignal.smc.fvgs.length} FVGs]`;
    }
    dsText = `\nEKSTRA: CANLI KOKPİT (DASHBOARD) DURUMU:\n${JSON.stringify({
      Sinyal_Metrikleri: cleanSignal,
      Haber_Sosyal_Nabiz: dashboardState.sentiment || "Bilinmiyor",
      Kuresel_Piyasa: dashboardState.globalMarket || {},
      Konfigurasyon: dashboardState.config || {}
    }, null, 2)}\n`;
  }

  return `Sen Matrix V5 Üst Düzey Piyasa Orkestra Şefi'sin. 
Sana sağlanan hem standart indikatörleri hem de derin "Dashboard State" (Kokpit Durumu) verilerini kullanarak matematiksel ve stratejik bir analiz yapmalısın.

VARLIK: ${symbol} | TF: ${tf} (${p.style}) | FİYAT: ${data.meta.price} | DEĞİŞİM: %${data.meta.change24h}
PARAMETRELER: SL:%${p.slPct}, TP:${p.tpR}, Gürültü:${p.noise}, Vol.Regime:${data.volatility.regime}
${isMeme ? "⚠️ MEME COIN: Risk yönetimi gereği maksimum YARIM pozisyon önerilebilir." : ""}

[STANDART VERİLER]:
${JSON.stringify(data, null, 2)}

[KOKPİT (DERİN SİNYAL) VERİLERİ]:
${dsText}

ANALİZ TALİMATLARI:
1. MATEMATİKSEL TUTARLILIK: Fiyatın indikatörlerle (RSI, MACD, EMA) ve SMC yapısıyla (OB, FVG) olan matematiksel uyumunu kontrol et.
2. KOKPİT ENTEGRASYONU: Kararında mutlaka "F4 Gücü", "VPA Baskısı", "Sermaye Akışı" ve "Balina Güveni" metriklerini kullan. Bu veriler standart indikatörlerden daha kritiktir.
3. SMC & LİKİDİTE: SMC Internal Trend ve Likidite bölgelerini (EqHighs/Lows) hesaba kat.
4. "reasoning" ALANI: Çok detaylı olmalı. Neden bu kararı verdiğini fiyat seviyeleri ve yukarıdaki kritik metrikleri (özellikle F4 ve VPA) referans göstererek açıkla.

Sadece JSON döndür:
{
  "verdict": "GÜÇLÜ AL" | "AL" | "BEKLE" | "SAT" | "GÜÇLÜ SAT" | "KESİNLİKLE BEKLE",
  "confidence": <0-100 arası tam sayı>,
  "direction": "LONG" | "SHORT" | "FLAT",
  "reasoning": "<ÇOK DETAYLI ANALİZ: F4 Gücü, VPA, Fiyat Seviyeleri ve SMC yapılarını içeren derin açıklama>",
  "entry_strategy": "<somut giriş — fiyat seviyesi, bekleme koşulu>",
  "stop_loss_logic": "<SL mantığı — ATR(${data.volatility.atr}) ve SMC seviyelerini baz al, ~%${p.slPct}>",
  "take_profit_logic": "<TP — hedef ${p.tpR}>",
  "position_size": "TAM" | "YARIM" | "ÇEYREK" | "GİRME",
  "key_confluences": ["<en az 4 güçlü metrik tutarlılığı>"],
  "key_risks": ["<en az 3 somut risk faktörü>"],
  "market_context_score": <0-100 arası tam sayı>,
  "tf_noise_warning": ${p.noise === "YÜKSEK" || p.noise === "ÇOK YÜKSEK"}
}`;
};
