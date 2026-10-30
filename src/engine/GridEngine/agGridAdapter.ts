import type { ColDef, RowSelectionOptions } from "ag-grid-community";

import type { ColumnDataType, ColumnDefinition } from "../../types/column";
import type { SortDefinition } from "../../types/report";
import { formatValueForDisplay } from "../ValueFormatter";
import { getContentMinWidth } from "./contentWidth";
import { compareGridValues } from "./sorting";

type GridRow = Record<string, unknown>;

export function isNumericColumnType(dataType?: ColumnDataType): boolean {
    return dataType === "number" || dataType === "currency" || dataType === "percentage";
}

export function getColumnAlignment(column: Pick<ColumnDefinition, "dataType">): "left" | "right" {
    return isNumericColumnType(column.dataType) ? "right" : "left";
}

/**
 * AG Grid types are applied only when the returned runtime values are
 * compatible. SQL drivers commonly serialize numbers as strings; those keep
 * the framework formatter/comparator and opt out of AG Grid type inference.
 */
export function resolveAgGridCellDataType(column: ColumnDefinition, rows: GridRow[]): ColDef["cellDataType"] {
    const values = rows.slice(0, 200)
        .map(row => row[column.field])
        .filter(value => value !== null && value !== undefined && value !== "");
    if (column.dataType === "text") return "text";
    if (isNumericColumnType(column.dataType)) {
        return values.length > 0 && values.every(value => typeof value === "number" && Number.isFinite(value))
            ? "number"
            : false;
    }
    if (column.dataType === "boolean") {
        return values.length > 0 && values.every(value => typeof value === "boolean") ? "boolean" : false;
    }
    if (column.dataType === "date" || column.dataType === "datetime") {
        if (values.length > 0 && values.every(value => value instanceof Date && !Number.isNaN(value.getTime()))) return "date";
        if (values.length > 0 && values.every(value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:[T ][^\s]+)?/.test(value))) return "dateString";
        return false;
    }
    return false;
}

export function buildAgGridColumnDefs(
    columns: ColumnDefinition[],
    rows: GridRow[],
    initialSort: SortDefinition[],
): ColDef<GridRow>[] {
    return columns.filter(column => column.visible !== false).map(column => {
        const sortIndex = initialSort.findIndex(sort => sort.field === column.field);
        const alignment = getColumnAlignment(column);
        return {
            field: column.field,
            headerName: column.header,
            sortable: column.sortable,
            filter: false,
            initialWidth: column.width,
            flex: column.width === undefined ? 1 : undefined,
            minWidth: getContentMinWidth(rows, column.field, column.header, column.sortable ?? true, undefined, column.dataType, column.currency),
            cellDataType: resolveAgGridCellDataType(column, rows),
            valueFormatter: ({ value }) => formatValueForDisplay(value, column.dataType, column.currency),
            cellClass: `universal-grid__cell--${alignment}`,
            headerClass: "universal-grid__header--left",
            comparator: (left, right) => compareGridValues(left, right, column.dataType),
            ...(sortIndex < 0 ? {} : {
                initialSort: initialSort[sortIndex].direction === "DESC" ? "desc" as const : "asc" as const,
                initialSortIndex: sortIndex,
            }),
        };
    });
}

export function buildAgGridRowSelection(selection: "single" | "multiple"): RowSelectionOptions<GridRow> {
    const common = {
        checkboxes: false,
        enableClickSelection: true,
    } as const;
    return selection === "single"
        ? { mode: "singleRow", ...common }
        : { mode: "multiRow", headerCheckbox: false, enableSelectionWithoutKeys: false, ...common };
}
