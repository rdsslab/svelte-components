export default Index;
type Index = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<JSONViewProps & Record<string, any>>): void;
};
declare const Index: import("svelte").Component<{
    /**
     * - The JSON data to display.
     */
    jsonObject: any;
    /**
     * - Number of spaces for indentation.
     */
    indent?: number;
    /**
     * - Show the copy-to-clipboard button.
     */
    showCopy?: boolean;
    /**
     * - Show line numbers.
     */
    showLineNumbers?: boolean;
    /**
     * - Wrap in a Bulma .box container.
     */
    showBox?: boolean;
    /**
     * - Max height in px before scrolling. 0 = no limit.
     */
    maxHeight?: number;
    /**
     * - Message shown when JSON is empty.
     */
    emptyMessage?: string;
    /**
     * - Optional label/title displayed above the JSON.
     */
    label?: string;
} & Record<string, any>, {}, "jsonObject">;
type JSONViewProps = {
    /**
     * - The JSON data to display.
     */
    jsonObject: any;
    /**
     * - Number of spaces for indentation.
     */
    indent?: number;
    /**
     * - Show the copy-to-clipboard button.
     */
    showCopy?: boolean;
    /**
     * - Show line numbers.
     */
    showLineNumbers?: boolean;
    /**
     * - Wrap in a Bulma .box container.
     */
    showBox?: boolean;
    /**
     * - Max height in px before scrolling. 0 = no limit.
     */
    maxHeight?: number;
    /**
     * - Message shown when JSON is empty.
     */
    emptyMessage?: string;
    /**
     * - Optional label/title displayed above the JSON.
     */
    label?: string;
};
