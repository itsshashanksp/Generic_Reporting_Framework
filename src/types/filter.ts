export type FilterType =
    | "text"
    | "number"
    | "select"
    | "multiselect"
    | "date"
    | "daterange";

export interface FilterDefinition {

    field: string;

    label: string;

    type: FilterType;

    visible?: boolean;

    required?: boolean;

    placeholder?: string;

}