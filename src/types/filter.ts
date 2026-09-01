export type FilterType =
    | "text"
    | "number"
    | "select"
    | "multiselect"
    | "date"
    | "daterange";


export type FilterOperator =
    | "equals"
    | "notEquals"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "greaterThan"
    | "greaterThanOrEqual"
    | "lessThan"
    | "lessThanOrEqual"
    | "between"
    | "notBetween"
    | "in"
    | "notIn"
    | "isNull"
    | "isNotNull";


export interface FilterOption {

    label: string;

    value: string | number;

}


export interface FilterDefinition {

    field: string;

    label: string;

    type: FilterType;

    operator?: FilterOperator;

    options?: FilterOption[];

    visible?: boolean;

    required?: boolean;

    placeholder?: string;

    format?: string;

}
