import { useEffect, useMemo, useRef, type CSSProperties } from "react";

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
import "./GenericGrid.css";

interface Props {
    rows: Record<string, unknown>[];
    columns: ColumnDefinition[];
    gridConfig: GridConfig;
    height?: CSSProperties["height"];
    serverPagination?: {
        page: number;
        pageSize: number;
        totalRows: number;
        onPageChange: (page: number) => void;
        onPageSizeChange: (pageSize: number) => void;
    };
    onSortChange?: (sort: Array<{ column: string; direction: "ASC" | "DESC" }>) => void;
}

export default function GenericGrid({
    rows,
    columns,
    gridConfig,
    height,
    serverPagination,
    onSortChange,
}: Props) {

    const { setApi } = useGrid();
    const usesNaturalHeight = height === undefined;

    const gridRef = useRef<AgGridReact>(null);

    useEffect(() => () => setApi(null), [setApi]);

    const columnDefs = useMemo(() => {
        const groupedColumns = gridConfig.grouping?.enabled
            ? gridConfig.grouping.groups ?? []
            : [];
        const aggregateColumns = gridConfig.grouping?.enabled
            ? gridConfig.grouping.aggregates ?? []
            : [];

        return gridConfig.grouping?.enabled
            ? [
                ...groupedColumns.map(group => ({
                    field: group.field,
                    headerName: group.header ?? group.field,
                    sortable: true,
                    filter: false,
                    width: 200,
                })),
                ...aggregateColumns.map(aggregate => ({
                    field: aggregate.alias ?? `${aggregate.function}_${aggregate.field}`,
                    headerName: aggregate.header
                        ?? aggregate.alias
                        ?? `${aggregate.function} ${aggregate.field}`,
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
    }, [columns, gridConfig.grouping]);

    const totalPages = serverPagination
        ? Math.max(1, Math.ceil(serverPagination.totalRows / serverPagination.pageSize))
        : 1;
    const rangeStart = serverPagination && serverPagination.totalRows > 0
        ? (serverPagination.page - 1) * serverPagination.pageSize + 1
        : 0;
    const rangeEnd = serverPagination
        ? Math.min(rangeStart + rows.length - 1, serverPagination.totalRows)
        : 0;

    return (

        <div className={`universal-grid${usesNaturalHeight ? " universal-grid--natural-height" : ""}`}>
            <div
                className={gridTheme.className}
                style={{
                    ...gridTheme.style,
                    ...(height !== undefined ? { height } : { height: "auto" }),
                }}
            >

            <AgGridReact
                ref={gridRef}

                {...defaultGridOptions}

                onGridReady={(params) => {
                    setApi(params.api);
                }}

                rowData={rows}
                columnDefs={columnDefs}

                defaultColDef={defaultColumn}
                headerHeight={44}
                rowHeight={42}
                domLayout={usesNaturalHeight ? "autoHeight" : "normal"}
                enableCellTextSelection

                pagination={gridConfig.pagination.enabled && !serverPagination}
                paginationPageSize={gridConfig.pagination.pageSize}
                paginationPageSizeSelector={
                    gridConfig.pagination.pageSizeOptions
                }

                rowSelection={gridConfig.rowSelection}

                onSortChanged={onSortChange ? event => {
                    onSortChange(event.api.getColumnState()
                        .filter(column => column.sort === "asc" || column.sort === "desc")
                        .map(column => ({
                            column: column.colId,
                            direction: column.sort === "desc" ? "DESC" : "ASC",
                        })));
                } : undefined}
            />

            </div>

            {serverPagination && gridConfig.pagination.enabled && (
                <footer className="universal-grid__pagination" aria-label="Report pagination">
                    <span className="universal-grid__range">
                        Showing {rangeStart}–{Math.max(rangeStart, rangeEnd)} of {serverPagination.totalRows}
                    </span>
                    <label>
                        Rows
                        <select
                            aria-label="Rows per page"
                            value={serverPagination.pageSize}
                            onChange={event => serverPagination.onPageSizeChange(Number(event.target.value))}
                        >
                            {[...new Set([
                                ...(gridConfig.pagination.pageSizeOptions ?? []),
                                serverPagination.pageSize,
                            ])].sort((left, right) => left - right).map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </label>
                    <div className="universal-grid__page-buttons">
                        <button type="button" aria-label="First page" disabled={serverPagination.page <= 1} onClick={() => serverPagination.onPageChange(1)}>«</button>
                        <button type="button" aria-label="Previous page" disabled={serverPagination.page <= 1} onClick={() => serverPagination.onPageChange(serverPagination.page - 1)}>‹</button>
                        <span>Page {serverPagination.page} of {totalPages}</span>
                        <button type="button" aria-label="Next page" disabled={serverPagination.page >= totalPages} onClick={() => serverPagination.onPageChange(serverPagination.page + 1)}>›</button>
                        <button type="button" aria-label="Last page" disabled={serverPagination.page >= totalPages} onClick={() => serverPagination.onPageChange(totalPages)}>»</button>
                    </div>
                </footer>
            )}
        </div>

    );

}
