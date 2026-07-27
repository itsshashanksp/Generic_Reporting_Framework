import type { GridOptions } from "ag-grid-community";

export const defaultGridOptions: GridOptions = {
    animateRows: true,

    pagination: true,
    paginationPageSize: 50,

    suppressRowClickSelection: false,

    rowSelection: "multiple",
};