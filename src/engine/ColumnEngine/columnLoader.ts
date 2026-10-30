import type { ColumnDefinition } from "../../types/column";
import { defaultColumnDefinition } from "./defaults";
import { validateColumns } from "./validator";
import { normalizeColumnDataType } from "./dataType";

export function loadColumns(columns: ColumnDefinition[]): ColumnDefinition[] {

    const mergedColumns = columns.map(column => normalizeColumnDataType({
        ...defaultColumnDefinition,
        ...column,
    } as ColumnDefinition));

    return validateColumns(mergedColumns);
}
