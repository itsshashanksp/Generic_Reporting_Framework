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

/** Validate one runtime value before it becomes applied request state. */
export function getFilterValueError(
    filter: Pick<FilterDefinition, "label" | "type" | "operator" | "required">,
    value: FilterValue
): string | null {
    const empty = isEmptyFilterValue(value);
    if (empty) {
        return filter.required ? `${filter.label} is required.` : null;
    }

    const rangeOperator = filter.operator === "between" || filter.operator === "notBetween";
    if (filter.type === "daterange" || filter.type === "number" && rangeOperator) {
        if (!Array.isArray(value) || value.length !== 2 || value.some(isBlank)) {
            return `${filter.label} requires both a lower and an upper value.`;
        }

        if (filter.type === "daterange") {
            const [start, end] = value;
            if (!isValidDateValue(start) || !isValidDateValue(end)) {
                return `${filter.label} requires valid start and end dates.`;
            }
            if (String(start) > String(end)) {
                return `${filter.label} start date must not be after its end date.`;
            }
        } else {
            const [minimum, maximum] = value.map(toFiniteNumber);
            if (minimum === null || maximum === null) {
                return `${filter.label} requires valid finite numbers.`;
            }
            if (minimum > maximum) {
                return `${filter.label} minimum must not be greater than its maximum.`;
            }
        }
        return null;
    }

    if (filter.type === "date" && !isValidDateValue(value)) {
        return `${filter.label} requires a valid date.`;
    }

    if (filter.type === "number" && toFiniteNumber(value) === null) {
        return `${filter.label} requires a valid finite number.`;
    }

    return null;
}

export function getFilterValueErrors(
    definitions: FilterDefinition[],
    values: Record<string, FilterValue>
) {
    return definitions.flatMap(filter => {
        const error = getFilterValueError(filter, values[filter.field]);
        return error ? [error] : [];
    });
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function isValidDateValue(value: unknown): boolean {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}
