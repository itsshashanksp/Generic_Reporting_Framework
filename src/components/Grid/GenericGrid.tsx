import { useEffect, useMemo, useRef, type CSSProperties } from "react";

import { AgGridReact } from "ag-grid-react";

import { useGrid } from "../../engine/GridContext";

import {
    defaultColumn,
    defaultGridOptions,
    gridTheme,
} from "../../engine/GridEngine";
import { getContentMinWidth } from "../../engine/GridEngine/contentWidth";

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
        disabled?: boolean;
        onPageChange: (page: number) => void;
        onPageSizeChange: (pageSize: number) => void;
    };
    onSortChange?: (sort: Array<{ field: string; direction: "ASC" | "DESC" }>) => void;
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
        const hasConfiguredGrouping = gridConfig.grouping?.enabled
            && ((gridConfig.grouping.groups?.length ?? 0) > 0
                || (gridConfig.grouping.aggregates?.length ?? 0) > 0);
        const groupedColumns = hasConfiguredGrouping
            ? gridConfig.grouping?.groups ?? []
            : [];
        const aggregateColumns = hasConfiguredGrouping
            ? gridConfig.grouping?.aggregates ?? []
            : [];

        return hasConfiguredGrouping
            ? [
                ...groupedColumns.map(group => ({
                    field: group.field,
                    headerName: group.header ?? group.field,
                    sortable: true,
                    filter: false,
                    initialWidth: 200,
                    minWidth: getContentMinWidth(
                        rows,
                        group.field,
                        group.header ?? group.field,
                        true,
                    ),
                })),
                ...aggregateColumns.map(aggregate => ({
                    field: aggregate.alias ?? `${aggregate.function}_${aggregate.field}`,
                    headerName: aggregate.header
                        ?? aggregate.alias
                        ?? `${aggregate.function} ${aggregate.field}`,
                    sortable: true,
                    filter: false,
                    initialWidth: 180,
                    minWidth: getContentMinWidth(
                        rows,
                        aggregate.alias ?? `${aggregate.function}_${aggregate.field}`,
                        aggregate.header
                            ?? aggregate.alias
                            ?? `${aggregate.function} ${aggregate.field}`,
                        true,
                    ),
                })),
            ]
            : columns
                .filter(column => column.visible)
                .map(column => ({
                    field: column.field,
                    headerName: column.header,
                    sortable: column.sortable,
                    filter: false,
                    initialWidth: column.width,
                    minWidth: getContentMinWidth(
                        rows,
                        column.field,
                        column.header,
                        column.sortable ?? true,
                    ),
                }));
    }, [columns, gridConfig.grouping, rows]);

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
                            field: column.colId,
                            direction: column.sort === "desc" ? "DESC" : "ASC",
                        })));
                } : undefined}
            />

            </div>

            {serverPagination && gridConfig.pagination.enabled && (
                <footer className="universal-grid__pagination" aria-label="Grid pagination">
                    <span className="universal-grid__range">
                        Showing {rangeStart}–{Math.max(rangeStart, rangeEnd)} of {serverPagination.totalRows}
                    </span>
                    <label className="universal-grid__page-size">
                        <span>Rows per page</span>
                        <select
                            aria-label="Rows per page"
                            value={serverPagination.pageSize}
                            disabled={serverPagination.disabled}
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
                    <div className="universal-grid__page-buttons" role="group" aria-label="Page navigation">
                        <button type="button" aria-label="First page" title="First page" disabled={serverPagination.disabled || serverPagination.page <= 1} onClick={() => serverPagination.onPageChange(1)}>«</button>
                        <button type="button" aria-label="Previous page" title="Previous page" disabled={serverPagination.disabled || serverPagination.page <= 1} onClick={() => serverPagination.onPageChange(serverPagination.page - 1)}>‹</button>
                        <span className="universal-grid__page-indicator">Page <strong>{serverPagination.page}</strong> of {totalPages}</span>
                        <button type="button" aria-label="Next page" title="Next page" disabled={serverPagination.disabled || serverPagination.page >= totalPages} onClick={() => serverPagination.onPageChange(serverPagination.page + 1)}>›</button>
                        <button type="button" aria-label="Last page" title="Last page" disabled={serverPagination.disabled || serverPagination.page >= totalPages} onClick={() => serverPagination.onPageChange(totalPages)}>»</button>
                    </div>
                </footer>
            )}
        </div>

    );

}
