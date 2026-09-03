import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    executeRequest,
    getRequestErrorMessage,
    isRequestAbort,
} from "../../api/request";
import { useDashboard } from "../../engine/DashboardContext";
import { buildWhere } from "../../engine/FilterQueryBuilder";
import { createRequestCacheKey, getCachedResponse, setCachedResponse } from "../../engine/RequestCache";
import { exportExcel, exportRowsCSV } from "../../engine/ExportEngine";

import type { ExportConfig, ExportFormat } from "../../types/export";
import type { FilterDefinition } from "../../types/filter";
import type { WidgetRequest } from "../../types/widget";
import ExportMenu, { type ExportMenuOption } from "../Common/ExportMenu";
import Loading from "../Common/Loading";

import "./TableWidget.css";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface TableWidgetProps {
    title: string;
    description?: string;
    pageSize?: number;
    pageSizeOptions?: number[];
    request: WidgetRequest;
    filterDefinitions?: FilterDefinition[];
    cacheScope?: string;
    exportConfig?: ExportConfig;
}

type SortDirection = "ASC" | "DESC";

interface SortState {
    column: string;
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
    title,
    description,
    pageSize,
    pageSizeOptions,
    request,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
    cacheScope = title,
    exportConfig,
}: TableWidgetProps) {
    const { refreshKey, appliedFilters } = useDashboard();

    const configuredPageSize = normalizePageSize(pageSize);
    const [pageSizeState, setPageSizeState] = useState<PageSizeState>({
        configured: configuredPageSize,
        value: configuredPageSize,
    });
    const activePageSize = pageSizeState.configured === configuredPageSize
        ? pageSizeState.value
        : configuredPageSize;
    const [rows, setRows] = useState<Record<string, unknown>[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [resultViewKey, setResultViewKey] = useState("");
    const [pageState, setPageState] = useState<PageState>({
        queryKey: "",
        page: 1,
    });
    const [sort, setSort] = useState<SortState | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const latestRequest = useRef(0);
    const resultViewKeyRef = useRef("");
    const previousRefreshKey = useRef(refreshKey);
    const previousRetryKey = useRef(retryKey);
    const [exportController, setExportController] = useState<AbortController | null>(null);
    const [exporting, setExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState("");

    const dashboardWhere = useMemo(
        () => buildWhere(appliedFilters, filterDefinitions),
        [appliedFilters, filterDefinitions]
    );

    const queryKey = useMemo(
        () => JSON.stringify({
            request,
            dashboardWhere,
            configuredPageSize,
        }),
        [request, dashboardWhere, configuredPageSize]
    );

    const currentPage = pageState.queryKey === queryKey
        ? pageState.page
        : 1;
    const viewKey = useMemo(
        () => JSON.stringify({ queryKey, currentPage, activePageSize, sort }),
        [queryKey, currentPage, activePageSize, sort]
    );
    const requestPayload = useMemo(() => ({
        ...request,
        where: [
            ...(Array.isArray(request.where) ? request.where : []),
            ...dashboardWhere,
        ],
        page: currentPage,
        pageSize: activePageSize,
        ...(sort ? { sort: [sort] } : {}),
    }), [request, dashboardWhere, currentPage, activePageSize, sort]);
    const cacheKey = useMemo(
        () => createRequestCacheKey(`dashboard:${cacheScope}`, requestPayload),
        [cacheScope, requestPayload]
    );

    const sizeOptions = useMemo(() => {
        const configured = pageSizeOptions?.filter(
            option => Number.isInteger(option) && option > 0
        ) ?? DEFAULT_PAGE_SIZE_OPTIONS;

        return [...new Set([...configured, activePageSize])]
            .sort((a, b) => a - b);
    }, [pageSizeOptions, activePageSize]);

    useEffect(() => {
        const forceRefresh = previousRefreshKey.current !== refreshKey
            || previousRetryKey.current !== retryKey;
        previousRefreshKey.current = refreshKey;
        previousRetryKey.current = retryKey;

        const controller = new AbortController();
        const requestId = ++latestRequest.current;

        const loadTable = async () => {
            if (!forceRefresh) {
                const cachedResponse = getCachedResponse(cacheKey);
                if (cachedResponse) {
                    const cachedRows = cachedResponse.data ?? [];
                    setRows(cachedRows);
                    setTotalRows(cachedResponse.totalRows ?? cachedResponse.rowsReturned ?? cachedRows.length);
                    resultViewKeyRef.current = viewKey;
                    setResultViewKey(viewKey);
                    setError(null);
                    setLoading(false);
                    return;
                }
            }

            setLoading(true);
            setError(null);

            try {
                const response = await executeRequest(
                    requestPayload,
                    { signal: controller.signal }
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
                const responseTotal = response.totalRows
                    ?? response.rowsReturned
                    ?? responseRows.length;
                const pageCount = Math.max(
                    1,
                    Math.ceil(responseTotal / activePageSize)
                );

                if (responseTotal > 0 && currentPage > pageCount) {
                    setPageState({ queryKey, page: pageCount });
                    return;
                }

                setRows(responseRows);
                setTotalRows(responseTotal);
                setCachedResponse(cacheKey, response);
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

        return () => controller.abort();
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
    ]);

    useEffect(() => () => exportController?.abort(), [exportController]);

    const resultMatchesView = resultViewKey === viewKey;
    const visibleRows = resultMatchesView ? rows : [];
    const visibleTotalRows = resultMatchesView ? totalRows : 0;
    const columns = visibleRows.length > 0
        ? Object.keys(visibleRows[0])
        : [];
    const totalPages = Math.max(
        1,
        Math.ceil(visibleTotalRows / activePageSize)
    );
    const visibleStart = visibleTotalRows === 0
        ? 0
        : (currentPage - 1) * activePageSize + 1;
    const visibleEnd = Math.min(
        visibleStart + visibleRows.length - 1,
        visibleTotalRows
    );

    const handleSort = (column: string) => {
        setSort(previous => ({
            column,
            direction:
                previous?.column === column && previous.direction === "ASC"
                    ? "DESC"
                    : "ASC",
        }));
        setPageState({ queryKey, page: 1 });
    };

    const handlePageSize = (value: number) => {
        setPageSizeState({
            configured: configuredPageSize,
            value,
        });
        setPageState({ queryKey, page: 1 });
    };

    const exportFileName = exportConfig?.filename || title.replace(/\s+/g, "-").toLowerCase();
    const exportRows = useCallback((data: Record<string, unknown>[], format: ExportFormat) => {
        if (format === "csv") exportRowsCSV(data, `${exportFileName}.csv`);
        else exportExcel(data, `${exportFileName}.xlsx`);
    }, [exportFileName]);

    const handleExportAll = useCallback(async (format: ExportFormat) => {
        exportController?.abort();
        const controller = new AbortController();
        setExportController(controller);
        setExporting(true);
        setExportStatus("Preparing export…");

        try {
            const response = await executeRequest({
                ...request,
                page: undefined,
                pageSize: undefined,
                where: [
                    ...(Array.isArray(request.where) ? request.where : []),
                    ...dashboardWhere,
                ],
                ...(sort ? { sort: [sort] } : {}),
            }, { signal: controller.signal });

            if (!response.success) {
                setExportStatus(response.message || "Unable to prepare the table export.");
                return;
            }
            const data = response.data ?? [];
            if (!data.length) {
                setExportStatus("There are no rows to export.");
                return;
            }
            exportRows(data, format);
            setExportStatus("");
        } catch (caughtError: unknown) {
            if (!isRequestAbort(caughtError)) {
                setExportStatus(getRequestErrorMessage(caughtError, "Unable to prepare the table export."));
            }
        } finally {
            setExportController(null);
            setExporting(false);
        }
    }, [request, dashboardWhere, sort, exportRows, exportController]);

    const exportOptions: ExportMenuOption[] = [];
    if (exportConfig?.enabled) {
        if (exportConfig.exportCurrentView !== false) {
            exportConfig.formats.forEach(format => exportOptions.push({
                id: `current-${format}`,
                label: `Current page — ${format === "csv" ? "CSV" : "Excel"}`,
                disabled: visibleRows.length === 0,
                onSelect: () => exportRows(visibleRows, format),
            }));
        }
        if (exportConfig.exportAll) {
            exportConfig.formats.forEach(format => exportOptions.push({
                id: `all-${format}`,
                label: `All rows — ${format === "csv" ? "CSV" : "Excel"}`,
                onSelect: () => void handleExportAll(format),
            }));
        }
    }

    const tableState = !resultMatchesView || (loading && visibleRows.length === 0)
        ? "loading"
        : error && visibleRows.length === 0
            ? "error"
            : visibleTotalRows === 0
                ? "empty"
                : "success";

    return (
        <section
            className="dashboard-table"
            aria-busy={loading || tableState === "loading"}
        >
            <header className="dashboard-table__header">
                <div className="dashboard-table__heading">
                    <h2>{title}</h2>
                    {description && <p>{description}</p>}
                </div>

                <div className="dashboard-table__header-actions">
                    {loading && visibleRows.length > 0 && (
                        <span className="dashboard-table__refreshing" role="status">Refreshing…</span>
                    )}
                    <ExportMenu options={exportOptions} disabled={loading && !visibleRows.length} busy={exporting} />
                </div>
            </header>

            {exportStatus && exportStatus !== "Preparing export…" && (
                <div className="dashboard-table__inline-error" role="status">{exportStatus}</div>
            )}

            {tableState === "loading" && (
                <Loading label="Loading table data…" compact />
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
                    <strong>No records found</strong>
                    <span>The current filters returned no table data.</span>
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
                    <div className="dashboard-table__viewport">
                        <table>
                            <colgroup>
                                {columns.map(column => (
                                    <col
                                        key={column}
                                        style={{ width: getColumnWidth(column, visibleRows) }}
                                    />
                                ))}
                            </colgroup>
                            <thead>
                                <tr>
                                    {columns.map(column => {
                                        const activeSort = sort?.column === column;

                                        return (
                                            <th key={column} scope="col">
                                                <button
                                                    type="button"
                                                    className="dashboard-table__sort"
                                                    onClick={() => handleSort(column)}
                                                    aria-label={`Sort by ${formatHeader(column)}`}
                                                >
                                                    <span>{formatHeader(column)}</span>
                                                    <span aria-hidden="true">
                                                        {activeSort
                                                            ? sort.direction === "ASC" ? "↑" : "↓"
                                                            : "↕"}
                                                    </span>
                                                </button>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((row, rowIndex) => (
                                    <tr key={`${currentPage}-${rowIndex}`}>
                                        {columns.map(column => {
                                            const value = String(row[column] ?? "");

                                            return (
                                                <td key={column} title={value}>
                                                    {value || <span aria-label="Empty value">—</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <footer className="dashboard-table__pagination">
                        <div className="dashboard-table__range">
                            Showing {visibleStart}–{visibleEnd} of {visibleTotalRows}
                        </div>

                        <label>
                            Rows
                            <select
                                value={activePageSize}
                                onChange={event => handlePageSize(Number(event.target.value))}
                                disabled={loading}
                                aria-label="Rows per page"
                            >
                                {sizeOptions.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>

                        <div className="dashboard-table__page-buttons">
                            <button
                                type="button"
                                onClick={() => setPageState({
                                    queryKey,
                                    page: Math.max(1, currentPage - 1),
                                })}
                                disabled={loading || currentPage <= 1}
                                aria-label="Previous page"
                            >
                                ‹
                            </button>
                            <span>Page {currentPage} of {totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setPageState({
                                    queryKey,
                                    page: Math.min(totalPages, currentPage + 1),
                                })}
                                disabled={loading || currentPage >= totalPages}
                                aria-label="Next page"
                            >
                                ›
                            </button>
                        </div>
                    </footer>
                </>
            )}
        </section>
    );
}
