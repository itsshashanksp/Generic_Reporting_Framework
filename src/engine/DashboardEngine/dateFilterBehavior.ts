import { isEmptyFilterValue } from "../FilterEngine/filterValue";
import type { FilterValues } from "../FilterContext";
import type { DashboardDateFilterBehavior } from "../../types/dashboard";
import type { FilterDefinition } from "../../types/filter";

export const dashboardDateFilterBehaviors = ["required", "optional"] as const;

/**
 * Shared filters with the dashboard's `dateFilterBehavior` applied:
 * `"required"` makes every shared date range required, so the dashboard loads
 * only after Search applies both dates. `"optional"` and an omitted behavior
 * leave the filters as configured. The input is never mutated.
 */
export function applyDateFilterBehavior(
    filters: FilterDefinition[],
    behavior: DashboardDateFilterBehavior | undefined
): FilterDefinition[] {
    if (behavior !== "required") return filters;
    return filters.map(filter => filter.type === "daterange" ? { ...filter, required: true } : filter);
}

/**
 * Date ranges that Search must refuse under `"optional"`: a range with only
 * one of its two dates. An empty range applies no date filter. Required
 * filters (including every range under `"required"`) are checked separately.
 */
export function getPartialDateRanges(
    filters: FilterDefinition[],
    values: FilterValues,
    behavior: DashboardDateFilterBehavior | undefined
): FilterDefinition[] {
    if (behavior !== "optional") return [];
    return filters.filter(filter => {
        if (filter.type !== "daterange" || filter.required) return false;
        const value = values[filter.field];
        return !isEmptyFilterValue(value)
            && (!Array.isArray(value) || value.length !== 2 || value.some(item => item === "" || item === null || item === undefined));
    });
}
