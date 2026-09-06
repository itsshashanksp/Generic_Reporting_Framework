import type {
    FilterDefinition,
    FilterOperator,
    FilterType,
} from "../../types/filter";

export const defaultFilterDefinition: Partial<FilterDefinition> = {

    visible: true,

    required: false,

};

export const defaultFilterOperators: Record<
    FilterType,
    FilterOperator
> = {
    text: "contains",
    number: "equals",
    select: "equals",
    multiselect: "in",
    date: "equals",
    daterange: "between",
};
