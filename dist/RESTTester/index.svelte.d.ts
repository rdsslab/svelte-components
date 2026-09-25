export default Index;
type Index = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const Index: import("svelte").Component<{
    url?: string;
    method?: string;
    limitSizeResponseView?: number;
    methodDisabled?: boolean;
    showExport?: boolean;
    data?: Record<string, any>;
    onchange?: Function;
}, {}, "method" | "url" | "data" | "limitSizeResponseView" | "methodDisabled" | "showExport">;
type $$ComponentProps = {
    url?: string;
    method?: string;
    limitSizeResponseView?: number;
    methodDisabled?: boolean;
    showExport?: boolean;
    data?: Record<string, any>;
    onchange?: Function;
};
