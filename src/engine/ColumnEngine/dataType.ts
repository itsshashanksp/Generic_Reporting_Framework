import type { ColumnDataType, ColumnDefinition } from "../../types/column";

const CURRENCY_FIELD = /(?:^|_)(?:amount|price|mrp|stock_value|minimum_sp|maximum_sp)(?:$|_)|(?:^|_)(?:sale|purchase)_rate(?:$|_)/i;
const CURRENCY_COMPACT_FIELD = /^(?:salesamount|purchaseamount|totalamount|stockvalue|minimumsp|maximumsp|salerate|purchaserate|itemmrp)$/i;
const PERCENTAGE_FIELD = /(?:^|_)(?:percentage|percent|pct|gstpercentage)(?:$|_)/i;

function normalizedField(field: string): string {
    return field
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

/** Conservative semantic fallback used only when authored metadata is absent. */
export function inferColumnDataType(field: string): ColumnDataType | undefined {
    const normalized = normalizedField(field);
    if (PERCENTAGE_FIELD.test(normalized)) return "percentage";
    if (CURRENCY_FIELD.test(normalized) || CURRENCY_COMPACT_FIELD.test(normalized.replaceAll("_", ""))) return "currency";
    return undefined;
}

export function normalizeColumnDataType(column: ColumnDefinition): ColumnDefinition {
    return column.dataType ? column : { ...column, dataType: inferColumnDataType(column.field) };
}
