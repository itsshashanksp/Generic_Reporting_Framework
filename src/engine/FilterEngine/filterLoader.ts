import type { FilterDefinition } from "../../types/filter";

import { defaultFilterDefinition } from "./defaults";

import { validateFilters } from "./validator";

export function loadFilters(
    filters: FilterDefinition[]
): FilterDefinition[] {

    const merged = filters.map(filter => ({

        ...defaultFilterDefinition,

        ...filter,

    }));

    return validateFilters(merged);

}