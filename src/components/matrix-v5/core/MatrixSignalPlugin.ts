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

/**
 * Matrix Signal Point (EAL/ESAT)
 */
export interface MatrixSignalData extends CustomData {
    price: number;
    type: 'EAL' | 'ESAT';
    color: string;
    label: string;
}

class MatrixSignalRenderer implements ICustomSeriesPaneRenderer {
    private _data: PaneRendererCustomData<Time, MatrixSignalData> | null = null;

    update(data: PaneRendererCustomData<Time, MatrixSignalData>): void {
        this._data = data;
    }

    draw(
        target: any, // CanvasRenderingTarget2D
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
                if (!data) continue;

                const x = bar.x * horizontalPixelRatio;
                const coordY = priceConverter(data.price);
                if (coordY === null) continue;
                
                const y = coordY * verticalPixelRatio;
                const offset = 25 * verticalPixelRatio;
                const triangleSize = 8 * verticalPixelRatio;

                ctx.fillStyle = data.color;
                ctx.beginPath();
                
                if (data.type === 'EAL') {
                    // Triangle pointing UP (Buy)
                    const ty = y + offset;
                    ctx.moveTo(x, ty);
                    ctx.lineTo(x - triangleSize, ty + triangleSize * 1.5);
                    ctx.lineTo(x + triangleSize, ty + triangleSize * 1.5);
                } else {
                    // Triangle pointing DOWN (Sell)
                    const ty = y - offset;
                    ctx.moveTo(x, ty);
                    ctx.lineTo(x - triangleSize, ty - triangleSize * 1.5);
                    ctx.lineTo(x + triangleSize, ty - triangleSize * 1.5);
                }
                
                ctx.closePath();
                ctx.fill();

                // Draw Signal Text (ESAT/EAL)
                ctx.font = `bold ${Math.floor(10 * verticalPixelRatio)}px Inter`;
                ctx.textAlign = 'center';
                ctx.textBaseline = data.type === 'EAL' ? 'top' : 'bottom';
                const textY = data.type === 'EAL' ? y + offset + triangleSize * 2 : y - offset - triangleSize * 2;
                
                // Add tiny shadow for readability
                ctx.shadowBlur = 4 * verticalPixelRatio;
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.fillText(data.label, x, textY);
                ctx.shadowBlur = 0;
            }
        });
    }
}

export class MatrixSignalPaneView implements ICustomSeriesPaneView<Time, MatrixSignalData> {
    private _renderer: MatrixSignalRenderer = new MatrixSignalRenderer();

    renderer(): ICustomSeriesPaneRenderer {
        return this._renderer;
    }

    update(data: PaneRendererCustomData<Time, MatrixSignalData>, seriesOptions: CustomSeriesOptions): void {
        this._renderer.update(data);
    }

    priceValueBuilder(plotRow: MatrixSignalData): CustomSeriesPricePlotValues {
        return [plotRow.price, plotRow.price, plotRow.price];
    }

    isWhitespace(data: MatrixSignalData | CustomSeriesWhitespaceData<Time>): data is CustomSeriesWhitespaceData<Time> {
        return (data as any).price === undefined;
    }

    defaultOptions(): CustomSeriesOptions {
        return {
            color: '#ffffff',
            priceLineVisible: false,
            lastValueVisible: false,
        } as CustomSeriesOptions;
    }
}
