import { afterEach, describe, expect, it, vi } from "vitest";
import type { GridApi } from "ag-grid-community";

import { exportCSV, exportRowsCSV, neutralizeSpreadsheetFormula } from "../csvExport";

async function captureRowsCsv(rows: Record<string, unknown>[]): Promise<string> {
    let blob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation(value => {
        blob = value as Blob;
        return "blob:csv";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    exportRowsCSV(rows, "report.csv");

    return blob!.text();
}

describe("CSV formula injection protection", () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
        ["=HYPERLINK(\"http://x\",\"y\")", "'=HYPERLINK(\"http://x\",\"y\")"],
        ["+SUM(A1:A2)", "'+SUM(A1:A2)"],
        ["-2+3+cmd|' /C calc'!A0", "'-2+3+cmd|' /C calc'!A0"],
        ["@SUM(A1)", "'@SUM(A1)"],
        ["\t=1+1", "'\t=1+1"],
        ["\r=1+1", "'\r=1+1"],
        ["-", "'-"],
        [" =1+1", "' =1+1"],
        ["   +SUM(A1)", "'   +SUM(A1)"],
        ["\n=1+1", "'\n=1+1"],
        ["\n", "'\n"],
        ["\u0000=1+1", "'\u0000=1+1"],
        ["\u00a0=1+1", "'\u00a0=1+1"],
        ["\u200b=1+1", "'\u200b=1+1"],
        ["\ufeff@SUM(A1)", "'\ufeff@SUM(A1)"],
        ["＝1+1", "'＝1+1"],
        ["＋1", "'＋1"],
        ["－1+1", "'－1+1"],
        ["＠SUM(A1)", "'＠SUM(A1)"],
        ["=cmd|' /C calc'!A0", "'=cmd|' /C calc'!A0"],
        ["- 12", "'- 12"],
        [-Infinity, "'-Infinity"],
    ])("neutralizes formula text %j", (value, expected) => {
        expect(neutralizeSpreadsheetFormula(value)).toBe(expected);
    });

    it.each([
        [-12.5, "-12.5"],
        [0, "0"],
        ["-12.5", "-12.5"],
        ["+7", "+7"],
        ["-12,34,567.5", "-12,34,567.5"],
        ["1,234", "1,234"],
        ["-.5", "-.5"],
        ["1e-7", "1e-7"],
        ["Customer = A", "Customer = A"],
        ["a@b.example", "a@b.example"],
        ["30/06/2021", "30/06/2021"],
        [" -12.5 ", " -12.5 "],
        ["\t-12.5", "\t-12.5"],
        [12345678901234567890n, "12345678901234567890"],
        [Infinity, "Infinity"],
        [NaN, "NaN"],
        [true, "true"],
        ["'=already text", "'=already text"],
        ["A=1", "A=1"],
        ["E-mail", "E-mail"],
        [null, ""],
        [undefined, ""],
    ])("preserves the normal value %s", (value, expected) => {
        expect(neutralizeSpreadsheetFormula(value)).toBe(expected);
    });

    it("neutralizes formulas in the all-rows CSV while keeping numbers and quoting", async () => {
        const csv = await captureRowsCsv([
            { Customer: "=HYPERLINK(\"http://x\",\"y\")", Amount: -1250.5, Note: "a, \"quoted\" note" },
            { Customer: "Plain", Amount: "-12,34,567.5", Note: "@cmd" },
        ]);

        expect(csv.split("\r\n")).toEqual([
            "Customer,Amount,Note",
            "\"'=HYPERLINK(\"\"http://x\"\",\"\"y\"\")\",-1250.5,\"a, \"\"quoted\"\" note\"",
            "Plain,\"-12,34,567.5\",'@cmd",
        ]);
    });

    it("neutralizes formula headers in the all-rows CSV", async () => {
        const csv = await captureRowsCsv([{ "=Header": "value" }]);
        expect(csv.split("\r\n")[0]).toBe("'=Header");
    });

    it("sanitizes formatted cells and headers in the current-view grid CSV", () => {
        const exportDataAsCsv = vi.fn();
        const api = {
            exportDataAsCsv,
            getDisplayNameForColumn: vi.fn((column: { name: string }) => column.name),
        } as unknown as GridApi;

        exportCSV(api, "current.csv");

        const params = exportDataAsCsv.mock.calls[0][0];
        expect(params.fileName).toBe("current.csv");
        const formatValue = vi.fn((value: unknown) => typeof value === "number" ? value.toLocaleString("en-IN") : String(value));
        expect(params.processCellCallback({ value: "=1+1", formatValue })).toBe("'=1+1");
        expect(params.processCellCallback({ value: -1234567.5, formatValue })).toBe("-12,34,567.5");
        expect(params.processCellCallback({ value: "Alpha", formatValue })).toBe("Alpha");
        expect(formatValue).toHaveBeenCalledWith(-1234567.5);
        expect(params.processHeaderCallback({ api, column: { name: "@Total" } })).toBe("'@Total");
        expect(params.processHeaderCallback({ api, column: { name: "Total" } })).toBe("Total");
        expect(api.getDisplayNameForColumn).toHaveBeenCalledWith({ name: "Total" }, "csv");
    });
});
