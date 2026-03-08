export const calcEMA = (data: number[], p: number) => {
  const k = 2 / (p + 1);
  const r = [data[0]];
  for (let i = 1; i < data.length; i++) r.push(data[i] * k + r[i - 1] * (1 - k));
  return r;
};

export const calcRSI = (closes: number[], p = 14) => {
  if (closes.length < p + 1) return 50;
  let g = 0,
    l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    d > 0 ? (g += d) : (l -= d);
  }
  let ag = g / p,
    al = l / p;
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (p - 1) + Math.max(d, 0)) / p;
    al = (al * (p - 1) + Math.max(-d, 0)) / p;
  }
  
  if (al === 0 && ag === 0) return 50; // P4.1 FIX
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
};

export const calcMACD = (closes: number[]) => {
  const e12 = calcEMA(closes, 12),
    e26 = calcEMA(closes, 26);
  const line = e12.map((v, i) => v - e26[i]);
  const sig = calcEMA(line, 9);
  const n = closes.length - 1;
  return {
    hist: line[n] - sig[n],
    prevHist: line[n - 1] - sig[n - 1],
    crossUp: line[n] > sig[n] && line[n - 1] <= sig[n - 1],
    crossDown: line[n] < sig[n] && line[n - 1] >= sig[n - 1],
  };
};

export const calcATR = (
  highs: number[],
  lows: number[],
  closes: number[],
  p = 14
) => {
  const trs = [];
  for (let i = 1; i < closes.length; i++)
    trs.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  let atr = trs.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < trs.length; i++) atr = (atr * (p - 1) + trs[i]) / p;
  return atr;
};

export const calcSupertrend = (
  highs: number[],
  lows: number[],
  closes: number[],
  p = 10,
  m = 3
) => {
  const trs = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++)
    trs.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
    
  if (closes.length < p + 1) return { bullish: true }; // P3.1 FIX: Enforce minimum data requirements
  
  const atr = new Array(closes.length).fill(0);
  const initialTRs = trs.slice(0, p);
  atr[p - 1] = initialTRs.length > 0 ? initialTRs.reduce((a, b) => a + b, 0) / initialTRs.length : 0;
  
  for (let i = p; i < closes.length; i++)
    atr[i] = (atr[i - 1] * (p - 1) + trs[i]) / p;
  let dir = 1,
    fU = 0,
    fL = 0;
  for (let i = p; i < closes.length; i++) {
    const hl2 = (highs[i] + lows[i]) / 2;
    const nU = hl2 + m * (atr[i] || 0),
      nL = hl2 - m * (atr[i] || 0);
    fU = nU < fU || closes[i - 1] > fU ? nU : fU;
    fL = nL > fL || closes[i - 1] < fL ? nL : fL;
    if (closes[i] > fU) dir = 1;
    else if (closes[i] < fL) dir = -1;
  }
  return { bullish: dir === 1 };
};

export const calcBB = (closes: number[], p = 20) => {
  const s = closes.slice(-p),
    m = s.reduce((a, b) => a + b, 0) / p;
  const std = Math.sqrt(s.reduce((a, v) => a + (v - m) ** 2, 0) / p);
  return { squeeze: std / m < 0.015, width: +((std / m) * 100).toFixed(2) };
};

export const calcADX = (
  highs: number[],
  lows: number[],
  closes: number[],
  p = 14
) => {
  if (closes.length < p * 2) return { adx: 15, diP: 15, diM: 15 };
  const pdm = [],
    mdm = [],
    tr = [];
  for (let i = 1; i < closes.length; i++) {
    const u = highs[i] - highs[i - 1],
      d = lows[i - 1] - lows[i];
    pdm.push(u > d && u > 0 ? u : 0);
    mdm.push(d > u && d > 0 ? d : 0);
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }
  const ws = (a: number[], p: number) => {
    let s = a.slice(0, p).reduce((x, y) => x + y, 0);
    const r = [s];
    for (let i = p; i < a.length; i++) {
      s = s - s / p + a[i];
      r.push(s);
    }
    return r;
  };
  const sTR = ws(tr, p),
    sP = ws(pdm, p),
    sM = ws(mdm, p);
  const n = sTR.length - 1;
  const diP = sTR[n] > 0 ? (100 * sP[n]) / sTR[n] : 0,
    diM = sTR[n] > 0 ? (100 * sM[n]) / sTR[n] : 0;
  const dx = sTR.map((_, i) => {
    const p = sTR[i] > 0 ? (100 * sP[i]) / sTR[i] : 0,
      m = sTR[i] > 0 ? (100 * sM[i]) / sTR[i] : 0;
    return p + m > 0 ? (Math.abs(p - m) / (p + m)) * 100 : 0;
  });
  const adxArr = ws(dx, p);
  return {
    adx: +(adxArr[adxArr.length - 1] / p).toFixed(1),
    diP: +diP.toFixed(1),
    diM: +diM.toFixed(1),
  };
};

export const calcVWAP = (
  highs: number[],
  lows: number[],
  closes: number[],
  vols: number[]
) => {
  const n = Math.min(50, closes.length);
  let pv = 0,
    v = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    pv += tp * vols[i];
    v += vols[i];
  }
  return v > 0 ? pv / v : closes[closes.length - 1];
};

export const calcEmaRibbon = (closes: number[]) => {
  const ps = [8, 13, 21, 34, 55];
  const es = ps.map((p) => {
    const a = calcEMA(closes, p);
    return a[a.length - 1];
  });
  const bull =
    es[0] > es[1] && es[1] > es[2] && es[2] > es[3] && es[3] > es[4];
  const bear =
    es[0] < es[1] && es[1] < es[2] && es[2] < es[3] && es[3] < es[4];
  return { bull, bear, e8: es[0], e55: es[4] };
};

export const calcWaveTrend = (
  highs: number[],
  lows: number[],
  closes: number[]
) => {
  const hlc3 = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const esa = calcEMA(hlc3, 10);
  const d = calcEMA(
    hlc3.map((v, i) => Math.abs(v - esa[i])),
    10
  );
  const ci = hlc3.map((v, i) => (d[i] > 0 ? (v - esa[i]) / (0.015 * d[i]) : 0));
  const wt1a = calcEMA(ci, 21);
  const wt1 = wt1a[wt1a.length - 1];
  const wt2 = wt1a.slice(-4).reduce((a, b) => a + b, 0) / 4;
  return {
    wt1: +wt1.toFixed(1),
    wt2: +wt2.toFixed(1),
    bull: wt1 > wt2,
    ob: wt1 > 60,
    os: wt1 < -60,
  };
};

export const calcZScore = (closes: number[], p = 50) => {
  const s = closes.slice(-p),
    m = s.reduce((a, b) => a + b, 0) / p;
  const std = Math.sqrt(s.reduce((a, v) => a + (v - m) ** 2, 0) / p);
  return std > 0 ? +((closes[closes.length - 1] - m) / std).toFixed(2) : 0;
};

export const calcSlope = (closes: number[], p = 20) => {
  const s = closes.slice(-p),
    xm = (p - 1) / 2,
    ym = s.reduce((a, b) => a + b, 0) / p;
  const num = s.reduce((t, v, i) => t + (i - xm) * (v - ym), 0);
  const den = s.reduce((t, _, i) => t + (i - xm) ** 2, 0);
  return den > 0 ? num / den : 0;
};

export const calcVolumeAnalysis = (
  closes: number[],
  opens: number[],
  highs: number[],
  lows: number[],
  vols: number[]
) => {
  const sma20 = vols.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const last = vols[vols.length - 1];
  const isWhale = last > sma20 * 1.8;
  const lc = closes[closes.length - 1],
    lo = opens[opens.length - 1];
  let netBuy = 0,
    totV = 0;
  const n = Math.min(5, closes.length);
  for (let i = closes.length - n; i < closes.length; i++) {
    const r = highs[i] - lows[i];
    const bp = r > 0 ? (closes[i] - lows[i]) / r : 0.5;
    netBuy += vols[i] * bp;
    totV += vols[i];
  }
  const vpa = totV > 0 ? (netBuy / totV - 0.5) * 200 : 0;
  return {
    ratio: +(last / sma20).toFixed(2),
    isWhale,
    whaleBuy: isWhale && lc > lo,
    whaleSell: isWhale && lc < lo,
    vpa: +Math.max(-100, Math.min(100, vpa)).toFixed(1),
    regime:
      last > sma20 * 2 ? "PATLAMA" : last < sma20 * 0.5 ? "SIKIŞTIRMA" : "NORMAL",
  };
};

export const detectSwingTrend = (
  highs: number[],
  lows: number[],
  closes: number[]
) => {
  const p = Math.min(30, Math.floor(closes.length / 3));
  if (p < 5) return { bias: 0, text: "Yatay" };
  const rH = Math.max(...highs.slice(-p)),
    rL = Math.min(...lows.slice(-p));
  const pH = Math.max(...highs.slice(-p * 2, -p)),
    pL = Math.min(...lows.slice(-p * 2, -p));
  if (rH > pH && rL > pL) return { bias: 1, text: "Boğa Trendi" };
  if (rH < pH && rL < pL) return { bias: -1, text: "Ayı Trendi" };
  return { bias: 0, text: "Yatay/Nötr" };
};

export const calcVixFix = (closes: number[], lows: number[]) => {
  const hc = Math.max(...closes.slice(-22));
  const wvf = ((hc - lows[lows.length - 1]) / hc) * 100;
  return { wvf: +wvf.toFixed(1), dipSignal: wvf > 15 };
};
