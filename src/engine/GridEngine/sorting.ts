import type { ColumnDataType } from "../../types/column";

function isEmptySortValue(value: unknown): value is null | undefined | "" {
    return value === null || value === undefined || value === "";
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string" || value.trim() === "") return null;

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Compares grid values using only the column's declared presentation type.
 * Numeric-looking text is intentionally treated as numeric only for number columns.
 */
export function compareGridValues(
    left: unknown,
    right: unknown,
    dataType?: ColumnDataType,
): number {
    const leftIsEmpty = isEmptySortValue(left);
    const rightIsEmpty = isEmptySortValue(right);

    if (leftIsEmpty || rightIsEmpty) {
        if (leftIsEmpty && rightIsEmpty) return 0;
        return leftIsEmpty ? 1 : -1;
    }

    if (dataType === "number") {
        const leftNumber = toFiniteNumber(left);
        const rightNumber = toFiniteNumber(right);

        if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
    }

    // Dates arrive as sortable ISO strings; preserving their lexical comparison also
    // avoids applying locale numeric collation to date fragments.
    return String(left).localeCompare(String(right), undefined, { sensitivity: "base" });
}
