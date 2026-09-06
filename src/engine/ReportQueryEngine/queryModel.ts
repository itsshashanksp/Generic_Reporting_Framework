import type {
    HavingCondition,
    QueryField,
    QueryFilter,
    QueryJoin,
    QuerySort,
    UniversalQueryRequest,
} from "../../types/api";

/**
 * Backend-compatible query information authored independently from transient
 * UI state. Pagination deliberately does not belong to this model.
 */
export interface QueryDefinition {
    readonly source: Readonly<UniversalQueryRequest["source"]>;
    readonly fields: ReadonlyArray<QueryField>;
    readonly baseFilters?: ReadonlyArray<Readonly<QueryFilter>>;
    readonly joins?: ReadonlyArray<Readonly<QueryJoin>>;
    readonly groupBy?: ReadonlyArray<string>;
    readonly having?: ReadonlyArray<Readonly<HavingCondition>>;
    readonly baseSort?: ReadonlyArray<Readonly<QuerySort>>;
    readonly distinct?: boolean;
    readonly limit?: number;
}

/** State that can change without changing the authored SQL definition. */
export interface QueryRuntimeState {
    filters?: QueryFilter[];
    filterLogic?: "AND" | "OR";
    sort?: QuerySort[];
    pagination?: UniversalQueryRequest["pagination"];
}
