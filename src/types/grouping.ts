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

    expandedByDefault?: boolean;
    showSubtotals?: boolean;
    showGrandTotal?: boolean;
    /** Shows the already-calculated aggregate values in expanded and collapsed group headers. */
    showGroupTotalsInHeader?: boolean;
    subtotalPosition?: "top" | "bottom";
    /** Source keeps ordinary records; grouped adds headers, subtotals and grand total. */
    exportMode?: "source" | "grouped";
}
