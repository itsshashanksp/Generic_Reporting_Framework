import type { ColumnDataType } from "../../types/column";

const DISPLAY_SIGNIFICANT_DIGITS = 15;
export const NULL_DISPLAY_VALUE = "—";

/**
 * Formats finite numeric values for display without changing the source value.
 * Fifteen significant digits retain useful JavaScript-number precision while
 * removing the least-significant binary noise exposed by arithmetic.
 */
export function formatNumberForDisplay(value: number): string {
    if (!Number.isFinite(value)) return String(value);

    if (Number.isInteger(value)) {
        return value.toLocaleString("en-IN");
    }

    const normalized = Number(value.toPrecision(DISPLAY_SIGNIFICANT_DIGITS));
    return normalized.toLocaleString("en-IN", {
        maximumSignificantDigits: DISPLAY_SIGNIFICANT_DIGITS,
    });
}

/** Generic scalar presentation used by grids without altering row data. */
export function formatValueForDisplay(
    value: unknown,
    dataType?: ColumnDataType
): string {
    if (value === null) return NULL_DISPLAY_VALUE;
    if (value === undefined) return "";
    if (typeof value === "number") return formatNumberForDisplay(value);
    if (dataType === "number" && typeof value === "string" && value.trim() !== "") {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) return formatNumberForDisplay(numericValue);
    }
    return String(value);
}
