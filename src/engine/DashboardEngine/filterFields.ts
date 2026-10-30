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
    const applicableFields = new Set(sharedFilters.map(filter => filter.field));
    const applicableValues = Object.fromEntries(
        Object.entries(appliedValues).filter(([field]) => applicableFields.has(field))
    );
    const withoutTargets = sharedFilters.map(filter => {
        const definition = { ...filter };
        delete definition.targetGrids;
        return definition as FilterDefinition;
    });
    if (!filterFields || Object.keys(filterFields).length === 0) {
        return { filters: withoutTargets, values: applicableValues };
    }
    const fieldFor = (field: string) =>
        Object.prototype.hasOwnProperty.call(filterFields, field) ? filterFields[field] : field;
    const asWidgetFilter = (filter: FilterDefinition): FilterDefinition => {
        return { ...filter, field: fieldFor(filter.field) };
    };

    return {
        filters: withoutTargets.map(asWidgetFilter),
        values: Object.fromEntries(
            Object.entries(applicableValues).map(([field, value]) => [fieldFor(field), value])
        ),
    };
}

/** Page filters applicable to one stable widget after positive targets and exclusions. */
export function getTargetedDashboardFilters(
    filters: FilterDefinition[],
    widgetId: string,
    exclusions: string[] = []
) {
    const excluded = new Set(exclusions);
    return filters.filter(filter =>
        (!filter.targetGrids || filter.targetGrids.includes(widgetId))
        && !excluded.has(filter.field)
    );
}
