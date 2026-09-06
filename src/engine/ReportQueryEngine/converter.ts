import type { UniversalQueryRequest } from "../../types/api";
import type { QueryDefinition, QueryRuntimeState } from "./queryModel";

export class UnsupportedRuntimeFilterGroupingError extends Error {
    constructor() {
        super(
            "The Universal API cannot represent immutable base filters AND a grouped runtime OR expression."
        );
        this.name = "UnsupportedRuntimeFilterGroupingError";
    }
}

/**
 * Converts the internal model to the existing Universal JSON contract. This is
 * not wired into report execution yet.
 */
export function toUniversalQueryRequest(
    definition: QueryDefinition,
    runtime: QueryRuntimeState = {}
): UniversalQueryRequest {
    const baseFilters = definition.baseFilters ?? [];
    const runtimeFilters = runtime.filters ?? [];

    if (
        baseFilters.length > 0
        && runtimeFilters.length > 1
        && runtime.filterLogic === "OR"
    ) {
        throw new UnsupportedRuntimeFilterGroupingError();
    }

    const filters = [
        ...baseFilters,
        ...runtimeFilters,
    ];
    const sort = runtime.sort ?? definition.baseSort;
    const filterLogic = runtimeFilters.length > 0
        ? baseFilters.length > 0 ? "AND" : runtime.filterLogic
        : undefined;

    return {
        action: "select",
        source: { ...definition.source },
        fields: [...definition.fields],
        ...(filters.length > 0 ? { filters } : {}),
        ...(definition.joins !== undefined ? {
            joins: definition.joins.map(join => ({
                ...join,
                source: { ...join.source },
                on: { ...join.on },
            })),
        } : {}),
        ...(definition.groupBy !== undefined ? { groupBy: [...definition.groupBy] } : {}),
        ...(definition.having !== undefined ? {
            having: definition.having.map(condition => ({ ...condition })),
        } : {}),
        ...(sort !== undefined ? { sort: sort.map(item => ({ ...item })) } : {}),
        ...(runtime.pagination !== undefined ? { pagination: runtime.pagination } : {}),
        ...(definition.distinct !== undefined ? { distinct: definition.distinct } : {}),
        ...(definition.limit !== undefined ? { limit: definition.limit } : {}),
        ...(filterLogic !== undefined ? { filterLogic } : {}),
    };
}
