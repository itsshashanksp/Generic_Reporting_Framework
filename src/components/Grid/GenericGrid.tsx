import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { AgGridReact } from "ag-grid-react";

import { useGrid } from "../../engine/GridContext";

import {
    compareGridValues,
    defaultColumn,
    defaultGridOptions,
    gridTheme,
} from "../../engine/GridEngine";
import { getContentMinWidth } from "../../engine/GridEngine/contentWidth";
import { formatValueForDisplay } from "../../engine/ValueFormatter";

import type { GridConfig, SortDefinition } from "../../types/report";
import type { ColumnAlignment, ColumnDefinition } from "../../types/column";
import MobileReportView from "./MobileReportView";
import Pagination from "./Pagination";
import { GRID_HEADER_HEIGHT, GRID_ROW_HEIGHT } from "./tableLayout";
import ReportingGrid from "./ReportingGrid";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

interface Props {
    rows: Record<string, unknown>[];
    columns: ColumnDefinition[];
    gridConfig: GridConfig;
    height?: CSSProperties["height"];
    autoHeight?: boolean;
    stableViewport?: boolean;
    initialSort?: SortDefinition[];
    serverPagination?: {
        page: number;
        pageSize: number;
        totalRows?: number | null;
        disabled?: boolean;
        onPageChange: (page: number) => void;
        onPageSizeChange: (pageSize: number) => void;
    };
    onSortChange?: (sort: Array<{ field: string; direction: "ASC" | "DESC" }>) => void;
    busy?: boolean;
}

const EMPTY_SORTS: SortDefinition[] = [];

function formatGridValue(value: unknown, dataType?: ColumnDefinition["dataType"]): string {
    return formatValueForDisplay(value, dataType);
}

function getColumnAlignment(column: Pick<ColumnDefinition, "align" | "dataType">): ColumnAlignment {
    return column.align ?? (column.dataType === "number" || column.dataType === "currency" ? "right" : "left");
}

export default function GenericGrid(props: Props) {
    if (props.gridConfig.grouping?.enabled) {
        const reportingConfigurationKey = JSON.stringify({
            pageSize: props.gridConfig.pagination.pageSize,
            groups: props.gridConfig.grouping.groups,
            expandedByDefault: props.gridConfig.grouping.expandedByDefault,
            showSubtotals: props.gridConfig.grouping.showSubtotals,
            showGrandTotal: props.gridConfig.grouping.showGrandTotal,
            subtotalPosition: props.gridConfig.grouping.subtotalPosition,
        });
        return <ReportingGrid key={reportingConfigurationKey} rows={props.rows} columns={props.columns} grouping={props.gridConfig.grouping} gridConfig={props.gridConfig} height={props.height} stableViewport={props.stableViewport} initialSort={props.initialSort} onSortChange={props.onSortChange} />;
    }
    return <StandardGrid {...props} />;
}

function StandardGrid({
    rows,
    columns,
    gridConfig,
    height,
    autoHeight = false,
    initialSort = EMPTY_SORTS,
    serverPagination,
    onSortChange,
    busy = false,
}: Props) {

    const { setApi } = useGrid();
    const usesNaturalHeight = autoHeight || height === undefined;

    const gridRef = useRef<AgGridReact>(null);
    const [selectedRows, setSelectedRows] = useState<Set<Record<string, unknown>>>(() => new Set());
    const [mobileSort, setMobileSort] = useState<{ field: string; direction: "asc" | "desc" } | null>(() => {
        const firstSort = initialSort[0];
        return firstSort ? {
            field: firstSort.field,
            direction: firstSort.direction === "DESC" ? "desc" : "asc",
        } : null;
    });
    const [mobileClientPage, setMobileClientPage] = useState(1);
    const [mobileClientPageSize, setMobileClientPageSize] = useState(gridConfig.pagination.pageSize);

    useEffect(() => () => setApi(null), [setApi]);

    const columnDefs = useMemo(() => {
        const getInitialSortState = (field: string) => {
            const sortIndex = initialSort.findIndex(sort => sort.field === field);
            if (sortIndex < 0) return {};

            return {
                initialSort: initialSort[sortIndex].direction === "DESC" ? "desc" as const : "asc" as const,
                initialSortIndex: sortIndex,
            };
        };
        return columns
                .filter(column => column.visible)
                .map(column => {
                    const alignment = getColumnAlignment(column);
                    return ({
                    field: column.field,
                    headerName: column.header,
                    sortable: column.sortable,
                    filter: false,
                    initialWidth: column.width,
                    flex: column.width === undefined ? 1 : undefined,
                    minWidth: getContentMinWidth(
                        rows,
                        column.field,
                        column.header,
                        column.sortable ?? true,
                        undefined,
                        column.dataType,
                    ),
                    valueFormatter: ({ value }: { value: unknown }) => formatGridValue(value, column.dataType),
                    dataType: column.dataType,
                    align: alignment,
                    cellClass: `universal-grid__cell--${alignment}`,
                    headerClass: `universal-grid__header--${alignment}`,
                    comparator: (left: unknown, right: unknown) => compareGridValues(left, right, column.dataType),
                    ...getInitialSortState(column.field),
                });
                });
    }, [columns, initialSort, rows]);

    const mobileColumns = useMemo(() => columnDefs.map(column => ({
        field: column.field,
        headerName: column.headerName,
        sortable: column.sortable !== false,
        dataType: column.dataType,
        align: column.align,
    })), [columnDefs]);

    const mobileRows = useMemo(() => {
        if (!mobileSort) return rows;

        return [...rows].sort((left, right) => {
            const leftValue = left[mobileSort.field];
            const rightValue = right[mobileSort.field];
            const dataType = mobileColumns.find(column => column.field === mobileSort.field)?.dataType;
            const comparison = compareGridValues(leftValue, rightValue, dataType);
            return mobileSort.direction === "desc" ? -comparison : comparison;
        });
    }, [mobileColumns, mobileSort, rows]);

    const usesClientPagination = gridConfig.pagination.enabled && !serverPagination;
    const clientTotalPages = Math.max(1, Math.ceil(mobileRows.length / mobileClientPageSize));
    const activeClientPage = Math.min(mobileClientPage, clientTotalPages);
    const displayedMobileRows = usesClientPagination
        ? mobileRows.slice(
            (activeClientPage - 1) * mobileClientPageSize,
            activeClientPage * mobileClientPageSize,
        )
        : mobileRows;
    const pagination = serverPagination
        ? {
            page: serverPagination.page,
            pageSize: serverPagination.pageSize,
            totalRows: serverPagination.totalRows,
            disabled: serverPagination.disabled ?? false,
            onPageChange: serverPagination.onPageChange,
            onPageSizeChange: serverPagination.onPageSizeChange,
        }
        : usesClientPagination
            ? {
                page: activeClientPage,
                pageSize: mobileClientPageSize,
                totalRows: mobileRows.length,
                disabled: false,
                onPageChange: setMobileClientPage,
                onPageSizeChange: (pageSize: number) => {
                    setMobileClientPageSize(pageSize);
                    setMobileClientPage(1);
                },
            }
            : null;
    useEffect(() => {
        if (usesClientPagination) gridRef.current?.api.paginationGoToPage(activeClientPage - 1);
    }, [activeClientPage, usesClientPagination]);
    const applyMobileSort = (field: string, direction: "asc" | "desc") => {
        const nextSort = field ? { field, direction } : null;
        setMobileSort(nextSort);
        setMobileClientPage(1);
        gridRef.current?.api.applyColumnState({
            state: nextSort ? [{ colId: nextSort.field, sort: nextSort.direction }] : [],
            defaultState: { sort: null },
        });
        if (!gridRef.current?.api && onSortChange) {
            onSortChange(nextSort ? [{ field: nextSort.field, direction: nextSort.direction === "desc" ? "DESC" : "ASC" }] : []);
        }
    };

    const toggleMobileSelection = (row: Record<string, unknown>) => {
        const nextSelected = !selectedRows.has(row);
        const singleSelection = gridConfig.rowSelection === "single";
        gridRef.current?.api.forEachNode(node => {
            if (node.data === row) node.setSelected(nextSelected, singleSelection);
        });
        setSelectedRows(previous => {
            const next = singleSelection ? new Set<Record<string, unknown>>() : new Set(previous);
            if (nextSelected) next.add(row);
            else next.delete(row);
            return next;
        });
    };

    return (

        <div
            className={`universal-grid${usesNaturalHeight ? " universal-grid--natural-height" : ""}`}
            data-grid-sizing={usesNaturalHeight ? "natural" : "bounded"}
            data-visible-rows={rows.length}
            aria-hidden={busy || undefined}
            inert={busy || undefined}
        >
            <div
                className={gridTheme.className}
                style={{
                    ...gridTheme.style,
                    ...(!usesNaturalHeight && height !== undefined ? { height } : { height: "auto" }),
                }}
            >

            <AgGridReact
                ref={gridRef}

                {...defaultGridOptions}

                onGridReady={(params) => {
                    setApi(params.api);
                }}

                onSelectionChanged={event => {
                    setSelectedRows(new Set(event.api.getSelectedRows()));
                }}

                rowData={rows}
                columnDefs={columnDefs}

                defaultColDef={defaultColumn}
                headerHeight={GRID_HEADER_HEIGHT}
                rowHeight={GRID_ROW_HEIGHT}
                domLayout={usesNaturalHeight ? "autoHeight" : "normal"}
                enableCellTextSelection

                pagination={gridConfig.pagination.enabled && !serverPagination}
                paginationPageSize={mobileClientPageSize}
                paginationPageSizeSelector={
                    gridConfig.pagination.pageSizeOptions
                }

                rowSelection={gridConfig.rowSelection}

                onSortChanged={event => {
                    const sorting: Array<{ field: string; direction: "ASC" | "DESC" }> = event.api.getColumnState()
                        .filter(column => column.sort === "asc" || column.sort === "desc")
                        .map(column => ({
                            field: column.colId,
                            direction: column.sort === "desc" ? "DESC" : "ASC",
                        }));
                    const firstSort = sorting[0];
                    setMobileSort(firstSort ? {
                        field: firstSort.field,
                        direction: firstSort.direction === "DESC" ? "desc" : "asc",
                    } : null);
                    onSortChange?.(sorting);
                }}
            />

            </div>

            <MobileReportView
                rows={displayedMobileRows}
                columns={mobileColumns}
                selectable={gridConfig.rowSelection === "single" || gridConfig.rowSelection === "multiple"}
                sort={mobileSort}
                isSelected={row => selectedRows.has(row)}
                onToggleSelection={toggleMobileSelection}
                onSortFieldChange={field => applyMobileSort(field, mobileSort?.direction ?? "asc")}
                onSortDirectionChange={() => {
                    if (mobileSort) applyMobileSort(mobileSort.field, mobileSort.direction === "asc" ? "desc" : "asc");
                }}
            />

            {pagination && gridConfig.pagination.enabled && (
                <Pagination
                    page={pagination.page}
                    pageSize={pagination.pageSize}
                    pageSizeOptions={gridConfig.pagination.pageSizeOptions}
                    totalRows={pagination.totalRows}
                    rowsOnPage={displayedMobileRows.length}
                    disabled={pagination.disabled}
                    config={gridConfig.pagination}
                    onPageChange={page => {
                        pagination.onPageChange(page);
                        if (usesClientPagination) gridRef.current?.api.paginationGoToPage(page - 1);
                    }}
                    onPageSizeChange={pageSize => {
                        pagination.onPageSizeChange(pageSize);
                        if (usesClientPagination) {
                            gridRef.current?.api.setGridOption("paginationPageSize", pageSize);
                            gridRef.current?.api.paginationGoToFirstPage();
                        }
                    }}
                    className={serverPagination ? "" : "universal-grid__pagination--client"}
                />
            )}
        </div>

    );

}
