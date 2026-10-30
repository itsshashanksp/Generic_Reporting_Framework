import type { Cell, SheetData } from "write-excel-file/browser";
import type { ColumnDataType, ColumnDefinition } from "../../types/column";
import { isNumericColumnType } from "../GridEngine/agGridAdapter";

const SHEET_NAME = "Report";
/** Date cell format used by the previous SheetJS `json_to_sheet` export. */
const DATE_FORMAT = "m/d/yy";

function numericFormat(dataType?: ColumnDataType, currency = "INR"): string | undefined {
    if (dataType === "currency") {
        const symbol = new Intl.NumberFormat("en-IN", { style: "currency", currency })
            .formatToParts(0)
            .find(part => part.type === "currency")?.value ?? currency;
        return `${symbol}#,##0.00`;
    }
    if (dataType === "percentage") return '0.00"%"';
    return undefined;
}

function toCell(value: unknown, dataType?: ColumnDataType, currency?: string): Cell {
    if (value === null || value === undefined) return null;
    const declaredNumeric = isNumericColumnType(dataType);
    const numeric = typeof value === "number" ? value
        : declaredNumeric && typeof value === "string" && value.trim() !== "" ? Number(value)
            : Number.NaN;
    if (typeof value === "number" || (declaredNumeric && Number.isFinite(numeric))) {
        return Number.isFinite(numeric)
            ? { type: Number, value: numeric, align: "right", ...(numericFormat(dataType, currency) ? { format: numericFormat(dataType, currency) } : {}) }
            : { type: String, value: String(value), align: "left" };
    }
    if (typeof value === "boolean") return { type: Boolean, value, align: "left" };
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : { type: Date, value, format: DATE_FORMAT, align: "left" };
    }
    // Strings (including numeric-looking text) stay text and are never
    // written as formulas.
    return { type: String, value: String(value), align: "left" };
}

/**
 * One header row of keys in first-seen order across all rows, then one row
 * per record; missing keys become empty cells.
 */
export function getExcelSheetData(rows: Record<string, unknown>[], definitions?: ColumnDefinition[]): SheetData {
    const columns: Array<{ field: string; header: string; dataType?: ColumnDataType; currency?: string }> = definitions?.filter(column => column.visible !== false).map(column => ({
        field: column.field,
        header: column.header,
        dataType: column.dataType,
        currency: column.currency,
    })) ?? [...new Set(rows.flatMap(row => Object.keys(row)))].map(field => ({ field, header: field }));
    return [
        columns.map(column => ({ type: String, value: column.header, align: "left" as const, fontWeight: "bold" as const })),
        ...rows.map(row => columns.map(column => toCell(row[column.field], column.dataType, column.currency))),
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
    fileName = "Report.xlsx",
    columns?: ColumnDefinition[]
): Promise<void> {
    if (!rows.length) {
        return;
    }

    try {
        const { default: writeXlsxFile } = await import("write-excel-file/browser");
        await writeXlsxFile(getExcelSheetData(rows, columns), { sheet: SHEET_NAME }).toFile(fileName);
    } catch (cause: unknown) {
        throw new ExportFileError("The Excel file could not be created.", { cause });
    }
}
