export default Modal;
type Modal = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<ModalProps & Record<string, any>>): void;
};
declare const Modal: import("svelte").Component<{
    /**
     * - Controls the active/visible state of the modal.
     */
    show?: boolean;
    /**
     * - The Svelte snippet representing the body/content of the modal.
     */
    children?: import("svelte").Snippet;
    /**
     * - Determines if a large top-right closing 'X' button should be displayed.
     */
    showCloseButton?: boolean;
    /**
     * - Whether the modal closes when Escape is pressed.
     */
    closeOnEscape?: boolean;
    /**
     * - Whether the modal closes when clicking the background.
     */
    closeOnBackground?: boolean;
} & Record<string, any>, {}, "show" | "showCloseButton">;
/**
 * Represents the parameters supported by the base Modal component.
 */
type ModalProps = {
    /**
     * - Controls the active/visible state of the modal.
     */
    show?: boolean;
    /**
     * - The Svelte snippet representing the body/content of the modal.
     */
    children?: import("svelte").Snippet;
    /**
     * - Determines if a large top-right closing 'X' button should be displayed.
     */
    showCloseButton?: boolean;
    /**
     * - Whether the modal closes when Escape is pressed.
     */
    closeOnEscape?: boolean;
    /**
     * - Whether the modal closes when clicking the background.
     */
    closeOnBackground?: boolean;
};
