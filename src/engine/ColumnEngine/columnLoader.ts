import type { ColumnDefinition } from "../../types/column";
import { defaultColumnDefinition } from "./defaults";
import { validateColumns } from "./validator";

export function loadColumns(columns: ColumnDefinition[]): ColumnDefinition[] {

    const mergedColumns = columns.map(column => ({
        ...defaultColumnDefinition,
        ...column,
    }));

    return validateColumns(mergedColumns);
}