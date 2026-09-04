export default Index;
type Index = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<MarkdownViewerProps & Record<string, any>>): void;
};
declare const Index: import("svelte").Component<{
    /**
     * - The raw Markdown string to render.
     */
    markdown?: string;
    /**
     * - Additional CSS class(es) for the wrapper div.
     */
    content_class?: string;
    /**
     * - Whether raw HTML in Markdown is rendered. When false, raw HTML is escaped and rendered as plain text (prevents XSS).
     */
    allow_html?: boolean;
    /**
     * - Enable GitHub Flavored Markdown (tables, task lists, etc.).
     */
    gfm?: boolean;
    /**
     * - Convert line breaks to <br>.
     */
    breaks?: boolean;
    /**
     * - Wrap content in a Bulma .box container.
     */
    showBox?: boolean;
    /**
     * - Message shown when markdown is empty. Empty string = render nothing.
     */
    empty_message?: string;
    /**
     * - Additional options passed to marked. Note: a safe renderer always takes precedence for security.
     */
    options?: import("marked").MarkedOptions;
} & Record<string, any>, {}, "markdown" | "content_class">;
type MarkdownViewerProps = {
    /**
     * - The raw Markdown string to render.
     */
    markdown?: string;
    /**
     * - Additional CSS class(es) for the wrapper div.
     */
    content_class?: string;
    /**
     * - Whether raw HTML in Markdown is rendered. When false, raw HTML is escaped and rendered as plain text (prevents XSS).
     */
    allow_html?: boolean;
    /**
     * - Enable GitHub Flavored Markdown (tables, task lists, etc.).
     */
    gfm?: boolean;
    /**
     * - Convert line breaks to <br>.
     */
    breaks?: boolean;
    /**
     * - Wrap content in a Bulma .box container.
     */
    showBox?: boolean;
    /**
     * - Message shown when markdown is empty. Empty string = render nothing.
     */
    empty_message?: string;
    /**
     * - Additional options passed to marked. Note: a safe renderer always takes precedence for security.
     */
    options?: import("marked").MarkedOptions;
};
