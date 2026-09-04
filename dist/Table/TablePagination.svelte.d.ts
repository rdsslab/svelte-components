export default TablePagination;
type TablePagination = {
    $on?(type: string, callback: (e: any) => void): () => void;
    $set?(props: Partial<$$ComponentProps>): void;
};
declare const TablePagination: import("svelte").Component<{
    pageSelected?: number;
    totalPages?: number;
    totalFilteredRows?: number;
    pageSize?: any[];
    pageSizeSelected?: number;
    visiblePages?: any[];
    onPageChange?: Function;
    onPageSizeChange?: Function;
}, {}, "">;
type $$ComponentProps = {
    pageSelected?: number;
    totalPages?: number;
    totalFilteredRows?: number;
    pageSize?: any[];
    pageSizeSelected?: number;
    visiblePages?: any[];
    onPageChange?: Function;
    onPageSizeChange?: Function;
};
