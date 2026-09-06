import type { GridOptions } from "ag-grid-community";

export const defaultGridOptions: GridOptions = {
    animateRows: true,
    maintainColumnOrder: true,
    suppressColumnMoveAnimation: false,
    suppressDragLeaveHidesColumns: true,
    suppressMovableColumns: false,

    pagination: true,
    paginationPageSize: 50,

    suppressRowClickSelection: false,

    rowSelection: "multiple",
};
