export default Index;
type Index = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<{
        title?: string;
        data?: unknown[];
        series?: EChartSeriesItem[];
        option?: Record<string, unknown>;
        chart?: EChartInstance;
    }>): void;
};
declare const Index: import("svelte").Component<{
    title?: string;
    data?: Array<unknown>;
    series?: Array<{
        type?: string;
        name?: string;
        showSymbol?: boolean;
        smooth?: boolean;
        large?: boolean;
        data?: Array<{
            value: any[];
            name?: string;
        }>;
        itemStyle?: Record<string, unknown>;
        lineStyle?: Record<string, unknown>;
        emphasis?: Record<string, unknown>;
        encode?: Record<string, unknown>;
        markPoint?: Record<string, unknown>;
        markLine?: Record<string, unknown>;
        markArea?: Record<string, unknown>;
        z?: Record<string, unknown>;
        zlevel?: Record<string, unknown>;
        /**
         * Cualquier otra propiedad válida de ECharts.
         */
        extra?: Record<string, unknown>;
    }>;
    option?: Record<string, unknown>;
    chart?: {
        setOption: (option: Record<string, unknown>, opts?: Record<string, unknown>) => void;
        resize: () => void;
        dispose: () => void;
        on: (type: string, listener: Function) => void;
        off: (type: string, listener?: Function) => void;
    } | null;
}, {}, "data" | "option" | "title" | "series" | "chart">;
/**
 * Un ítem de serie de ECharts. El consumidor puede enviar cualquier
 * configuración de serie (type, data, itemStyle, lineStyle, etc.) y el
 * componente le añade los valores por defecto (line, smooth, large).
 */
type EChartSeriesItem = {
    type?: string;
    name?: string;
    showSymbol?: boolean;
    smooth?: boolean;
    large?: boolean;
    data?: Array<{
        value: any[];
        name?: string;
    }>;
    itemStyle?: Record<string, unknown>;
    lineStyle?: Record<string, unknown>;
    emphasis?: Record<string, unknown>;
    encode?: Record<string, unknown>;
    markPoint?: Record<string, unknown>;
    markLine?: Record<string, unknown>;
    markArea?: Record<string, unknown>;
    z?: Record<string, unknown>;
    zlevel?: Record<string, unknown>;
    /**
     * Cualquier otra propiedad válida de ECharts.
     */
    extra?: Record<string, unknown>;
};
/**
 * Instancia de ECharts. Expone los métodos que usa el componente.
 */
type EChartInstance = {
    setOption: (option: Record<string, unknown>, opts?: Record<string, unknown>) => void;
    resize: () => void;
    dispose: () => void;
    on: (type: string, listener: Function) => void;
    off: (type: string, listener?: Function) => void;
};
