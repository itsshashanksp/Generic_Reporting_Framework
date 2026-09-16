import type { ColumnDataType } from "../../types/column";

const DISPLAY_SIGNIFICANT_DIGITS = 15;
const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;
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

function formatDateForDisplay(value: string, includeTime: boolean): string {
    const match = ISO_DATE_TIME_PATTERN.exec(value.trim());
    if (!match) return value;

    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = hourText === undefined ? undefined : Number(hourText);
    const minute = minuteText === undefined ? undefined : Number(minuteText);
    const second = secondText === undefined ? undefined : Number(secondText);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    if (
        month < 1 || month > 12
        || day < 1 || day > daysInMonth
        || (hour !== undefined && (hour < 0 || hour > 23))
        || (minute !== undefined && (minute < 0 || minute > 59))
        || (second !== undefined && (second < 0 || second > 59))
    ) {
        return value;
    }

    const date = `${dayText} ${MONTH_NAMES[month - 1]} ${yearText}`;
    if (!includeTime || hour === undefined || minute === undefined) return date;

    // Preserve the encoded wall-clock fields. A trailing offset/Z is metadata
    // for the backend value and must not shift presentation into another zone.
    return `${date}, ${hourText}:${minuteText}:${secondText ?? "00"}`;
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
    if ((dataType === "date" || dataType === "datetime") && typeof value === "string") {
        return formatDateForDisplay(value, dataType === "datetime");
    }
    return String(value);
}
