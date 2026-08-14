export type AggregateFunction =
    | "COUNT"
    | "SUM"
    | "AVG"
    | "MIN"
    | "MAX";

export interface GroupDefinition {
    field: string;
    header?: string;
}

export interface AggregateDefinition {
    field: string;
    function: AggregateFunction;
    alias?: string;
    header?: string;
}

export interface GroupingConfig {
    enabled: boolean;

    groups?: GroupDefinition[];

    aggregates?: AggregateDefinition[];
}