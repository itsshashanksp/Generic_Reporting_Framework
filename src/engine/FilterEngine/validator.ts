import type { FilterDefinition } from "../../types/filter";

export function validateFilters(
    filters: FilterDefinition[]
): FilterDefinition[] {

    filters.forEach(filter => {

        if (!filter.field)
            throw new Error("Filter field is required.");

        if (!filter.label)
            throw new Error(`Filter label missing for '${filter.field}'.`);

        if (!filter.type)
            throw new Error(`Filter type missing for '${filter.field}'.`);

    });

    return filters;

}