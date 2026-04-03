/**
 * T5.js (Trading 5) - Core Engine
 * A lightweight, high-performance canvas library engineered for financial data.
 */

export class T5 {
    container: HTMLElement;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    dpr: number;
    
    private _isLooping: boolean;
    private _frameCount: number;
    private _animationFrameId: number | null;

    mouseX: number;
    mouseY: number;
    pmouseX: number;
    pmouseY: number;
    mouseIsPressed: boolean;
    lastSyncTime: number;

    viewport: {
        startTime: number;
        endTime: number;
        minPrice: number;
        maxPrice: number;
        padding: { top: number; right: number; bottom: number; left: number };
    };

    // Lifecycle hooks
    setup: () => void = () => {};
    draw: () => void = () => {};
    mouseMoved: (e: MouseEvent) => void = () => {};
    mouseDragged: (e: MouseEvent) => void = () => {};
    mousePressed: (e: MouseEvent) => void = () => {};
    mouseReleased: (e: MouseEvent) => void = () => {};

    constructor(container: HTMLDivElement) {
        this.container = container;
        
        // Setup Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
        
        this.width = 0;
        this.height = 0;
        this.dpr = window.devicePixelRatio || 1;

        this._isLooping = true;
        this._frameCount = 0;
        this._animationFrameId = null;

        this.mouseX = 0;
        this.mouseY = 0;
        this.pmouseX = 0;
        this.pmouseY = 0;
        this.mouseIsPressed = false;
        this.lastSyncTime = 0;

        this.viewport = {
            startTime: 0,
            endTime: 0,
            minPrice: 0,
            maxPrice: 0,
            padding: { top: 20, right: 70, bottom: 30, left: 10 }
        };

        this._loop = this._loop.bind(this);
        this._handleResize = this._handleResize.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);

        window.addEventListener('resize', this._handleResize);
        this.canvas.addEventListener('mousemove', this._handleMouseMove);
        this.canvas.addEventListener('mousedown', this._handleMouseDown);
        window.addEventListener('mouseup', this._handleMouseUp);
    }

    init() {
        this._handleResize();
        this.setup();
        this._loop();
    }

    destroy() {
        this.noLoop();
        window.removeEventListener('resize', this._handleResize);
        this.canvas.removeEventListener('mousemove', this._handleMouseMove);
        this.canvas.removeEventListener('mousedown', this._handleMouseDown);
        window.removeEventListener('mouseup', this._handleMouseUp);
        if (this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }
    }

    private _loop() {
        if (this._isLooping) {
            this.draw();
            this._frameCount++;
            this.pmouseX = this.mouseX;
            this.pmouseY = this.mouseY;
            this._animationFrameId = requestAnimationFrame(this._loop);
        }
    }

    noLoop() {
        this._isLooping = false;
        if (this._animationFrameId) {
            cancelAnimationFrame(this._animationFrameId);
            this._animationFrameId = null;
        }
    }

    loop() {
        if (!this._isLooping) {
            this._isLooping = true;
            this._loop();
        }
    }

    private _handleResize() {
        const parent = this.container;
        this.width = parent.clientWidth;
        this.height = parent.clientHeight;

        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
    }

    private _handleMouseMove(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;

        if (this.mouseIsPressed) {
            this.mouseDragged(e);
        } else {
            this.mouseMoved(e);
        }
    }

    private _handleMouseDown(e: MouseEvent) {
        this.mouseIsPressed = true;
        this.mousePressed(e);
    }

    private _handleMouseUp(e: MouseEvent) {
        this.mouseIsPressed = false;
        this.mouseReleased(e);
    }

    // --- Drawing API ---

    background(colorStr: string) {
        this.ctx.fillStyle = colorStr;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    fill(colorStr: string) {
        this.ctx.fillStyle = colorStr;
    }

    noFill() {
        this.ctx.fillStyle = 'transparent';
    }

    stroke(colorStr: string) {
        this.ctx.strokeStyle = colorStr;
    }

    noStroke() {
        this.ctx.strokeStyle = 'transparent';
    }

    strokeWeight(w: number) {
        this.ctx.lineWidth = w;
    }

    line(x1: number, y1: number, x2: number, y2: number) {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }

    rect(x: number, y: number, w: number, h: number) {
        if (this.ctx.fillStyle !== 'transparent') this.ctx.fillRect(x, y, w, h);
        if (this.ctx.strokeStyle !== 'transparent') this.ctx.strokeRect(x, y, w, h);
    }

    text(str: string, x: number, y: number) {
        this.ctx.fillText(str, x, y);
    }

    textSize(size: number, font = 'Inter, sans-serif') {
        this.ctx.font = `${size}px ${font}`;
    }

    textAlign(align: CanvasTextAlign, baseline: CanvasTextBaseline = 'alphabetic') {
        this.ctx.textAlign = align;
        this.ctx.textBaseline = baseline;
    }

    // --- Trading Projections ---

    map(val: number, start1: number, stop1: number, start2: number, stop2: number) {
        return start2 + (stop2 - start2) * ((val - start1) / (stop1 - start1));
    }

    timeToX(timestamp: number) {
        const w = this.width - this.viewport.padding.left - this.viewport.padding.right;
        return this.viewport.padding.left + this.map(timestamp, this.viewport.startTime, this.viewport.endTime, 0, w);
    }

    priceToY(price: number) {
        const h = this.height - this.viewport.padding.top - this.viewport.padding.bottom;
        // Y inverted
        return this.viewport.padding.top + this.map(price, this.viewport.minPrice, this.viewport.maxPrice, h, 0);
    }

    xToTime(x: number) {
        const w = this.width - this.viewport.padding.left - this.viewport.padding.right;
        return this.map(x - this.viewport.padding.left, 0, w, this.viewport.startTime, this.viewport.endTime);
    }

    candle(x: number, open: number, high: number, low: number, close: number, upC = '#089981', downC = '#f23645', w = 4) {
        const isUp = close >= open;
        const col = isUp ? upC : downC;
        
        const yO = this.priceToY(open);
        const yC = this.priceToY(close);
        const yH = this.priceToY(high);
        const yL = this.priceToY(low);

        this.stroke(col);
        this.fill(col);
        this.strokeWeight(1);

        // Wick
        this.line(x, yH, x, yL);

        // Body
        const top = Math.min(yO, yC);
        const bottom = Math.max(yO, yC);
        const h = Math.max(bottom - top, 1);
        
        this.rect(x - w/2, top, w, h);
    }
}
