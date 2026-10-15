import { createGrid, type CsvExportParams, type GridApi } from "ag-grid-community";
import { afterEach, describe, expect, it, vi } from "vitest";

import { exportCSV } from "../csvExport";

describe("current-view CSV export on the community grid", () => {
    let api: GridApi | undefined;

    afterEach(() => {
        api?.destroy();
        document.body.innerHTML = "";
    });

    it("runs on AG Grid Community without Enterprise modules and keeps formatting", async () => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        api = createGrid(container, {
            columnDefs: [
                { field: "Customer", headerName: "Customer" },
                { field: "Sales", headerName: "=Sales", valueFormatter: ({ value }) => Number(value).toLocaleString("en-IN") },
            ],
            rowData: [
                { Customer: "=HYPERLINK(\"http://x\",\"y\")", Sales: -1234567.5 },
                { Customer: "Plain", Sales: 42 },
            ],
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        let csv: string | undefined;
        let fileName: string | undefined;
        const gridApi = api;
        vi.spyOn(gridApi, "exportDataAsCsv").mockImplementation((params?: CsvExportParams) => {
            fileName = typeof params?.fileName === "string" ? params.fileName : undefined;
            csv = gridApi.getDataAsCsv(params);
        });
        const consoleError = vi.spyOn(console, "error");

        exportCSV(gridApi, "current.csv");

        expect(fileName).toBe("current.csv");
        expect(csv?.split("\r\n")).toEqual([
            "\"Customer\",\"'=Sales\"",
            "\"'=HYPERLINK(\"\"http://x\"\",\"\"y\"\")\",\"-12,34,567.5\"",
            "\"Plain\",\"42\"",
        ]);
        expect(consoleError).not.toHaveBeenCalled();
    });
});
