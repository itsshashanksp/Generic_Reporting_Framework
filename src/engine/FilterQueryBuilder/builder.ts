export interface WhereCondition {
    column: string;
    operator: string;
    value: any;
}

export function buildWhere(
    filters: Record<string, any>
): WhereCondition[] {

    const where: WhereCondition[] = [];

    Object.entries(filters).forEach(([column, value]) => {

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return;
        }

        where.push({

            column,

            operator: "LIKE",

            value: `%${value}%`,

        });

    });

    return where;

}