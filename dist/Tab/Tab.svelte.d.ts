export default Tab;
type Tab = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<{
        classSize?: string;
        onselect?: (e: {
            label: string;
            index: number;
            alias?: string;
        }) => void;
        tabs?: TabItem[];
        active?: number;
        children?: Snippet<[]>;
    }>): void;
};
declare const Tab: import("svelte").Component<{
    classSize?: string;
    onselect?: (e: {
        label: string;
        index: number;
        alias?: string;
    }) => void;
    tabs?: {
        /**
         * - Display text for the tab.
         */
        label: string;
        /**
         * - Bulma/FontAwesome icon class (e.g., 'fas fa-home').
         */
        classIcon?: string;
        /**
         * - Whether the tab is disabled.
         */
        disabled?: boolean;
        /**
         * - Snippet rendered as tab content.
         */
        component?: import("svelte").Snippet;
        /**
         * - Optional alias passed to the onselect callback.
         */
        alias?: string;
    }[];
    active?: number;
    children?: import("svelte").Snippet;
}, {}, "classSize" | "tabs" | "active">;
type TabItem = {
    /**
     * - Display text for the tab.
     */
    label: string;
    /**
     * - Bulma/FontAwesome icon class (e.g., 'fas fa-home').
     */
    classIcon?: string;
    /**
     * - Whether the tab is disabled.
     */
    disabled?: boolean;
    /**
     * - Snippet rendered as tab content.
     */
    component?: import("svelte").Snippet;
    /**
     * - Optional alias passed to the onselect callback.
     */
    alias?: string;
};
