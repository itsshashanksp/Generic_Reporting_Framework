import type {
    FilterDefinition,
    FilterOperator,
    FilterType,
} from "../../types/filter";


export const allowedOperators: Record<
    FilterType,
    FilterOperator[]
> = {

    text: [
        "equals",
        "notEquals",
        "contains",
        "startsWith",
        "endsWith",
        "isNull",
        "isNotNull",
    ],

    number: [
        "equals",
        "notEquals",
        "greaterThan",
        "greaterThanOrEqual",
        "lessThan",
        "lessThanOrEqual",
        "between",
        "notBetween",
        "isNull",
        "isNotNull",
    ],

    select: [
        "equals",
        "notEquals",
        "isNull",
        "isNotNull",
    ],

    multiselect: [
        "in",
        "notIn",
        "isNull",
        "isNotNull",
    ],

    date: [
        "equals",
        "notEquals",
        "greaterThan",
        "greaterThanOrEqual",
        "lessThan",
        "lessThanOrEqual",
        "isNull",
        "isNotNull",
    ],

    daterange: [
        "between",
        "notBetween",
        "isNull",
        "isNotNull",
    ],

};


export function validateFilters(
    filters: FilterDefinition[]
): FilterDefinition[] {

    const fields = new Set<string>();

    filters.forEach(filter => {

        if (typeof filter !== "object" || filter === null || Array.isArray(filter)) {
            throw new Error("Filter definitions must be objects.");
        }

        const configured = filter as unknown as Record<string, unknown>;
        const allowedKeys = ["field", "label", "type", "operator", "options", "visible", "required", "placeholder"];
        const unknownKey = Object.keys(configured).find(key => !allowedKeys.includes(key));
        if (unknownKey) {
            throw new Error(`Unknown filter property '${unknownKey}'.`);
        }

        if (typeof filter.field !== "string" || !filter.field.trim()) {

            throw new Error(
                "Filter field is required."
            );

        }

        if (fields.has(filter.field)) {

            throw new Error(
                `Duplicate filter field '${filter.field}'. Filter fields must be unique.`
            );

        }

        fields.add(filter.field);


        if (typeof filter.label !== "string" || !filter.label.trim()) {

            throw new Error(
                `Filter label missing for '${filter.field}'.`
            );

        }

        if (filter.visible !== undefined && typeof filter.visible !== "boolean") {
            throw new Error(`Filter visible must be a boolean for '${filter.field}'.`);
        }

        if (filter.required !== undefined && typeof filter.required !== "boolean") {
            throw new Error(`Filter required must be a boolean for '${filter.field}'.`);
        }

        if (filter.placeholder !== undefined && typeof filter.placeholder !== "string") {
            throw new Error(`Filter placeholder must be a string for '${filter.field}'.`);
        }

        if (filter.placeholder !== undefined && filter.type !== "text" && filter.type !== "number") {
            throw new Error(`Placeholder is not supported for filter '${filter.field}' of type '${filter.type}'.`);
        }

        if (filter.options !== undefined && filter.type !== "select" && filter.type !== "multiselect") {
            throw new Error(`Options are not supported for filter '${filter.field}' of type '${filter.type}'.`);
        }


        if (
            !filter.type ||
            !Object.prototype.hasOwnProperty.call(
                allowedOperators,
                filter.type
            )
        ) {

            throw new Error(
                `Invalid filter type '${String(filter.type)}' for '${filter.field}'.`
            );

        }


        /*
         * Validate configured operator.
         *
         * No operator means the filter will use
         * the default behaviour from the query builder.
         */
        if (filter.operator) {

            const operators =
                allowedOperators[filter.type];

            if (
                !operators.includes(
                    filter.operator
                )
            ) {

                throw new Error(
                    `Operator '${filter.operator}' is not valid for filter '${filter.field}' of type '${filter.type}'.`
                );

            }

        }


        /*
         * Multiselect requires options.
         */
        if (
            filter.type === "multiselect" &&
            filter.operator !== "isNull" &&
            filter.operator !== "isNotNull" &&
            (!filter.options ||
                filter.options.length === 0)
        ) {

            throw new Error(
                `Options are required for multiselect filter '${filter.field}'.`
            );

        }


        /*
         * Select requires options when
         * it is used as a value-based filter.
         */
        if (
            filter.type === "select" &&
            filter.operator !== "isNull" &&
            filter.operator !== "isNotNull" &&
            (!filter.options ||
                filter.options.length === 0)
        ) {

            throw new Error(
                `Options are required for select filter '${filter.field}'.`
            );

        }


        /*
         * Validate filter options.
         */
        if (filter.options) {

            const optionValues = new Set<string>();

            filter.options.forEach(
                (option, index) => {

                    if (typeof option !== "object" || option === null || Array.isArray(option)) {
                        throw new Error(`Option at index ${index} for filter '${filter.field}' must be an object.`);
                    }

                    const unknownOptionKey = Object.keys(option).find(
                        key => key !== "label" && key !== "value"
                    );
                    if (unknownOptionKey) {
                        throw new Error(`Unknown option property '${unknownOptionKey}' for filter '${filter.field}'.`);
                    }

                    if (
                        typeof option.label !== "string" ||
                        option.label === ""
                    ) {

                        throw new Error(
                            `Option label missing at index ${index} for filter '${filter.field}'.`
                        );

                    }


                    if (
                        (typeof option.value !== "string" &&
                            typeof option.value !== "number")
                    ) {

                        throw new Error(
                            `Option value missing at index ${index} for filter '${filter.field}'.`
                        );

                    }

                    const optionKey =
                        `${typeof option.value}:${String(option.value)}`;

                    if (optionValues.has(optionKey)) {

                        throw new Error(
                            `Duplicate option value '${String(option.value)}' for filter '${filter.field}'.`
                        );

                    }

                    optionValues.add(optionKey);

                }
            );

        }

    });


    return filters;

}
