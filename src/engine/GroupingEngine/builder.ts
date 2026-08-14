import type { GroupingConfig } from "../../types/grouping";

export function buildGrouping(
    config?: GroupingConfig
) {
    if (!config?.enabled) {
        return {
            groupBy: [],
            columns: [],
        };
    }

    const groupBy =
        config.groups?.map(
            group => group.field
        ) ?? [];

    const columns = [
        ...groupBy,

        ...(config.aggregates?.map(
            aggregate => ({
                function: aggregate.function,
                column: aggregate.field,
                ...(aggregate.alias
                    ? {
                          alias: aggregate.alias,
                      }
                    : {}),
            })
        ) ?? []),
    ];

    return {
        groupBy,
        columns,
    };
}