import type { GridApi } from "ag-grid-community";

export function exportCSV(
    api: GridApi,
    fileName = "Report.csv"
) {

    api.exportDataAsCsv({
        fileName,
    });

}

function escapeCSVValue(value: unknown) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportRowsCSV(rows: Record<string, unknown>[], fileName = "Report.csv") {
    if (!rows.length) return;

    const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const csv = [
        columns.map(escapeCSVValue).join(","),
        ...rows.map(row => columns.map(column => escapeCSVValue(row[column])).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}
