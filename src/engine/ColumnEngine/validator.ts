import type { ColumnDefinition } from "../../types/column";

export function validateColumns(columns: ColumnDefinition[]): ColumnDefinition[] {

    columns.forEach((column) => {

        if (!column.field) {
            throw new Error("Column field is required.");
        }

        if (!column.header) {
            throw new Error(`Column header is required for '${column.field}'.`);
        }

    });

    return columns;
}