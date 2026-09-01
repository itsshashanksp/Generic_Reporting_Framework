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

        if (!filter.field) {

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


        if (!filter.label) {

            throw new Error(
                `Filter label missing for '${filter.field}'.`
            );

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

                    if (
                        option.label === undefined ||
                        option.label === ""
                    ) {

                        throw new Error(
                            `Option label missing at index ${index} for filter '${filter.field}'.`
                        );

                    }


                    if (
                        option.value === undefined ||
                        option.value === null
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
