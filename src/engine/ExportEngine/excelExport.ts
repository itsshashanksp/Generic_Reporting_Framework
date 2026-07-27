import type { GridApi } from "ag-grid-community";

export function exportExcel(api: GridApi) {

    api.exportDataAsExcel({
        fileName: "Report.xlsx",
    });

}