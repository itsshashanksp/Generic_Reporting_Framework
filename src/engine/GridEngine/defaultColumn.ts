import type { ColDef } from "ag-grid-community";

export const defaultColumn: ColDef = {
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
    flex: 1,
    minWidth: 150,
};