import type { Trade } from "./data";

export class ChartEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  margin: { top: number; right: number; bottom: number; left: number };
  viewport: {
    startTime: number;
    endTime: number;
    minPrice: number;
    maxPrice: number;
    isLive: boolean;
    rightMargin: number;
  };
  interaction: {
    mouseX: number;
    mouseY: number;
    isPanning: boolean;
    dragStartX: number;
    dragStartOffset: number;
    activeLayer: HTMLCanvasElement | null;
  };
  trades: Trade[];
  threshold: number;
  aggregated: boolean;
  needsRender: boolean;
  width: number;
  height: number;
  chartW: number;
  chartH: number;
  onPanLazyLoad?: (vStart: number, vEnd: number) => void;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    
    this.margin = { top: 20, right: 80, bottom: 30, left: 10 };
    
    // Viewport
    this.viewport = {
      startTime: 0,
      endTime: 0,
      minPrice: 0,
      maxPrice: 0,
      isLive: true,
      rightMargin: 0 // Stuck to the right
    };
    
    // Interaction state
    this.interaction = {
      mouseX: 0,
      mouseY: 0,
      isPanning: false,
      dragStartX: 0,
      dragStartOffset: 0,
      activeLayer: null // To cache trade draws
    };
    
    this.trades = [];
    this.threshold = 0;
    this.aggregated = false;
    
    this.needsRender = true;
    
    this.width = 0;
    this.height = 0;
    this.chartW = 0;
    this.chartH = 0;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    this.setupInteractions();
    
    // Start render loop
    requestAnimationFrame(() => this.renderLoop());
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    
    this.width = parent.clientWidth;
    this.height = parent.clientHeight;
    
    // Handle High-DPI screens
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    
    this.chartW = this.width - this.margin.left - this.margin.right;
    this.chartH = this.height - this.margin.top - this.margin.bottom;
    
    this.invalidateCache();
    this.needsRender = true;
  }

  setData(dataService: {
    list: Trade[];
    threshold: number;
    aggregated: boolean;
    startTime: number;
    endTime: number;
  }): void {
    this.trades = dataService.list;
    this.threshold = dataService.threshold;
    this.aggregated = dataService.aggregated;
    
    // ONLY set viewport from data service on initial load (endTime === 0).
    // During live updates, the viewport is managed by updateLiveViewport() 
    // and must NOT be snapped back to the historical fetch range.
    if (this.viewport.endTime === 0 && this.trades.length > 0 && dataService.startTime > 0 && dataService.endTime > dataService.startTime) {
      this.viewport.startTime = dataService.startTime;
      this.viewport.endTime = dataService.endTime;
      this.smoothEndTime = this.viewport.endTime;
    }
    
    this.calculatePriceRange(true);
    this.invalidateCache();
    this.needsRender = true;
  }

  private lastPriceCalcTime = 0;
  private smoothMinPrice: number | null = null;
  private smoothMaxPrice: number | null = null;

  calculatePriceRange(force = false) {
    if (this.trades.length === 0) {
      this.viewport.minPrice = 0;
      this.viewport.maxPrice = 100;
      return;
    }

    // Throttle heavy array scans to ~10Hz unless forced (initial load, zoom, pan)
    const now = Date.now();
    if (!force && now - this.lastPriceCalcTime < 100) return;
    this.lastPriceCalcTime = now;
    
    let minP = Infinity;
    let maxP = -Infinity;
    
    const vStart = this.viewport.startTime;
    const vEnd = this.viewport.endTime;

    // Fast range detection via binary search
    let low = 0, high = this.trades.length - 1;
    let startIndex = 0;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (this.trades[mid].T < vStart) { low = mid + 1; startIndex = low; }
        else high = mid - 1;
    }

    let visibleCount = 0;
    for (let i = startIndex; i < this.trades.length; i++) {
        const t = this.trades[i];
        if (t.T > vEnd) break;
        
        const p = t.p;
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
        visibleCount++;
    }
    
    if (visibleCount === 0) {
       const recentTrades = this.trades.slice(-50);
       for (const t of recentTrades) {
          if (t.p < minP) minP = t.p;
          if (t.p > maxP) maxP = t.p;
       }
    }

    if (minP !== Infinity && maxP !== -Infinity) {
       const diff = maxP - minP;
       const padding = diff === 0 ? Math.max(0.1, minP * 0.01) : diff * 0.1;
       const targetMin = minP - padding;
       const targetMax = maxP + padding;

       // Price Lerp for vertical smoothness
       if (this.smoothMinPrice === null || force) this.smoothMinPrice = targetMin;
       if (this.smoothMaxPrice === null || force) this.smoothMaxPrice = targetMax;

       const pLerp = 0.2; // Fast but smooth
       this.smoothMinPrice += (targetMin - this.smoothMinPrice) * pLerp;
       this.smoothMaxPrice += (targetMax - this.smoothMaxPrice) * pLerp;

       this.viewport.minPrice = this.smoothMinPrice;
       this.viewport.maxPrice = this.smoothMaxPrice;
    }
  }

  invalidateCache() {
    this.interaction.activeLayer = null;
  }

  setupInteractions() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.interaction.mouseX = e.clientX - rect.left;
      this.interaction.mouseY = e.clientY - rect.top;
      
      if (this.interaction.isPanning) {
        const dx = this.interaction.mouseX - this.interaction.dragStartX;
        const duration = this.viewport.endTime - this.viewport.startTime;
        const timePerPixel = duration / this.chartW;
        const timeOffset = dx * timePerPixel;
        
        this.viewport.startTime = this.interaction.dragStartOffset - timeOffset;
        this.viewport.endTime = this.viewport.startTime + duration;
        this.smoothEndTime = this.viewport.endTime; // Sync smoother
        
        const now = Date.now();
        if (this.viewport.endTime < now - 30000) {
            this.viewport.isLive = false;
        }

        this.calculatePriceRange(true);
        this.invalidateCache();
      }
      this.needsRender = true;
    });
    
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.interaction.mouseY > this.margin.top && this.interaction.mouseX < this.width - this.margin.right) {
        this.interaction.isPanning = true;
        this.interaction.dragStartX = this.interaction.mouseX;
        this.interaction.dragStartOffset = this.viewport.startTime;
      }
    });

    window.addEventListener('mouseup', () => {
      this.interaction.isPanning = false;
      const now = Date.now();
      if (this.viewport.endTime > now - 5000) {
          this.viewport.isLive = true;
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.trades.length === 0) return;
      
      const zoomFactor = 1.1;
      const duration = this.viewport.endTime - this.viewport.startTime;
      const mouseTime = this.mapXToTime(this.interaction.mouseX);
      const ratio = (this.interaction.mouseX - this.margin.left) / this.chartW;
      
      const newDuration = e.deltaY > 0 ? duration * zoomFactor : duration / zoomFactor;
      
      this.viewport.startTime = mouseTime - (newDuration * ratio);
      this.viewport.endTime = this.viewport.startTime + newDuration;
      this.smoothEndTime = this.viewport.endTime; // Sync smoother

      if (this.viewport.startTime < 0) this.viewport.startTime = 0;

      this.calculatePriceRange(true);
      this.invalidateCache();
      this.needsRender = true;
    }, { passive: false });
  }

  // --- Utility Mappers ---

  mapTimeToX(t: number): number {
    return this.margin.left + ((t - this.viewport.startTime) / (this.viewport.endTime - this.viewport.startTime)) * this.chartW;
  }
  
  mapXToTime(x: number): number {
    return this.viewport.startTime + ((x - this.margin.left) / this.chartW) * (this.viewport.endTime - this.viewport.startTime);
  }

  mapPriceToY(p: number): number {
    return this.margin.top + this.chartH - ((p - this.viewport.minPrice) / (this.viewport.maxPrice - this.viewport.minPrice)) * this.chartH;
  }

  // --- Rendering Functions ---

  private smoothEndTime: number | null = null;

  renderLoop() {
    this.updateLiveViewport();
    // Re-check price range on every frame but it's throttled internally
    this.calculatePriceRange();
    
    // Always render in live mode for smooth updates, or when needsRender is set
    if (this.needsRender || this.viewport.isLive) {
      this.draw();
      this.needsRender = false;
    }
    requestAnimationFrame(() => this.renderLoop());
  }

  updateLiveViewport() {
    if (!this.viewport.isLive || this.interaction.isPanning || this.trades.length === 0) return;

    const now = Date.now();
    const currentDuration = this.viewport.endTime - this.viewport.startTime;
    if (currentDuration <= 0) return;

    const latestTradeT = this.trades[this.trades.length - 1].T;
    const targetEndTime = Math.max(now, latestTradeT);
    
    // Sync if drifted far (pan/sync)
    if (this.smoothEndTime === null || Math.abs(this.smoothEndTime - this.viewport.endTime) > 50) {
      this.smoothEndTime = this.viewport.endTime;
    }

    const timeLerp = 0.08;
    this.smoothEndTime += (targetEndTime - this.smoothEndTime) * timeLerp;

    if (Math.abs(this.viewport.endTime - this.smoothEndTime) > 1) { 
      this.viewport.endTime = this.smoothEndTime;
      this.viewport.startTime = this.viewport.endTime - currentDuration;
      this.calculatePriceRange();
      this.invalidateCache();
      this.needsRender = true;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#131722"; // Background
    ctx.fillRect(0, 0, this.width, this.height);
    
    if (this.trades.length === 0) return;

    this.drawGrid(ctx);
    this.drawCachedTrades(ctx);
    this.drawNowLine(ctx); // Added current time marker
    this.drawAxes(ctx);
    this.drawCrosshair(ctx);
    this.drawHoverTooltip(ctx);
  }

  drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = "#2a2e39";
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    // Vertical (Time)
    const timeStep = (this.viewport.endTime - this.viewport.startTime) / 6;
    for (let i = 0; i <= 6; i++) {
        const t = this.viewport.startTime + i * timeStep;
        const x = this.mapTimeToX(t);
        ctx.moveTo(x, this.margin.top);
        ctx.lineTo(x, this.margin.top + this.chartH);
    }
    
    // Horizontal (Price)
    const priceStep = (this.viewport.maxPrice - this.viewport.minPrice) / 8;
    for (let i = 0; i <= 8; i++) {
        const p = this.viewport.minPrice + i * priceStep;
        const y = this.mapPriceToY(p);
        ctx.moveTo(this.margin.left, y);
        ctx.lineTo(this.margin.left + this.chartW, y);
    }
    ctx.stroke();
  }

  drawCachedTrades(ctx: CanvasRenderingContext2D) {
    // If we have an offscreen canvas rendering, draw it, else create it
    if (!this.interaction.activeLayer || this.interaction.activeLayer.width !== this.width * window.devicePixelRatio) {
      const ofc = document.createElement("canvas");
      ofc.width = this.width * (window.devicePixelRatio || 1);
      ofc.height = this.height * (window.devicePixelRatio || 1);
      const oCtx = ofc.getContext("2d") as CanvasRenderingContext2D;
      oCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      
      this.drawTrades(oCtx);
      this.interaction.activeLayer = ofc;
    }
    
    ctx.drawImage(this.interaction.activeLayer, 0, 0, this.width, this.height);
  }

  // Debug helper to verify trade coordinates
  getTradeCoords(t: Trade) {
    return {
      x: this.mapTimeToX(t.T),
      y: this.mapPriceToY(t.p)
    };
  }

  drawTrades(ctx: CanvasRenderingContext2D) {
    let maxQ = 0;
    for (const t of this.trades) {
        if (t.q * t.p > maxQ) maxQ = t.q * t.p;
    }

    ctx.save();
    ctx.rect(this.margin.left, this.margin.top, this.chartW, this.chartH);
    ctx.clip(); // Ensure trades don't bleed into axes

    const labelThreshold = Math.max(this.threshold, 35000); // Filtreyi hafif tırmandırdık
    const labelsToDraw: {x: number; y: number; vol: number; text: string; radius: number}[] = [];

    for (const t of this.trades) {
      const x = this.mapTimeToX(t.T);
      const y = this.mapPriceToY(t.p);
      
      // Skip if completely out of bounds
      if (x < this.margin.left - 50 || x > this.margin.left + this.chartW + 50) continue;

      const vol = t.q * t.p;
      
      // Filter out tiny trades for performance when list is huge
      if (vol < 100 && this.trades.length > 5000) continue;

      // Whale Detection Sizing
      const relativeSize = vol / maxQ;
      const sizeMultiplier = 12000; // Much larger area factor
      const radius = Math.max(3, Math.sqrt(relativeSize * sizeMultiplier / Math.PI));
      
      const isBuy = t.side;
      ctx.fillStyle = isBuy ? "rgba(8, 153, 129, 0.85)" : "rgba(242, 54, 69, 0.85)";
      
      // Whale Glow (Aggressive shadow for big trades)
      if (vol > this.threshold * 1.5) {
          ctx.shadowBlur = radius * 2.5;
          ctx.shadowColor = isBuy ? "rgba(8, 255, 129, 0.8)" : "rgba(255, 54, 100, 0.8)";
      } else if (vol > this.threshold) {
          ctx.shadowBlur = radius;
          ctx.shadowColor = isBuy ? "#089981" : "#f23645";
      } else {
          ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Text Labels için listele (Anti-Overlap)
      if (vol >= labelThreshold) {
         const txt = vol >= 1e6 ? (vol/1e6).toFixed(1)+'M' : vol >= 1e3 ? (vol/1e3).toFixed(1)+'k' : vol.toFixed(0);
         labelsToDraw.push({
             x: x, 
             y: y - radius - 8,
             vol: vol,
             text: txt,
             radius: radius
         });
      }
    }

    // 2. AŞAMA: ETİKET ÇİZİMİ & KAVŞAK (OVERLAP) ANALİZİ
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // En büyük hacimli baloncukların etiketlerine öncelik tanı
    labelsToDraw.sort((a, b) => b.vol - a.vol);
    
    const drawnBoxes: {x: number; y: number; w: number; h: number}[] = [];
    
    for (const l of labelsToDraw) {
        ctx.font = `bold ${Math.max(11, l.radius * 0.5)}px Inter`;
        const metrics = ctx.measureText(l.text);
        const w = metrics.width + 10; // Padding
        const h = 16;
        
        let overlap = false;
        for (const b of drawnBoxes) {
            // AABB Çarpışma Testi
            if (Math.abs(l.x - b.x) * 2 < (w + b.w) && Math.abs(l.y - b.y) * 2 < (h + b.h)) {
                overlap = true;
                break;
            }
        }
        
        if (!overlap) {
            ctx.fillText(l.text, l.x, l.y);
            drawnBoxes.push({ x: l.x, y: l.y, w, h });
        }
    }
    
    ctx.restore();
  }

  drawAxes(ctx: CanvasRenderingContext2D) {
    // Price Axis (Right)
    ctx.fillStyle = "#1e222d"; // Panel color
    ctx.fillRect(this.margin.left + this.chartW, 0, this.margin.right, this.height);
    
    ctx.fillStyle = "#787b86";
    ctx.font = "11px Inter";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    
    const priceStep = (this.viewport.maxPrice - this.viewport.minPrice) / 8;
    for (let i = 0; i <= 8; i++) {
        const p = this.viewport.minPrice + i * priceStep;
        const y = this.mapPriceToY(p);
        ctx.fillText(p.toLocaleString(undefined, { maximumFractionDigits: 2 }), this.margin.left + this.chartW + 10, y);
    }

    // Time Axis (Bottom)
    ctx.fillStyle = "#1e222d";
    ctx.fillRect(0, this.margin.top + this.chartH, this.width, this.margin.bottom);
    
    ctx.fillStyle = "#787b86";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    const timeStep = (this.viewport.endTime - this.viewport.startTime) / 6;
    for (let i = 0; i <= 6; i++) {
        const t = this.viewport.startTime + i * timeStep;
        const x = this.mapTimeToX(t);
        const d = new Date(t);
        ctx.fillText(
          `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`, 
          x, this.margin.top + this.chartH + 8
        );
    }
  }

  drawCrosshair(ctx: CanvasRenderingContext2D) {
    const mx = this.interaction.mouseX;
    const my = this.interaction.mouseY;
    
    if (mx > this.margin.left && mx < this.margin.left + this.chartW && my > this.margin.top && my < this.margin.top + this.chartH) {
      ctx.strokeStyle = "rgba(120, 123, 134, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]); // Dashed
      ctx.beginPath();
      ctx.moveTo(this.margin.left, my);
      ctx.lineTo(this.margin.left + this.chartW, my);
      ctx.moveTo(mx, this.margin.top);
      ctx.lineTo(mx, this.margin.top + this.chartH);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Price Label
      const p = this.mapYToPrice(my);
      ctx.fillStyle = "#2962ff";
      ctx.fillRect(this.margin.left + this.chartW, my - 10, this.margin.right, 20);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "11px Inter";
      ctx.fillText(p.toLocaleString(undefined, { maximumFractionDigits: 2 }), this.margin.left + this.chartW + 10, my);

      // Time Label
      const t = this.mapXToTime(mx);
      ctx.fillStyle = "#2962ff";
      ctx.fillRect(mx - 40, this.margin.top + this.chartH, 80, 20);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      const d = new Date(t);
      ctx.fillText(
        `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`, 
        mx, this.margin.top + this.chartH + 10
      );
    }
  }
  
  drawNowLine(ctx: CanvasRenderingContext2D) {
     if (!this.viewport.isLive) return;
     
     const x = this.mapTimeToX(this.viewport.endTime); // Use fixed mapping to endTime
     
     if (x < this.margin.left || x > this.margin.left + this.chartW) return;
     
     ctx.save();
     ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
     ctx.lineWidth = 1;
     ctx.setLineDash([2, 4]);
     ctx.beginPath();
     ctx.moveTo(x, this.margin.top);
     ctx.lineTo(x, this.margin.top + this.chartH);
     ctx.stroke();
     
     // Pulse effect at the intersection
     const p = this.trades.length > 0 ? this.trades[this.trades.length - 1].p : (this.viewport.minPrice + this.viewport.maxPrice) / 2;
     const y = this.mapPriceToY(p);
     
     ctx.setLineDash([]);
     ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
     ctx.beginPath();
     ctx.arc(x, y, 3, 0, Math.PI * 2);
     ctx.fill();
     ctx.restore();
  }

  mapYToPrice(y: number) {
     return this.viewport.minPrice + ((this.margin.top + this.chartH - y) / this.chartH) * (this.viewport.maxPrice - this.viewport.minPrice);
  }

  drawHoverTooltip(ctx: CanvasRenderingContext2D) {
    const mx = this.interaction.mouseX;
    const my = this.interaction.mouseY;
    
    // Only search if mouse is inside chart area
    if (mx <= this.margin.left || mx >= this.margin.left + this.chartW || my <= this.margin.top || my >= this.margin.top + this.chartH) return;

    if (this.trades.length === 0) return;

    const mouseTime = this.mapXToTime(mx);
    // Binary search for closest time
    let l = 0, r = this.trades.length - 1;
    while (l <= r) {
      const m = Math.floor((l + r) / 2);
      if (this.trades[m].T < mouseTime) l = m + 1;
      else r = m - 1;
    }
    
    // Search a radius around the found index to find closest Euclidean distance point
    const searchRadius = 50; 
    const startIdx = Math.max(0, l - searchRadius);
    const endIdx = Math.min(this.trades.length - 1, l + searchRadius);
    
    let closestTrade = null;
    let closestDistSq = Infinity;
    const thresholdDistSq = 400; // 20px threshold

    for (let i = startIdx; i <= endIdx; i++) {
        const t = this.trades[i];
        const tx = this.mapTimeToX(t.T);
        const ty = this.mapPriceToY(t.p);
        
        const dx = tx - mx;
        const dy = ty - my;
        const distSq = dx*dx + dy*dy;
        
        if (distSq < closestDistSq && distSq < thresholdDistSq) {
            closestDistSq = distSq;
            closestTrade = t;
        }
    }

    if (closestTrade) {
        const tx = this.mapTimeToX(closestTrade.T);
        const ty = this.mapPriceToY(closestTrade.p);

        // Highlight ring
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, 8, 0, Math.PI * 2);
        ctx.stroke();

        let tipX = tx + 15;
        let tipY = ty - 15;
        if (tipX > this.width - 150) tipX -= 160;
        if (tipY < 60) tipY += 80;

        // Tooltip Base (Glassmorphism inspired)
        ctx.fillStyle = "rgba(30, 34, 45, 0.8)";
        ctx.strokeStyle = "#363a45";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tipX, tipY, 150, 95, 6); // Uses new standard roundRect
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#d1d4dc";
        ctx.font = "12px Inter";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        
        const d = new Date(closestTrade.T);
        const timeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${(closestTrade.T%1000).toString().padStart(3,'0')}`;
        
        ctx.fillText(`Time: ${timeStr}`, tipX + 10, tipY + 10);
        ctx.fillText(`Price: ${closestTrade.p.toLocaleString()}`, tipX + 10, tipY + 28);
        ctx.fillText(`Qty: ${closestTrade.q.toLocaleString()}`, tipX + 10, tipY + 46);
        ctx.fillText(`Vol: ${(closestTrade.q * closestTrade.p).toLocaleString()}`, tipX + 10, tipY + 64);
        
        // Side Badge
        ctx.fillStyle = closestTrade.side ? "#089981" : "#f23645";
        ctx.font = "bold 11px Inter";
        ctx.fillText(closestTrade.side ? "BUY" : "SELL", tipX + 10, tipY + 82);
    }
  }
}

