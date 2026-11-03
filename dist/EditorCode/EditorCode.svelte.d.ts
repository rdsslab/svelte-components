export default EditorCode;
type EditorCode = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
} & {
    setCode: (newCode: any) => void;
    getCode: () => any;
    reset: () => void;
};
declare const EditorCode: import("svelte").Component<{
    code?: any;
    left?: any;
    right?: any;
    lang?: string;
    showFormat?: boolean;
    showSelectLang?: boolean;
    isReadOnly?: boolean;
    showHiddenButton?: boolean;
    showResetButton?: boolean;
    containerTestId?: any;
    onchange?: any;
    showCode?: boolean;
}, {
    setCode: (newCode: any) => void;
    getCode: () => any;
    reset: () => void;
}, "code" | "lang" | "showCode">;
type $$ComponentProps = {
    code?: any;
    left?: any;
    right?: any;
    lang?: string;
    showFormat?: boolean;
    showSelectLang?: boolean;
    isReadOnly?: boolean;
    showHiddenButton?: boolean;
    showResetButton?: boolean;
    containerTestId?: any;
    onchange?: any;
    showCode?: boolean;
};
