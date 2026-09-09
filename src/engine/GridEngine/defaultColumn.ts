import type { ColDef } from "ag-grid-community";

export const defaultColumn: ColDef = {
    sortable: true,
    filter: false,
    floatingFilter: false,
    unSortIcon: true,
    resizable: true,
    suppressMovable: false,
    initialFlex: 1,
    minWidth: 150,
};
