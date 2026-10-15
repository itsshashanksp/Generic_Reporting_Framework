import type { FilterDefinition } from "../../types/filter";

/** Shared dashboard filter field → the field name one widget filters on. */
export type WidgetFilterFields = Record<string, string>;

export interface WidgetFilters {
    filters: FilterDefinition[];
    values: Record<string, unknown>;
}

/**
 * Shared dashboard filters as one widget sees them: each `filterFields`
 * source field is renamed to its target field in both the definitions (which
 * the SQL Resource declaration is built from) and the applied values (which
 * become runtime filters), so the two always name the same field. Operators,
 * types and values are unchanged; the inputs are never mutated.
 */
export function mapWidgetFilters(
    sharedFilters: FilterDefinition[],
    appliedValues: Record<string, unknown>,
    filterFields?: WidgetFilterFields
): WidgetFilters {
    if (!filterFields || Object.keys(filterFields).length === 0) {
        return { filters: sharedFilters, values: appliedValues };
    }
    const fieldFor = (field: string) =>
        Object.prototype.hasOwnProperty.call(filterFields, field) ? filterFields[field] : field;

    return {
        filters: sharedFilters.map(filter => ({ ...filter, field: fieldFor(filter.field) })),
        values: Object.fromEntries(
            Object.entries(appliedValues).map(([field, value]) => [fieldFor(field), value])
        ),
    };
}
