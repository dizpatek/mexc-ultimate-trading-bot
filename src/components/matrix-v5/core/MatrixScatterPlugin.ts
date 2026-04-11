import {
    CustomData,
    CustomSeriesOptions,
    CustomSeriesPricePlotValues,
    CustomSeriesWhitespaceData,
    ICustomSeriesPaneRenderer,
    ICustomSeriesPaneView,
    PaneRendererCustomData,
    PriceToCoordinateConverter,
    Time,
} from 'lightweight-charts';

export interface MatrixBubbleDef {
    price: number;
    size: number;
    color: string;
    label?: string;
    side: number;
}

export interface MatrixScatterData extends CustomData {
    price: number; // Anchor price for internal Lightweight Charts validation
    bubbles: MatrixBubbleDef[];
}

class MatrixScatterRenderer implements ICustomSeriesPaneRenderer {
    private _data: PaneRendererCustomData<Time, MatrixScatterData> | null = null;

    update(data: PaneRendererCustomData<Time, MatrixScatterData>): void {
        this._data = data;
    }

    draw(
        target: any, 
        priceConverter: PriceToCoordinateConverter,
        isHovered: boolean,
        hitTestData?: unknown
    ): void {
        if (!this._data || this._data.bars.length === 0) return;

        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const horizontalPixelRatio = scope.horizontalPixelRatio;
            const verticalPixelRatio = scope.verticalPixelRatio;

            for (const bar of this._data!.bars) {
                const data = bar.originalData;
                if (!data || !data.bubbles) continue;

                const x = bar.x * horizontalPixelRatio;
                
                for (const bubble of data.bubbles) {
                    const coordY = priceConverter(bubble.price);
                    if (coordY === null) continue;
                    
                    const y = coordY * verticalPixelRatio;
                    const radius = bubble.size * verticalPixelRatio;

                    if (bubble.size > 20) {
                        ctx.shadowBlur = radius * 1.2;
                        ctx.shadowColor = bubble.color;
                    } else {
                        ctx.shadowBlur = 0;
                    }

                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fillStyle = bubble.color;
                    ctx.fill();

                    if (bubble.label && bubble.size > 12) {
                        ctx.shadowBlur = 0;
                        ctx.fillStyle = 'white';
                        // Text'in aşırı büyümesini engellemek için max 12px sınır;
                        const fontSize = Math.min(Math.floor(radius * 0.7), 12 * verticalPixelRatio);
                        ctx.font = `bold ${fontSize}px Inter`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(bubble.label, x, y);
                    }
                }
            }
        });
    }
}

export class MatrixScatterPaneView implements ICustomSeriesPaneView<Time, MatrixScatterData> {
    private _renderer: MatrixScatterRenderer = new MatrixScatterRenderer();

    renderer(): ICustomSeriesPaneRenderer {
        return this._renderer;
    }

    update(data: PaneRendererCustomData<Time, MatrixScatterData>, seriesOptions: CustomSeriesOptions): void {
        this._renderer.update(data);
    }

    priceValueBuilder(plotRow: MatrixScatterData): CustomSeriesPricePlotValues {
        return [plotRow.price, plotRow.price, plotRow.price];
    }

    isWhitespace(data: MatrixScatterData | CustomSeriesWhitespaceData<Time>): data is CustomSeriesWhitespaceData<Time> {
        return (data as any).bubbles === undefined || (data as any).bubbles.length === 0;
    }

    defaultOptions(): CustomSeriesOptions {
        return {
            color: '#ff00ff', 
            priceLineVisible: false,
            lastValueVisible: false,
        } as CustomSeriesOptions;
    }
}
