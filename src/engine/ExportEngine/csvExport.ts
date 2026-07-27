import type { GridApi } from "ag-grid-community";

export function exportCSV(api: GridApi) {

    api.exportDataAsCsv({
        fileName: "Report.csv",
    });

}