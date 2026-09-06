import type { FilterValue } from "../FilterContext";

function isBlank(value: unknown) {
    return value === "" || value === null || value === undefined;
}

/** A range is empty only when neither endpoint has a value. */
export function isEmptyFilterValue(value: FilterValue) {
    return Array.isArray(value)
        ? value.length === 0 || value.every(isBlank)
        : isBlank(value);
}
