export type FilterType =
    | "text"
    | "number"
    | "select"
    | "multiselect"
    | "boolean"
    | "date"
    | "daterange";


export type FilterOperator =
    | "equals"
    | "notEquals"
    | "contains"
    | "notContains"
    | "startsWith"
    | "notStartsWith"
    | "endsWith"
    | "notEndsWith"
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

    value: string | number | boolean;

    count?: number;

}

export interface DynamicFilterOptions {
    /** Reviewed JSON Query request used only to retrieve grouped option rows. */
    request: UniversalQueryRequest;
    valueField: string;
    labelField?: string;
    countField?: string;
    searchable?: boolean;
    searchPlaceholder?: string;
}


export interface FilterDefinition {

    field: string;

    label: string;

    type: FilterType;

    operator?: FilterOperator;

    options?: FilterOption[];

    dynamicOptions?: DynamicFilterOptions;

    visible?: boolean;

    required?: boolean;

    placeholder?: string;

}
import type { UniversalQueryRequest } from "./api";
