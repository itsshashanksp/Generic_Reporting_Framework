import type {
    FilterDefinition,
    FilterOperator,
} from "../../types/filter";


export interface WhereCondition {

    column: string;

    operator: string;

    value: unknown;

}


function getSqlOperator(
    operator: FilterOperator
): string {

    switch (operator) {

        case "equals":
            return "=";

        case "notEquals":
            return "<>";

        case "contains":
            return "LIKE";

        case "startsWith":
            return "LIKE";

        case "endsWith":
            return "LIKE";

        case "greaterThan":
            return ">";

        case "greaterThanOrEqual":
            return ">=";

        case "lessThan":
            return "<";

        case "lessThanOrEqual":
            return "<=";

        case "between":
            return "BETWEEN";

        case "notBetween":
            return "NOT BETWEEN";

        case "in":
            return "IN";

        case "notIn":
            return "NOT IN";

        case "isNull":
            return "IS NULL";

        case "isNotNull":
            return "IS NOT NULL";

        default:
            return "LIKE";

    }

}


function formatValue(
    value: unknown,
    operator: FilterOperator
): unknown {

    if (
        operator === "contains"
    ) {

        return `%${value}%`;

    }


    if (
        operator === "startsWith"
    ) {

        return `${value}%`;

    }


    if (
        operator === "endsWith"
    ) {

        return `%${value}`;

    }


    return value;

}


export function buildWhere(
    filters: Record<string, unknown>,
    definitions: FilterDefinition[] = []
): WhereCondition[] {

    const where: WhereCondition[] = [];


    Object.entries(filters).forEach(
        ([column, value]) => {

            /*
             * Find the configuration for this
             * filter field.
             */
            const definition =
                definitions.find(
                    filter =>
                        filter.field === column
                );


            /*
             * Use the configured operator.
             *
             * If no operator is configured,
             * default to contains.
             */
            const operator: FilterOperator =
                definition?.operator ??
                "contains";


            /*
             * IS NULL and IS NOT NULL do not
             * require an actual value.
             *
             * The filter UI sends true when
             * the condition is enabled.
             */
            if (
                operator === "isNull" ||
                operator === "isNotNull"
            ) {

                if (value !== true) {
                    return;
                }


                where.push({

                    column,

                    operator:
                        getSqlOperator(
                            operator
                        ),

                    value: null,

                });

                return;

            }


            /*
             * Ignore empty filter values.
             */
            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {

                return;

            }


            /*
             * BETWEEN expects exactly
             * two values.
             */
            if (
                operator === "between" ||
                operator === "notBetween"
            ) {

                const start = Array.isArray(value) ? value[0] : undefined;
                const end = Array.isArray(value) ? value[1] : undefined;
                const hasStart = start !== undefined && start !== null && start !== "";
                const hasEnd = end !== undefined && end !== null && end !== "";

                if (definition?.type === "daterange" && operator === "between") {
                    if (hasStart && !hasEnd) {
                        where.push({ column, operator: ">=", value: start });
                        return;
                    }

                    if (!hasStart && hasEnd) {
                        where.push({ column, operator: "<=", value: end });
                        return;
                    }
                }

                if (
                    !Array.isArray(value) ||
                    value.length !== 2 ||
                    !hasStart ||
                    !hasEnd
                ) {

                    return;

                }


                where.push({

                    column,

                    operator:
                        getSqlOperator(
                            operator
                        ),

                    value,

                });

                return;

            }

            if (
                definition?.type === "text" &&
                typeof value !== "string"
            ) {

                return;

            }


            /*
             * IN / NOT IN expect
             * multiple values.
             */
            if (
                operator === "in" ||
                operator === "notIn"
            ) {

                if (
                    !Array.isArray(value) ||
                    value.length === 0
                ) {

                    return;

                }


                where.push({

                    column,

                    operator:
                        getSqlOperator(
                            operator
                        ),

                    value,

                });

                return;

            }


            /*
             * Normal single-value filters.
             */
            where.push({

                column,

                operator:
                    getSqlOperator(
                        operator
                    ),

                value:
                    formatValue(
                        value,
                        operator
                    ),

            });

        }
    );


    return where;

}
