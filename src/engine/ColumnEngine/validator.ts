import type { ColumnDefinition } from "../../types/column";

export function validateColumns(columns: ColumnDefinition[]): ColumnDefinition[] {

    columns.forEach((column) => {

        if (!column.field) {
            throw new Error("Column field is required.");
        }

        if (!column.header) {
            throw new Error(`Column header is required for '${column.field}'.`);
        }

        if (
            column.dataType !== undefined &&
            !["text", "number", "currency", "percentage", "boolean", "date", "datetime"].includes(column.dataType)
        ) {
            throw new Error(`Invalid data type for column '${column.field}'.`);
        }

        if (column.currency !== undefined && !/^[A-Z]{3}$/.test(column.currency)) {
            throw new Error(`Invalid currency code for column '${column.field}'.`);
        }
        if (column.currency !== undefined && column.dataType !== "currency") {
            throw new Error(`Currency is only supported for currency column '${column.field}'.`);
        }

    });

    return columns;
}
