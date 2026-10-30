export type ColumnDataType = "text" | "number" | "currency" | "percentage" | "boolean" | "date" | "datetime";

export interface ColumnDefinition {
    field: string;
    header: string;

    visible?: boolean;

    sortable?: boolean;

    width?: number;

    /** Explicit presentation type; required to format numeric values returned as strings. */
    dataType?: ColumnDataType;

    /** ISO 4217 display code for currency columns; defaults to INR. */
    currency?: string;

}
