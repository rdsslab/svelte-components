export default Index;
type Index = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
} & {
    toggleSidebar: () => void;
};
declare const Index: import("svelte").Component<{
    logoText?: string;
    logoIcon?: () => ReturnType<import("svelte").Snippet>;
    isMobile?: boolean;
    sidebarState?: string;
    menu?: any[];
}, {
    toggleSidebar: () => void;
}, "menu" | "logoText" | "logoIcon" | "sidebarState" | "isMobile">;
type $$ComponentProps = {
    logoText?: string;
    logoIcon?: () => ReturnType<import("svelte").Snippet>;
    isMobile?: boolean;
    sidebarState?: string;
    menu?: any[];
};
