import type { GroupingConfig } from "../../types/grouping";

export function buildGrouping(
    config?: GroupingConfig
) {
    if (!config?.enabled) {
        return {
            groupBy: [],
            fields: [],
        };
    }

    const groupBy =
        config.groups?.map(
            group => group.field
        ) ?? [];

    const fields = [
        ...groupBy,

        ...(config.aggregates?.map(
            aggregate => ({
                function: aggregate.function,
                field: aggregate.field,
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
        fields,
    };
}
