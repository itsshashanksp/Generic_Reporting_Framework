import type { FilterDefinition } from "../../types/filter";

import {
    defaultFilterDefinition,
    defaultFilterOperators,
} from "./defaults";

import { validateFilters } from "./validator";

export function loadFilters(
    filters: FilterDefinition[]
): FilterDefinition[] {

    const merged = filters.map(filter => ({

        ...defaultFilterDefinition,

        ...filter,

        operator:
            filter.operator ??
            defaultFilterOperators[filter.type],

    }));

    return validateFilters(merged);

}
