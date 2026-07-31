import { useRef } from "react";
import type { SortChangedEvent } from "ag-grid-community";

import { AgGridReact } from "ag-grid-react";

import { useGrid } from "../../engine/GridContext";

import {
    defaultColumn,
    defaultGridOptions,
    gridTheme,
} from "../../engine/GridEngine";

import type { GridConfig } from "../../types/report";
import type { ColumnDefinition } from "../../types/column";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface Props {
    rows: any[];
    columns: ColumnDefinition[];
    gridConfig: GridConfig;

    onSortChange?: (
        sort: {
            column: string;
            direction: "ASC" | "DESC";
        }[]
    ) => void;
}

export default function GenericGrid({
    rows,
    columns,
    gridConfig,
    onSortChange,
}: Props) {

    const { setApi } = useGrid();

    const gridRef = useRef<AgGridReact>(null);

    const handleSortChanged = (event: SortChangedEvent) => {

    const sortModel = event.api
        .getColumnState()
        .filter(col => col.sort)
        .map(col => ({
            column: col.colId,
            direction: col.sort?.toUpperCase() as "ASC" | "DESC",
        }));

    console.log("Sort Model", sortModel);
    onSortChange?.(sortModel);

};

    const columnDefs = columns
        .filter(column => column.visible)
        .map(column => ({
            field: column.field,
            headerName: column.header,
            sortable: column.sortable,
            filter: false,
            width: column.width,
            sortingOrder: ["asc", "desc", null],
        }));

    return (

        <div
            className={gridTheme.className}
            style={gridTheme.style}
        >

            <AgGridReact
                ref={gridRef}

                onGridReady={(params) => {
                    setApi(params.api);
                }}

                rowData={rows}
                columnDefs={columnDefs}

                defaultColDef={defaultColumn}

                onSortChanged={handleSortChanged}

                pagination={gridConfig.pagination}
                paginationPageSize={gridConfig.pageSize}
                rowSelection={gridConfig.rowSelection}

                {...defaultGridOptions}
            />

        </div>

    );

}