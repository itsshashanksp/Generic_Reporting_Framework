import type { Cell, SheetData } from "write-excel-file/browser";

const SHEET_NAME = "Report";
/** Date cell format used by the previous SheetJS `json_to_sheet` export. */
const DATE_FORMAT = "m/d/yy";

function toCell(value: unknown): Cell {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
        return Number.isFinite(value) ? { type: Number, value } : { type: String, value: String(value) };
    }
    if (typeof value === "boolean") return { type: Boolean, value };
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : { type: Date, value, format: DATE_FORMAT };
    }
    // Strings (including numeric-looking text) stay text and are never
    // written as formulas.
    return { type: String, value: String(value) };
}

/**
 * One header row of keys in first-seen order across all rows, then one row
 * per record; missing keys become empty cells.
 */
export function getExcelSheetData(rows: Record<string, unknown>[]): SheetData {
    const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    return [
        columns.map(column => ({ type: String, value: column })),
        ...rows.map(row => columns.map(column => toCell(row[column]))),
    ];
}

/** A local failure while creating or saving an export file. */
export class ExportFileError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "ExportFileError";
    }
}

export async function exportExcel(
    rows: Record<string, unknown>[],
    fileName = "Report.xlsx"
): Promise<void> {
    if (!rows.length) {
        return;
    }

    try {
        const { default: writeXlsxFile } = await import("write-excel-file/browser");
        await writeXlsxFile(getExcelSheetData(rows), { sheet: SHEET_NAME }).toFile(fileName);
    } catch (cause: unknown) {
        throw new ExportFileError("The Excel file could not be created.", { cause });
    }
}
