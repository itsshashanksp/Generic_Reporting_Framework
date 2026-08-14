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
    rows: any[];
    columns: ColumnDefinition[];
    gridConfig: GridConfig;

    currentPage: number;
    totalRows: number;

    onPageChange: (page: number) => void;
}

export default function GenericGrid({
    rows,
    columns,
    gridConfig,
    currentPage,
    totalRows,
    onPageChange,
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

{gridConfig.pagination.enabled && (
    <div
        style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 0",
        }}
    >
        <div>
            Page {currentPage} of{" "}
            {Math.max(
                1,
                Math.ceil(
                    totalRows / gridConfig.pagination.pageSize
                )
            )}
        </div>

        <div
            style={{
                display: "flex",
                gap: "8px",
            }}
        >
            <button
                disabled={currentPage <= 1}
                onClick={() => onPageChange(1)}
            >
                First
            </button>

            <button
                disabled={currentPage <= 1}
                onClick={() =>
                    onPageChange(currentPage - 1)
                }
            >
                Previous
            </button>

            <button
                disabled={
                    currentPage >=
                    Math.ceil(
                        totalRows /
                        gridConfig.pagination.pageSize
                    )
                }
                onClick={() =>
                    onPageChange(currentPage + 1)
                }
            >
                Next
            </button>

            <button
                disabled={
                    currentPage >=
                    Math.ceil(
                        totalRows /
                        gridConfig.pagination.pageSize
                    )
                }
                onClick={() =>
                    onPageChange(
                        Math.max(
                            1,
                            Math.ceil(
                                totalRows /
                                gridConfig.pagination.pageSize
                            )
                        )
                    )
                }
            >
                Last
            </button>
        </div>
    </div>
)}

        </div>

    );

}