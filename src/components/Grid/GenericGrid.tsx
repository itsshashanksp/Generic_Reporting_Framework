import { useRef } from "react";

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
    rows: Record<string, unknown>[];
    columns: ColumnDefinition[];
    gridConfig: GridConfig;
}

export default function GenericGrid({
    rows,
    columns,
    gridConfig,
}: Props) {

    const { setApi } = useGrid();

    const gridRef = useRef<AgGridReact>(null);

const groupedColumns =
    gridConfig.grouping?.enabled
        ? gridConfig.grouping.groups ?? []
        : [];

const aggregateColumns =
    gridConfig.grouping?.enabled
        ? gridConfig.grouping.aggregates ?? []
        : [];

const columnDefs = gridConfig.grouping?.enabled
    ? [
        ...groupedColumns.map(group => ({
            field: group.field,
            headerName: group.header ?? group.field,
            sortable: true,
            filter: false,
            width: 200,
        })),

        ...aggregateColumns.map(aggregate => ({
            field:
                aggregate.alias ??
                `${aggregate.function}_${aggregate.field}`,

            headerName:
                aggregate.header ??
                aggregate.alias ??
                `${aggregate.function} ${aggregate.field}`,

            sortable: true,
            filter: false,
            width: 180,
        })),
    ]
    : columns
        .filter(column => column.visible)
        .map(column => ({
            field: column.field,
            headerName: column.header,
            sortable: column.sortable,
            filter: false,
            width: column.width,
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

                pagination={gridConfig.pagination.enabled}
                paginationPageSize={gridConfig.pagination.pageSize}
                paginationPageSizeSelector={
                    gridConfig.pagination.pageSizeOptions
                }

                rowSelection={gridConfig.rowSelection}

                {...defaultGridOptions}
            />

        </div>

    );

}