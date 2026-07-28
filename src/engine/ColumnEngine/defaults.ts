import type { ColumnDefinition } from "../../types/column";

export const defaultColumnDefinition: Partial<ColumnDefinition> = {
    visible: true,
    sortable: true,
    filterable: true,
    exportable: true,
    width: 150,
    type: "text",
};