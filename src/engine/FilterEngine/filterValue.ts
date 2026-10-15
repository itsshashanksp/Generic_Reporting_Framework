import type { FilterValue } from "../FilterContext";
import type { FilterDefinition } from "../../types/filter";

function isBlank(value: unknown) {
    return value === "" || value === null || value === undefined;
}

/** A range is empty only when neither endpoint has a value. */
export function isEmptyFilterValue(value: FilterValue) {
    return Array.isArray(value)
        ? value.length === 0 || value.every(isBlank)
        : isBlank(value);
}

/**
 * Whether a required filter still needs a value: a date range needs both its
 * start and its end, so a partial range never satisfies it.
 */
export function isRequiredFilterIncomplete(
    filter: Pick<FilterDefinition, "required" | "type">,
    value: FilterValue
) {
    if (!filter.required) return false;
    if (filter.type === "daterange") {
        return !Array.isArray(value) || value.length !== 2 || value.some(isBlank);
    }
    return isEmptyFilterValue(value);
}
