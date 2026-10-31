import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import {
    executeRequest,
    getRequestErrorMessage,
    isRequestAbort,
} from "../../api/request";
import { useDashboard } from "../../engine/DashboardContext";
import type { FilterValues } from "../../engine/FilterContext";
import { buildFilters, composeRequestFilters } from "../../engine/FilterQueryBuilder";
import { mapWidgetFilters, type WidgetFilterFields } from "../../engine/DashboardEngine/filterFields";
import { createRequestCacheKey, getCachedResponse, getOrCreateInFlightRequest, setCachedResponse } from "../../engine/RequestCache";
import { ExportFileError, exportExcel, exportRowsCSV, fetchAllRowsForExport } from "../../engine/ExportEngine";

import type { ExportConfig, ExportFormat } from "../../types/export";
import type { FilterDefinition } from "../../types/filter";
import type { ColumnDefinition } from "../../types/column";
import { inferColumnDataType } from "../../engine/ColumnEngine";
import type { GridConfig, PaginationPresentationConfig } from "../../types/report";
import type { WidgetRequest, WidgetTableViewState } from "../../types/widget";
import type { GroupingConfig } from "../../types/grouping";
import { buildReportingExportRows } from "../../engine/GridEngine";
import ExportMenu, { type ExportMenuOption } from "../Common/ExportMenu";
import Skeleton from "../Common/Skeleton";
import GenericGrid from "../Grid/GenericGrid";
import ReportTableFrame from "../Grid/ReportTableFrame";
import { getDashboardTableContentHeight, getDashboardTableViewportHeight } from "./tableViewport";
import { resolveTableLayout } from "../Grid/tableLayout";
import WidgetFilterController, { type WidgetFilterControls } from "./WidgetFilterController";


const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
interface TableWidgetProps {
    title: string;
    description?: string;
    pageSize?: number;
    pageSizeOptions?: number[];
    pagination?: PaginationPresentationConfig;
    request: WidgetRequest;
    columns?: ColumnDefinition[];
    filterDefinitions?: FilterDefinition[];
    /** Renames shared dashboard filter fields for this widget (see DashboardWidget). */
    filterFields?: WidgetFilterFields;
    cacheScope?: string;
    exportConfig?: ExportConfig;
    runtimeFilters?: FilterDefinition[];
    runtimeFilterDisplay?: "inline" | "dialog";
    grouping?: GroupingConfig;
    headerActions?: ReactNode;
    viewState?: WidgetTableViewState;
    onViewStateChange?: (state: WidgetTableViewState) => void;
    runtimeFilterValues?: FilterValues;
    onRuntimeFilterValuesChange?: (values: FilterValues) => void;
}

type SortDirection = "ASC" | "DESC";

interface SortState {
    field: string;
    direction: SortDirection;
}

interface PageState {
    queryKey: string;
    page: number;
}

interface PageSizeState {
    configured: number;
    value: number;
}

function normalizePageSize(value: number | undefined) {
    return Number.isInteger(value) && (value ?? 0) > 0
        ? value as number
        : DEFAULT_PAGE_SIZE;
}

function formatHeader(field: string) {
    return field
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, character => character.toUpperCase());
}

function getColumnWidth(
    field: string,
    rows: Record<string, unknown>[]
) {
    const contentLength = rows
        .slice(0, 20)
        .reduce(
            (largest, row) => Math.max(
                largest,
                String(row[field] ?? "").length
            ),
            formatHeader(field).length
        );

    return Math.min(320, Math.max(140, contentLength * 8 + 32));
}

export default function TableWidget({
    runtimeFilters = EMPTY_FILTER_DEFINITIONS,
    ...props
}: TableWidgetProps) {
    return (
        <WidgetFilterController filters={runtimeFilters} database={props.request.database} widgetTitle={props.title} display={props.runtimeFilterDisplay}
            appliedValues={props.runtimeFilterValues} onAppliedValuesChange={props.onRuntimeFilterValuesChange}>
            {controls => <TableWidgetContent {...props} runtimeFilters={runtimeFilters} widgetFilterControls={controls} />}
        </WidgetFilterController>
    );
}

function TableWidgetContent({
    title,
    description,
    pageSize,
    pageSizeOptions,
    pagination,
    request,
    columns: configuredColumns,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
    filterFields,
    cacheScope = title,
    exportConfig,
    runtimeFilters = EMPTY_FILTER_DEFINITIONS,
    widgetFilterControls,
    grouping,
    headerActions,
    viewState,
    onViewStateChange,
}: TableWidgetProps & { widgetFilterControls: WidgetFilterControls }) {
    const { refreshKey, appliedFilters } = useDashboard();

    const configuredPageSize = normalizePageSize(pagination?.pageSize ?? pageSize);
    const [pageSizeState, setPageSizeState] = useState<PageSizeState>({
        configured: configuredPageSize,
        value: configuredPageSize,
    });
    const activePageSize = viewState?.pageSize ?? (pageSizeState.configured === configuredPageSize
        ? pageSizeState.value
        : configuredPageSize);
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [resultViewKey, setResultViewKey] = useState("");
    const [pageState, setPageState] = useState<PageState>({
        queryKey: "",
        page: 1,
    });
    const [sort, setSort] = useState<SortState | null>(() => viewState?.sort[0] ?? null);
    const [retryKey, setRetryKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const latestRequest = useRef(0);
    const resultViewKeyRef = useRef("");
    const previousRefreshKey = useRef(refreshKey);
    const previousRetryKey = useRef(retryKey);
    const [exportController, setExportController] = useState<AbortController | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState("");
    const [exportError, setExportError] = useState("");
    const previousExportRequestKey = useRef("");
    const controlledViewStateRef = useRef(viewState);
    const onViewStateChangeRef = useRef(onViewStateChange);
    useEffect(() => {
        controlledViewStateRef.current = viewState;
        onViewStateChangeRef.current = onViewStateChange;
    }, [viewState, onViewStateChange]);

    // Screen requests and export-all share these, so both use the mapped fields.
    const dashboardFilters = useMemo(() => {
        const { filters, values } = mapWidgetFilters(filterDefinitions, appliedFilters, filterFields);
        return buildFilters(values, filters, request.action === "sql");
    }, [appliedFilters, filterDefinitions, filterFields, request.action]);
    const widgetFilters = useMemo(
        () => buildFilters(widgetFilterControls.appliedValues, runtimeFilters, request.action === "sql"),
        [widgetFilterControls.appliedValues, runtimeFilters, request.action]
    );
    const hasActiveFilters = composeRequestFilters(request.filters, dashboardFilters, widgetFilters).length > 0;
    const reportingEnabled = grouping?.enabled === true;

    const queryKey = useMemo(
        () => JSON.stringify({
            request,
            dashboardFilters,
            widgetFilters,
            configuredPageSize,
        }),
        [request, dashboardFilters, widgetFilters, configuredPageSize]
    );

    const currentPage = viewState
        ? viewState.queryKey === undefined || viewState.queryKey === queryKey ? viewState.page : 1
        : pageState.queryKey === queryKey ? pageState.page : 1;
    const viewKey = useMemo(
        () => JSON.stringify({ queryKey, currentPage, activePageSize, sort }),
        [queryKey, currentPage, activePageSize, sort]
    );
    const requestPayload = useMemo(() => ({
        ...request,
        filters: composeRequestFilters(request.filters, dashboardFilters, widgetFilters),
        pagination: { page: currentPage, pageSize: activePageSize },
        ...(sort ? { sort: [sort] } : {}),
    }), [request, dashboardFilters, widgetFilters, currentPage, activePageSize, sort]);
    const cacheKey = useMemo(
        () => createRequestCacheKey(`dashboard:${cacheScope}`, requestPayload),
        [cacheScope, requestPayload]
    );
    const exportRequestKey = useMemo(() => JSON.stringify({
        request,
        dashboardFilters,
        widgetFilters,
        sort,
        exportConfig,
    }), [request, dashboardFilters, widgetFilters, sort, exportConfig]);
    const cachedResponse = useMemo(
        () => getCachedResponse(cacheKey),
        [cacheKey]
    );

    const sizeOptions = useMemo(() => {
        const configured = (pagination?.pageSizeOptions ?? pageSizeOptions)?.filter(
            option => Number.isInteger(option) && option > 0
        ) ?? DEFAULT_PAGE_SIZE_OPTIONS;

        return [...new Set([...configured, activePageSize])]
            .sort((a, b) => a - b);
    }, [pagination?.pageSizeOptions, pageSizeOptions, activePageSize]);
    const gridConfig = useMemo<GridConfig>(() => ({
        pagination: {
            enabled: true,
            pageSize: activePageSize,
            pageSizeOptions: sizeOptions,
            style: "modern",
            showTotalRecords: pagination?.showTotalRecords ?? true,
            showPageNumbers: pagination?.showPageNumbers ?? true,
            showFirstLast: pagination?.showFirstLast ?? false,
        },
        rowSelection: "multiple",
        ...(grouping ? { grouping } : {}),
    }), [activePageSize, sizeOptions, pagination?.showTotalRecords, pagination?.showPageNumbers, pagination?.showFirstLast, grouping]);

    useEffect(() => {
        const forceRefresh = previousRefreshKey.current !== refreshKey
            || previousRetryKey.current !== retryKey;
        previousRefreshKey.current = refreshKey;
        previousRetryKey.current = retryKey;

        const controller = new AbortController();
        const requestId = ++latestRequest.current;

        const loadTable = async () => {
            if (!forceRefresh && !reportingEnabled) {
                const cachedResponse = getCachedResponse(cacheKey);
                if (cachedResponse) {
                    const cachedRows = cachedResponse.data ?? [];
                    setRows(cachedRows);
                    setTotalRows(cachedResponse.meta?.totalRows ?? cachedResponse.meta?.rowsReturned ?? cachedRows.length);
                    resultViewKeyRef.current = viewKey;
                    setResultViewKey(viewKey);
                    setError(null);
                    setLoading(false);
                    if (controlledViewStateRef.current?.queryKey !== queryKey) {
                        onViewStateChangeRef.current?.({ ...controlledViewStateRef.current!, queryKey, page: currentPage });
                    }
                    return;
                }
            }

            setLoading(true);
            setError(null);

            try {
                const response = reportingEnabled
                    ? {
                        success: true as const,
                        message: "OK",
                        data: await fetchAllRowsForExport({
                            ...request,
                            pagination: undefined,
                            filters: composeRequestFilters(request.filters, dashboardFilters, widgetFilters),
                            ...(sort ? { sort: [sort] } : {}),
                        }, { signal: controller.signal }),
                        meta: undefined,
                    }
                    : await getOrCreateInFlightRequest(
                        cacheKey,
                        signal => executeRequest(requestPayload, { signal }),
                        controller.signal
                    );

                if (requestId !== latestRequest.current) {
                    return;
                }

                if (!response.success) {
                    if (resultViewKeyRef.current !== viewKey) {
                        setRows([]);
                        setTotalRows(0);
                    }
                    resultViewKeyRef.current = viewKey;
                    setResultViewKey(viewKey);
                    setError(response.message || "The API could not load this table.");
                    return;
                }

                const responseRows = response.data ?? [];
                const responseTotal = response.meta?.totalRows
                    ?? response.meta?.rowsReturned
                    ?? responseRows.length;
                const pageCount = Math.max(
                    1,
                    Math.ceil(responseTotal / activePageSize)
                );

                if (responseTotal > 0 && currentPage > pageCount) {
                    if (controlledViewStateRef.current) onViewStateChangeRef.current?.({ ...controlledViewStateRef.current, queryKey, page: pageCount });
                    else setPageState({ queryKey, page: pageCount });
                    return;
                }

                if (controlledViewStateRef.current?.queryKey !== queryKey) {
                    onViewStateChangeRef.current?.({ ...controlledViewStateRef.current!, queryKey, page: currentPage });
                }

                setRows(responseRows);
                setTotalRows(responseTotal);
                if (!reportingEnabled) setCachedResponse(cacheKey, response);
                resultViewKeyRef.current = viewKey;
                setResultViewKey(viewKey);
            } catch (caughtError: unknown) {
                if (
                    isRequestAbort(caughtError)
                    || requestId !== latestRequest.current
                ) {
                    return;
                }

                if (resultViewKeyRef.current !== viewKey) {
                    setRows([]);
                    setTotalRows(0);
                }
                resultViewKeyRef.current = viewKey;
                setResultViewKey(viewKey);
                setError(getRequestErrorMessage(
                    caughtError,
                    "An unexpected error occurred while loading the table."
                ));
            } finally {
                if (requestId === latestRequest.current) {
                    setLoading(false);
                }
            }
        };

        void loadTable();

        return () => {
            // Abort the HTTP consumer and independently invalidate its result.
            // The sequence guard protects the view if cancellation cannot stop
            // work already executing on the server.
            if (latestRequest.current === requestId) {
                latestRequest.current += 1;
            }
            controller.abort();
        };
    }, [
        requestPayload,
        cacheKey,
        queryKey,
        viewKey,
        currentPage,
        activePageSize,
        sort,
        refreshKey,
        retryKey,
        reportingEnabled,
        request,
        dashboardFilters,
        widgetFilters,
    ]);

    useEffect(() => {
        const previous = previousExportRequestKey.current;
        previousExportRequestKey.current = exportRequestKey;
        if (previous && previous !== exportRequestKey && exportController) {
            exportController.abort();
            setExportError("Export canceled because the table filters, sorting, or database changed.");
        }
    }, [exportRequestKey, exportController]);

    useEffect(() => () => exportController?.abort(), [exportController]);

    const resultMatchesView = resultViewKey === viewKey;
    const canShowCachedResponse = !resultMatchesView && cachedResponse !== null;
    const cachedRows = cachedResponse?.data ?? [];
    const visibleRows = resultMatchesView ? rows : cachedRows;
    const visibleTotalRows = resultMatchesView
        ? totalRows
        : cachedResponse?.meta?.totalRows
            ?? cachedResponse?.meta?.rowsReturned
            ?? cachedRows.length;
    const isViewLoading = canShowCachedResponse ? false : loading;
    const configuredGridColumns = useMemo<ColumnDefinition[]>(
        () => configuredColumns?.map(column => ({
            ...column,
            visible: viewState?.columnVisibility[column.field] ?? column.visible !== false,
            sortable: column.sortable !== false,
        })) ?? [],
        [configuredColumns, viewState?.columnVisibility]
    );
    const inferredGridColumns = useMemo<ColumnDefinition[]>(
        () => {
            const columnRows = visibleRows.length > 0 ? visibleRows : rows;
            return columnRows.length > 0
            ? Object.keys(columnRows[0]).map(field => ({
                field,
                header: formatHeader(field),
                dataType: inferColumnDataType(field),
                visible: true,
                sortable: true,
                width: getColumnWidth(field, columnRows),
            }))
            : [];
        },
        [visibleRows, rows]
    );
    const columns = configuredGridColumns.length > 0
        ? configuredGridColumns
        : inferredGridColumns;
    const handleSort = (sorting: SortState[]) => {
        if (isViewLoading) return;
        const nextSort = sorting[0] ?? null;
        if (sort?.field === nextSort?.field && sort?.direction === nextSort?.direction) {
            return;
        }

        setSort(nextSort);
        if (viewState) onViewStateChange?.({
            ...viewState,
            queryKey,
            page: 1,
            sort: nextSort ? [nextSort] : [],
        });
        else setPageState({ queryKey, page: 1 });
    };

    const handlePageSize = (value: number) => {
        setPageSizeState({
            configured: configuredPageSize,
            value,
        });
        if (viewState) onViewStateChange?.({ ...viewState, queryKey, page: 1, pageSize: value });
        else setPageState({ queryKey, page: 1 });
    };

    const exportFileName = exportConfig?.filename || title.replace(/\s+/g, "-").toLowerCase();
    const exportRows = useCallback(async (data: Record<string, unknown>[], format: ExportFormat) => {
        if (format === "excel") {
            await exportExcel(data, `${exportFileName}.xlsx`, columns);
            return;
        }
        try {
            exportRowsCSV(data, `${exportFileName}.csv`);
        } catch (cause: unknown) {
            throw new ExportFileError("The CSV file could not be created.", { cause });
        }
    }, [columns, exportFileName]);

    const handleExportAll = useCallback(async (format: ExportFormat) => {
        const controller = new AbortController();
        setExportController(previous => {
            previous?.abort();
            return controller;
        });
        setExporting(true);
        setExportProgress("Preparing export…");
        setExportError("");

        try {
            const data = await fetchAllRowsForExport({
                ...request,
                pagination: undefined,
                filters: composeRequestFilters(request.filters, dashboardFilters, widgetFilters),
                ...(sort ? { sort: [sort] } : {}),
            }, {
                signal: controller.signal,
                onProgress: (loadedRows, totalRowsForExport) => {
                    setExportProgress(totalRowsForExport === null
                        ? `Preparing export… ${loadedRows.toLocaleString()} rows`
                        : `Preparing export… ${loadedRows.toLocaleString()} of ${totalRowsForExport.toLocaleString()} rows`);
                },
            });
            if (!data.length) {
                setExportError("Export failed: there are no matching rows to export.");
                return;
            }
            if (controller.signal.aborted) return;
            await exportRows(grouping?.exportMode === "grouped"
                ? buildReportingExportRows(data, grouping, columns, sort ? [sort] : [])
                : data, format);
        } catch (caughtError: unknown) {
            if (!isRequestAbort(caughtError)) {
                const message = getRequestErrorMessage(caughtError, "Unable to prepare the table export.");
                setExportError(`Export failed: ${message}`);
            }
        } finally {
            setExportController(previous => previous === controller ? null : previous);
            setExportProgress("");
            setExporting(false);
        }
    }, [request, dashboardFilters, widgetFilters, sort, exportRows, grouping, columns]);

    const exportOptions: ExportMenuOption[] = [];
    if (exportConfig?.enabled) {
        if (exportConfig.exportCurrentView !== false && !reportingEnabled) {
            exportConfig.formats.forEach(format => exportOptions.push({
                id: `current-${format}`,
                label: `Current page — ${format === "csv" ? "CSV" : "Excel"}`,
                disabled: visibleRows.length === 0,
                onSelect: () => {
                    setExportError("");
                    setExporting(true);
                    void exportRows(visibleRows, format)
                        .catch((caughtError: unknown) => {
                            setExportError(`Export failed: ${getRequestErrorMessage(caughtError, "Unable to create the export file.")}`);
                        })
                        .finally(() => setExporting(false));
                },
            }));
        }
        if (exportConfig.exportAll) {
            exportConfig.formats.forEach(format => exportOptions.push({
                id: `all-${format}`,
                label: `All rows — ${format === "csv" ? "CSV" : "Excel"}`,
                disabled: visibleTotalRows === 0,
                onSelect: () => void handleExportAll(format),
            }));
        }
    }

    const tableState = (!resultMatchesView && !canShowCachedResponse) || (isViewLoading && visibleRows.length === 0)
        ? "loading"
        : error && visibleRows.length === 0
            ? "error"
            : visibleTotalRows === 0
                ? "empty"
                : "success";
    const preserveGridDuringLoading = tableState === "loading" && rows.length > 0 && columns.length > 0;
    const showRefreshingStatus = isViewLoading && (visibleRows.length > 0 || rows.length > 0);
    const tableViewportHeight = getDashboardTableViewportHeight(activePageSize);
    const tableLayout = resolveTableLayout(activePageSize, { fixedViewport: true });
    const renderGrid = (gridRows: Record<string, unknown>[], gridTotalRows: number) => {
        return <GenericGrid
            rows={gridRows}
            columns={columns}
            gridConfig={gridConfig}
            height={reportingEnabled
                ? tableViewportHeight
                : getDashboardTableContentHeight(gridRows.length, activePageSize)}
            autoHeight={false}
            stableViewport={reportingEnabled}
            initialSort={sort ? [sort] : request.sort}
            serverPagination={reportingEnabled ? undefined : {
                page: currentPage,
                pageSize: activePageSize,
                totalRows: gridTotalRows,
                disabled: isViewLoading,
                onPageChange: page => viewState
                    ? onViewStateChange?.({ ...viewState, queryKey, page })
                    : setPageState({ queryKey, page }),
                onPageSizeChange: handlePageSize,
            }}
            onSortChange={handleSort}
            onColumnVisibilityChange={columnVisibility => {
                if (viewState) onViewStateChange?.({ ...viewState, columnVisibility });
            }}
            busy={tableState === "loading"}
        />;
    };

    return (
        <ReportTableFrame
            className="dashboard-table"
            title={title}
            description={description}
            busy={isViewLoading || tableState === "loading"}
            actions={(
                <>
                    <span
                        className="report-table-frame__status"
                        role={showRefreshingStatus ? "status" : undefined}
                        aria-hidden={showRefreshingStatus ? undefined : true}
                    >{showRefreshingStatus ? "Refreshing…" : ""}</span>
                    {headerActions}
                    {widgetFilterControls.button}
                    <ExportMenu
                        options={exportOptions}
                        disabled={isViewLoading && !visibleRows.length}
                        busy={exporting}
                        mobileTriggerLabel="More"
                    />
                </>
            )}
        >

            {widgetFilterControls.panel}

            {exportProgress && (
                <div className="dashboard-table__export-progress" role="status">{exportProgress}</div>
            )}

            {exportError && (
                <div className="dashboard-table__inline-error" role="alert">{exportError}</div>
            )}

            {tableState === "loading" && !preserveGridDuringLoading && (
                <div className="dashboard-table__skeleton" style={{ height: tableViewportHeight + 58 }}>
                    <Skeleton kind="table" label="Loading table data…" columns={columns.length || 4} tableColumns={columns} rows={activePageSize} tableLayout={tableLayout} showPagination />
                </div>
            )}

            {preserveGridDuringLoading && (
                <div className="dashboard-table__loading-grid" aria-label="Updating table data">
                    {renderGrid(rows, totalRows)}
                    <Skeleton kind="table" label="Updating table data…" columns={columns.length || 4} tableColumns={columns} rows={activePageSize} tableLayout={tableLayout} showPagination />
                </div>
            )}

            {tableState === "error" && (
                <div className="dashboard-table__state dashboard-table__state--error" role="alert">
                    <strong>Unable to load table</strong>
                    <span>{error}</span>
                    <span>Refresh the dashboard or change a filter to try again.</span>
                    <button
                        type="button"
                        className="app-button ui-state__action"
                        onClick={() => setRetryKey(previous => previous + 1)}
                    >
                        Try again
                    </button>
                </div>
            )}

            {tableState === "empty" && (
                <div className="dashboard-table__state" role="status">
                    <strong>{hasActiveFilters ? "No matching records found" : "No data available"}</strong>
                    <span>{hasActiveFilters ? "Try adjusting your filters." : "There is no data to display."}</span>
                </div>
            )}

            {tableState === "success" && (
                <>
                    {error && (
                        <div className="dashboard-table__inline-error" role="alert">
                            <span>The latest refresh failed. Existing data is still shown.</span>
                            <button
                                type="button"
                                className="app-button"
                                onClick={() => setRetryKey(previous => previous + 1)}
                            >
                                Retry
                            </button>
                        </div>
                    )}
                    {renderGrid(visibleRows, visibleTotalRows)}
                </>
            )}
        </ReportTableFrame>
    );
}
