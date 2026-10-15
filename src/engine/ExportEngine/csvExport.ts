import type { GridApi } from "ag-grid-community";

/**
 * A formula trigger (including full-width forms) after any leading whitespace
 * or control characters, which some spreadsheet importers strip before
 * evaluating the cell.
 */
const FORMULA_TRIGGER = /^[\s\p{Cc}\p{Cf}]*[=+\-@＝＋－＠]|^[\t\r\n]/u;
/** Plain or display-formatted numbers (en-IN grouping), e.g. -12,34,567.5 or 1e-7. */
const NUMERIC_TEXT = /^[+-]?(?:\d+(?:,\d+)*(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Prevents spreadsheet applications from evaluating exported text as a
 * formula (CSV/formula injection) by prefixing an apostrophe. Numeric values
 * and numeric text keep their value so they still open as numbers.
 */
export function neutralizeSpreadsheetFormula(value: unknown): string {
    const text = String(value ?? "");
    if ((typeof value === "number" && Number.isFinite(value)) || typeof value === "bigint" || NUMERIC_TEXT.test(text.trim())) {
        return text;
    }
    return FORMULA_TRIGGER.test(text) ? `'${text}` : text;
}

export function exportCSV(
    api: GridApi,
    fileName = "Report.csv"
) {

    api.exportDataAsCsv({
        fileName,
        // Keep the grid's displayed formatting, then neutralize formulas.
        processCellCallback: params => neutralizeSpreadsheetFormula(params.formatValue(params.value)),
        processHeaderCallback: params => neutralizeSpreadsheetFormula(
            params.api.getDisplayNameForColumn(params.column, "csv")
        ),
    });

}

function escapeCSVValue(value: unknown) {
    const text = neutralizeSpreadsheetFormula(value);
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
