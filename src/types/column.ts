export type ColumnDataType = "text" | "number" | "boolean" | "date" | "datetime";
export type ColumnAlignment = "left" | "center" | "right";

export interface ColumnDefinition {
    field: string;
    header: string;

    visible?: boolean;

    sortable?: boolean;

    width?: number;

    /** Explicit presentation type; required to format numeric values returned as strings. */
    dataType?: ColumnDataType;

    /** Optional presentation override. Numeric columns default to right; all others to left. */
    align?: ColumnAlignment;
}
