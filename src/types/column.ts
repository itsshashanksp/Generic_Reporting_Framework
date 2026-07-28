export interface ColumnDefinition {
    field: string;
    header: string;

    visible?: boolean;

    sortable?: boolean;

    filterable?: boolean;

    exportable?: boolean;

    width?: number;

    type?: "text" | "number" | "date" | "boolean";
}