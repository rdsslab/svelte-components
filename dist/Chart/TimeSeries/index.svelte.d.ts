export default Index;
type Index = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<{
        title?: string;
        data?: unknown[];
        series?: EChartSeriesItem[];
        chart?: EChartInstance;
        tooltipFormatter?: (params: EChartTooltipParams | EChartTooltipParams[]) => string;
        option?: EChartOption;
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
        extra?: Record<string, unknown>;
    }>;
    chart?: {
        setOption: (option: Record<string, unknown>, opts?: Record<string, unknown>) => void;
        resize: () => void;
        dispose: () => void;
        on: (type: string, listener: Function) => void;
        off: (type: string, listener?: Function) => void;
    } | null;
    tooltipFormatter?: (params: {
        seriesName?: string;
        value?: any[];
        dataIndex?: number;
        seriesIndex?: number;
        data?: Record<string, unknown>;
        color?: string;
    } | Array<{
        seriesName?: string;
        value?: any[];
        dataIndex?: number;
        seriesIndex?: number;
        data?: Record<string, unknown>;
        color?: string;
    }>) => string;
    option?: {
        title?: Record<string, unknown>;
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
            extra?: Record<string, unknown>;
        }>;
        tooltip?: Record<string, unknown>;
        legend?: Record<string, unknown>;
        grid?: Record<string, unknown>;
        xAxis?: Record<string, unknown>;
        yAxis?: Record<string, unknown>;
        dataZoom?: Array<Record<string, unknown>>;
        color?: Array<string | number>;
        toolbox?: Record<string, unknown>;
        backgroundColor?: Record<string, unknown>;
        extra?: Record<string, unknown>;
    };
}, {}, "data" | "option" | "title" | "series" | "chart" | "tooltipFormatter">;
/**
 * Un ítem de serie de ECharts.
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
    extra?: Record<string, unknown>;
};
/**
 * Instancia de ECharts.
 */
type EChartInstance = {
    setOption: (option: Record<string, unknown>, opts?: Record<string, unknown>) => void;
    resize: () => void;
    dispose: () => void;
    on: (type: string, listener: Function) => void;
    off: (type: string, listener?: Function) => void;
};
/**
 * Parámetros que recibe el formateador de tooltip de ECharts.
 */
type EChartTooltipParams = {
    seriesName?: string;
    value?: any[];
    dataIndex?: number;
    seriesIndex?: number;
    data?: Record<string, unknown>;
    color?: string;
};
/**
 * Opción de configuración de ECharts (`option`).
 */
type EChartOption = {
    title?: Record<string, unknown>;
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
        extra?: Record<string, unknown>;
    }>;
    tooltip?: Record<string, unknown>;
    legend?: Record<string, unknown>;
    grid?: Record<string, unknown>;
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    dataZoom?: Array<Record<string, unknown>>;
    color?: Array<string | number>;
    toolbox?: Record<string, unknown>;
    backgroundColor?: Record<string, unknown>;
    extra?: Record<string, unknown>;
};
