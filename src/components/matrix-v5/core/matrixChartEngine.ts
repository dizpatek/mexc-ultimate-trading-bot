// Matrix V5 Chart Engine - Full Implementation
import { ChartEngine } from './engine';
import { TechnicalIndicators } from './indicators';
import { F4Strategy } from './f4Strategy';
import type { Trade } from './data';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MatrixChartEngine extends ChartEngine {
  // Matrix specific properties
  candles: Candle[] = [];
  
  // Indicators
  f4Line: number[] = [];
  f4Fibo: number[] = [];
  f4BuySignals: boolean[] = [];
  f4SellSignals: boolean[] = [];
  
  rsiValues: number[] = [];
  macdLine: number[] = [];
  macdSignal: number[] = [];
  macdHist: number[] = [];
  
  supertrendLine: number[] = [];
  supertrendDir: number[] = [];
  
  ema8: number[] = [];
  ema21: number[] = [];
  ema55: number[] = [];
  vwapLine: number[] = [];
  
  // Config
  showF4 = true;
  showF4Fibo = true;
  showIndicators = true;
  showEMA = true;
  showSupertrend = true;
  showVWAP = true;
  
  constructor(canvasId: string, overlayMode = false) {
    console.log('🚀 MatrixChartEngine constructor called! OverlayMode:', overlayMode);
    super(canvasId, overlayMode);
    // Increase right margin for indicators (only if not overlay)
    if (!overlayMode) {
      this.margin.right = 120;
    }
    console.log('✅ MatrixChartEngine initialized');
  }
  
  override setData(dataService: any): void {
    console.log('📊 MatrixChartEngine.setData called with', dataService.list?.length, 'trades');
    super.setData(dataService);
    if (!this.overlayMode) {
      this.calculateAllIndicators();
    }
  }
  
  private calculateAllIndicators() {
    if (this.trades.length < 100) {
      console.log('Not enough trades for indicators:', this.trades.length);
      return;
    }
    
    console.log('Calculating indicators for', this.trades.length, 'trades');
    
    // Dinamik mum aralığı (TimeSpan'e göre değişir)
    const timeSpan = this.viewport.endTime - this.viewport.startTime;
    const intervalMs = timeSpan > 3600000 ? 300000 : // > 1h -> 5m candles
                       timeSpan > 900000 ? 60000 :   // > 15m -> 1m candles
                       timeSpan > 300000 ? 15000 :   // > 5m -> 15s candles
                       5000;                         // else -> 5s candles
                       
    // Convert trades to dynamic candles
    this.candles = this.tradesToCandles(this.trades, intervalMs);
    
    console.log('Generated', this.candles.length, 'candles');
    
    if (this.candles.length < 50) {
      console.log('Not enough candles for indicators');
      return;
    }
    
    const closes = this.candles.map(c => c.close);
    const highs = this.candles.map(c => c.high);
    const lows = this.candles.map(c => c.low);
    const volumes = this.candles.map(c => c.volume);
    
    try {
      // F4 Strategy
      if (this.showF4) {
        console.log('Calculating F4...');
        const f4Result = F4Strategy.calculate(highs, lows, closes, {
          length: 10,
          alpha: 3.7,
          fiboLength: 5,
          fiboAlpha: 0.618,
          slopeThreshold: 0.01,
          powerLossThreshold: 50,
          lookbackBars: 10,
          squeezeThreshold: 40
        });
        
        this.f4Line = f4Result.f4;
        this.f4Fibo = f4Result.f4Fibo;
        this.f4BuySignals = f4Result.earlyBuySignals;
        this.f4SellSignals = f4Result.earlySellSignals;
        console.log('F4 calculated:', this.f4Line.length, 'values');
      }
      
      // RSI
      this.rsiValues = TechnicalIndicators.rsi(closes, 14);
      
      // MACD
      const macd = TechnicalIndicators.macd(closes, 12, 26, 9);
      this.macdLine = macd.macd;
      this.macdSignal = macd.signal;
      this.macdHist = macd.histogram;
      
      // Supertrend
      if (this.showSupertrend) {
        const st = TechnicalIndicators.supertrend(highs, lows, closes, 10, 3.0);
        this.supertrendLine = st.trend;
        this.supertrendDir = st.direction;
      }
      
      // EMA Ribbon
      if (this.showEMA) {
        this.ema8 = TechnicalIndicators.ema(closes, 8);
        this.ema21 = TechnicalIndicators.ema(closes, 21);
        this.ema55 = TechnicalIndicators.ema(closes, 55);
      }
      
      // VWAP
      if (this.showVWAP) {
        this.vwapLine = TechnicalIndicators.vwap(highs, lows, closes, volumes);
      }
      
    } catch (error) {
      console.error('Indicator calculation error:', error);
    }
  }
  
  private tradesToCandles(trades: Trade[], intervalMs: number): Candle[] {
    if (trades.length === 0) return [];
    
    const candles: Candle[] = [];
    let currentCandle: Candle | null = null;
    
    for (const trade of trades) {
      const candleTime = Math.floor(trade.T / intervalMs) * intervalMs;
      
      if (!currentCandle || currentCandle.time !== candleTime) {
        if (currentCandle) {
          candles.push(currentCandle);
        }
        currentCandle = {
          time: candleTime,
          open: trade.p,
          high: trade.p,
          low: trade.p,
          close: trade.p,
          volume: trade.q
        };
      } else {
        currentCandle.high = Math.max(currentCandle.high, trade.p);
        currentCandle.low = Math.min(currentCandle.low, trade.p);
        currentCandle.close = trade.p;
        currentCandle.volume += trade.q;
      }
    }
    
    if (currentCandle) {
      candles.push(currentCandle);
    }
    
    return candles;
  }

  
  // Override draw to include indicators
  override draw() {
    console.log('🎨 MatrixChartEngine.draw() called - trades:', this.trades.length, 'candles:', this.candles.length);
    const ctx = this.ctx;
    
    // In overlay mode, we just want transparency and dots. No background.
    if (!this.overlayMode) {
        ctx.fillStyle = "#131722";
        ctx.fillRect(0, 0, this.width, this.height);
    } else {
        ctx.clearRect(0, 0, this.width, this.height);
    }
    
    if (this.trades.length === 0) {
      console.log('⚠️ No trades to draw');
      return;
    }
    
    // Draw base components
    if (!this.overlayMode) {
        console.log('Drawing with', this.candles.length, 'candles, F4 length:', this.f4Line.length);
        this.drawGrid(ctx);
        this.drawIndicators(ctx);
        this.drawCandles(ctx);
    }
    
    // Draw trades (Main Overlay content)
    this.drawCachedTrades(ctx);
    
    // Draw overlay texts and axes
    if (!this.overlayMode) {
        this.drawF4Signals(ctx);
        this.drawNowLine(ctx);
        this.drawAxes(ctx);
        this.drawIndicatorPanel(ctx);
    }
    
    // Always draw crosshair and tooltip because they're interactive overlays
    this.drawCrosshair(ctx);
    this.drawHoverTooltip(ctx);
  }
  
  private drawCandles(ctx: CanvasRenderingContext2D) {
    if (this.candles.length === 0) return;
    
    ctx.save();
    ctx.rect(this.margin.left, this.margin.top, this.chartW, this.chartH);
    ctx.clip();
    
    // Calculate candle width based on zoom level (px per ms)
    const minTime = this.viewport.startTime;
    const maxTime = this.viewport.endTime;
    const timeSpan = maxTime - minTime;
    const pxPerMs = this.chartW / (timeSpan || 1);
    
    // Determine interval used to generate candles
    const intervalMs = timeSpan > 3600000 ? 300000 :
                       timeSpan > 900000 ? 60000 :
                       timeSpan > 300000 ? 15000 : 5000;
                       
    // Leave some padding between candles
    const candleWidth = Math.max(1.5, (intervalMs * pxPerMs) * 0.75);
    
    for (const candle of this.candles) {
      const x = this.mapTimeToX(candle.time + intervalMs / 2); // Center the candle
      
      // Frustum culling
      if (x + candleWidth / 2 < this.margin.left || x - candleWidth / 2 > this.margin.left + this.chartW) continue;
      
      const openY = this.mapPriceToY(candle.open);
      const closeY = this.mapPriceToY(candle.close);
      const highY = this.mapPriceToY(candle.high);
      const lowY = this.mapPriceToY(candle.low);
      
      const isUp = candle.close >= candle.open;
      const wickColor = isUp ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)';
      const bodyColor = isUp ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)';
      const bodyBorderColor = isUp ? 'rgba(38, 166, 154, 0.8)' : 'rgba(239, 83, 80, 0.8)';
      
      // Draw wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(openY - closeY));
      
      ctx.fillStyle = bodyColor;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      
      ctx.strokeStyle = bodyBorderColor;
      ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    }
    
    ctx.restore();
  }

  private drawIndicators(ctx: CanvasRenderingContext2D) {
    if (this.candles.length === 0) return;
    
    ctx.save();
    ctx.rect(this.margin.left, this.margin.top, this.chartW, this.chartH);
    ctx.clip();
    
    // Draw VWAP
    if (this.showVWAP && this.vwapLine.length > 0) {
      this.drawLine(ctx, this.vwapLine, 'rgba(255, 235, 59, 0.5)', 1);
    }
    
    // Draw EMA Ribbon
    if (this.showEMA) {
      if (this.ema55.length > 0) {
        this.drawLine(ctx, this.ema55, 'rgba(239, 83, 80, 0.4)', 1);
      }
      if (this.ema21.length > 0) {
        this.drawLine(ctx, this.ema21, 'rgba(66, 165, 245, 0.4)', 1);
      }
      if (this.ema8.length > 0) {
        this.drawLine(ctx, this.ema8, 'rgba(38, 166, 154, 0.4)', 1);
      }
    }
    
    // Draw Supertrend
    if (this.showSupertrend && this.supertrendLine.length > 0) {
      this.drawSupertrendLine(ctx);
    }
    
    // Draw F4 Lines
    if (this.showF4 && this.f4Line.length > 0) {
      const f4Color = this.getF4Color();
      this.drawLine(ctx, this.f4Line, f4Color, 3);
    }
    
    if (this.showF4Fibo && this.f4Fibo.length > 0) {
      const fiboColor = this.getFiboColor();
      this.drawLine(ctx, this.f4Fibo, fiboColor, 2);
    }
    
    ctx.restore();
  }
  
  private drawLine(ctx: CanvasRenderingContext2D, values: number[], color: string, width: number) {
    if (values.length === 0 || this.candles.length === 0) {
      console.log('Cannot draw line: values=', values.length, 'candles=', this.candles.length);
      return;
    }
    
    console.log('Drawing line with', values.length, 'values, color:', color);
    
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    
    let started = false;
    let pointsDrawn = 0;
    
    for (let i = 0; i < Math.min(values.length, this.candles.length); i++) {
      if (isNaN(values[i])) continue;
      
      const candle = this.candles[i];
      const x = this.mapTimeToX(candle.time);
      const y = this.mapPriceToY(values[i]);
      
      if (x < this.margin.left || x > this.margin.left + this.chartW) continue;
      
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
      pointsDrawn++;
    }
    
    console.log('Drew', pointsDrawn, 'points');
    ctx.stroke();
  }
  
  private drawSupertrendLine(ctx: CanvasRenderingContext2D) {
    if (this.supertrendLine.length === 0 || this.candles.length === 0) return;
    
    for (let i = 1; i < Math.min(this.supertrendLine.length, this.candles.length); i++) {
      if (isNaN(this.supertrendLine[i]) || isNaN(this.supertrendLine[i-1])) continue;
      
      const candle = this.candles[i];
      const prevCandle = this.candles[i-1];
      
      const x1 = this.mapTimeToX(prevCandle.time);
      const y1 = this.mapPriceToY(this.supertrendLine[i-1]);
      const x2 = this.mapTimeToX(candle.time);
      const y2 = this.mapPriceToY(this.supertrendLine[i]);
      
      if (x2 < this.margin.left || x1 > this.margin.left + this.chartW) continue;
      
      const color = this.supertrendDir[i] < 0 ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  
  private getF4Color(): string {
    if (this.f4Line.length < 2) return '#26a69a';
    const last = this.f4Line[this.f4Line.length - 1];
    const prev = this.f4Line[this.f4Line.length - 2];
    return last > prev ? 'rgba(38, 166, 154, 0.95)' : 'rgba(239, 83, 80, 0.95)';
  }
  
  private getFiboColor(): string {
    if (this.f4Fibo.length < 2) return '#2196f3';
    const last = this.f4Fibo[this.f4Fibo.length - 1];
    const prev = this.f4Fibo[this.f4Fibo.length - 2];
    return last > prev ? 'rgba(33, 150, 243, 0.95)' : 'rgba(156, 39, 176, 0.95)';
  }

  
  private drawF4Signals(ctx: CanvasRenderingContext2D) {
    if (!this.showF4 || this.candles.length === 0) return;
    
    for (let i = 0; i < Math.min(this.f4BuySignals.length, this.candles.length); i++) {
      const candle = this.candles[i];
      const x = this.mapTimeToX(candle.time);
      
      if (x < this.margin.left || x > this.margin.left + this.chartW) continue;
      
      if (this.f4BuySignals[i]) {
        const y = this.mapPriceToY(candle.low) + 20;
        
        // Draw triangle
        ctx.fillStyle = 'rgba(0, 255, 104, 0.9)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y + 10);
        ctx.lineTo(x + 6, y + 10);
        ctx.closePath();
        ctx.fill();
        
        // Draw label
        ctx.fillStyle = '#00ff68';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('EAL', x, y + 22);
      }
      
      if (this.f4SellSignals[i]) {
        const y = this.mapPriceToY(candle.high) - 20;
        
        // Draw triangle
        ctx.fillStyle = 'rgba(255, 0, 8, 0.9)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y - 10);
        ctx.lineTo(x + 6, y - 10);
        ctx.closePath();
        ctx.fill();
        
        // Draw label
        ctx.fillStyle = '#ff0008';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('ESAT', x, y - 12);
      }
    }
  }
  
  private drawIndicatorPanel(ctx: CanvasRenderingContext2D) {
    const panelX = this.margin.left + this.chartW + 5;
    const panelY = this.margin.top;
    const panelWidth = this.margin.right - 10;
    
    ctx.fillStyle = 'rgba(30, 34, 45, 0.9)';
    ctx.fillRect(panelX, panelY, panelWidth, 200);
    
    ctx.fillStyle = '#d1d4dc';
    ctx.font = '11px Inter';
    ctx.textAlign = 'left';
    
    let y = panelY + 15;
    const lineHeight = 18;
    
    // RSI
    if (this.rsiValues.length > 0) {
      const rsi = this.rsiValues[this.rsiValues.length - 1];
      if (!isNaN(rsi)) {
        const rsiColor = rsi > 70 ? '#ef5350' : rsi < 30 ? '#26a69a' : '#d1d4dc';
        ctx.fillStyle = '#787b86';
        ctx.fillText('RSI(14):', panelX + 5, y);
        ctx.fillStyle = rsiColor;
        ctx.fillText(rsi.toFixed(1), panelX + 55, y);
        y += lineHeight;
      }
    }
    
    // MACD
    if (this.macdHist.length > 0) {
      const hist = this.macdHist[this.macdHist.length - 1];
      if (!isNaN(hist)) {
        const macdColor = hist > 0 ? '#26a69a' : '#ef5350';
        ctx.fillStyle = '#787b86';
        ctx.fillText('MACD:', panelX + 5, y);
        ctx.fillStyle = macdColor;
        ctx.fillText(hist > 0 ? '↑' : '↓', panelX + 55, y);
        y += lineHeight;
      }
    }
    
    // Supertrend
    if (this.supertrendDir.length > 0) {
      const dir = this.supertrendDir[this.supertrendDir.length - 1];
      const stColor = dir < 0 ? '#26a69a' : '#ef5350';
      const stText = dir < 0 ? 'YUKARI' : 'AŞAĞI';
      ctx.fillStyle = '#787b86';
      ctx.fillText('ST:', panelX + 5, y);
      ctx.fillStyle = stColor;
      ctx.fillText(stText, panelX + 35, y);
      y += lineHeight;
    }
    
    // F4 Status
    if (this.f4Line.length > 1) {
      const last = this.f4Line[this.f4Line.length - 1];
      const prev = this.f4Line[this.f4Line.length - 2];
      const f4Trend = last > prev ? 'YUKARI' : 'AŞAĞI';
      const f4Color = last > prev ? '#26a69a' : '#ef5350';
      ctx.fillStyle = '#787b86';
      ctx.fillText('F4:', panelX + 5, y);
      ctx.fillStyle = f4Color;
      ctx.fillText(f4Trend, panelX + 35, y);
      y += lineHeight;
    }
    
    // EMA Status
    if (this.ema8.length > 0 && this.ema55.length > 0) {
      const ema8Val = this.ema8[this.ema8.length - 1];
      const ema55Val = this.ema55[this.ema55.length - 1];
      if (!isNaN(ema8Val) && !isNaN(ema55Val)) {
        const emaTrend = ema8Val > ema55Val ? 'BOĞA' : 'AYI';
        const emaColor = ema8Val > ema55Val ? '#26a69a' : '#ef5350';
        ctx.fillStyle = '#787b86';
        ctx.fillText('EMA:', panelX + 5, y);
        ctx.fillStyle = emaColor;
        ctx.fillText(emaTrend, panelX + 45, y);
        y += lineHeight;
      }
    }
    
    // VWAP Status
    if (this.vwapLine.length > 0 && this.candles.length > 0) {
      const vwap = this.vwapLine[this.vwapLine.length - 1];
      const lastClose = this.candles[this.candles.length - 1].close;
      if (!isNaN(vwap)) {
        const vwapStatus = lastClose > vwap ? 'ÜST' : 'ALT';
        const vwapColor = lastClose > vwap ? '#26a69a' : '#ef5350';
        ctx.fillStyle = '#787b86';
        ctx.fillText('VWAP:', panelX + 5, y);
        ctx.fillStyle = vwapColor;
        ctx.fillText(vwapStatus, panelX + 50, y);
      }
    }
  }
}
