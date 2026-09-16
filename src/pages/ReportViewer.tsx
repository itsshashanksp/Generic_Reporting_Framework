import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";

import {
    executeRequest,
    getRequestErrorMessage,
    isRequestAbort,
} from "../api/request";
import Empty from "../components/Common/Empty";
import ErrorState from "../components/Common/Error";
import Loading from "../components/Common/Loading";
import usePullToRefresh from "../components/Common/usePullToRefresh";
import { ResponsiveFilterPanel } from "../components/Filters";
import GenericGrid from "../components/Grid/GenericGrid";
import ReportTableFrame from "../components/Grid/ReportTableFrame";
import SavedReports from "../components/SavedReports/SavedReports";
import { ReportToolbar } from "../components/Toolbar";
import { useFilters } from "../engine/FilterContext";
import { buildFilters } from "../engine/FilterQueryBuilder";
import { isEmptyFilterValue } from "../engine/FilterEngine";
import { useGrid } from "../engine/GridContext";
import { getReportPaginationParameters, isSavedReportsEnabled } from "../engine/ReportDefinitionEngine";
import { getReport, getReportError } from "../engine/ReportEngine/reportLoader";
import { createRequestCacheKey, getCachedResponse, getOrCreateInFlightRequest, setCachedResponse } from "../engine/RequestCache";
import { saveSavedReport } from "../engine/SavedReportEngine";
import { exportExcel, exportRowsCSV } from "../engine/ExportEngine";
import type { ApiResponse } from "../types/api";
import type { FilterValue } from "../engine/FilterContext/FilterContext";
import type { SavedReport } from "../types/savedReport";
import type { SortDefinition } from "../types/report";


export default function ReportViewer() {
    const { reportId } = useParams();
    const { filters, replaceFilters, clearFilters } = useFilters();
    const { api } = useGrid();
    const report = getReport(reportId || "") ?? null;
    const reportConfigurationError = getReportError(reportId || "");
    const [initialRequestState] = useState(() => {
        if (!report) {
            return { response: null, pageSize: 10 };
        }

        const pageSize = report.grid.pagination.pageSize;
        const requestPayload = {
            ...report.request,
            filters: Array.isArray(report.request.filters) ? report.request.filters : [],
            sort: report.request.sort ?? [],
            ...getReportPaginationParameters(report.grid.pagination, 1, pageSize),
        };

        return {
            response: getCachedResponse(createRequestCacheKey(`report:${report.id}`, requestPayload)),
            pageSize,
        };
    });

    const [result, setResult] = useState<ApiResponse | null>(initialRequestState.response);
    const [loadedReportId, setLoadedReportId] = useState(
        initialRequestState.response && report ? report.id : ""
    );
    const [isGridLoading, setIsGridLoading] = useState(!initialRequestState.response);
    const [gridError, setGridError] = useState("");
    const [filterError, setFilterError] = useState("");
    const [exportStatus, setExportStatus] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [currentPageSize, setCurrentPageSize] = useState(initialRequestState.pageSize);
    const [currentSorting, setCurrentSorting] = useState<SortDefinition[]>(report?.request.sort ?? []);
    const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>({});
    const [savedReportsRevision, setSavedReportsRevision] = useState(0);
    const requestSequence = useRef(0);
    const activeController = useRef<AbortController | null>(null);
    const exportController = useRef<AbortController | null>(null);
    const rows = result?.success && loadedReportId === report?.id ? result.data ?? [] : [];

    const loadReport = useCallback(async (
        activeFilters: Record<string, unknown> = {},
        activePage = 1,
        activePageSize = report?.grid.pagination.pageSize ?? 10,
        activeSorting: SortDefinition[] = report?.request.sort ?? [],
        bypassCache = false
    ) => {
        if (!report) {
            return;
        }

        activeController.current?.abort();
        const sequence = ++requestSequence.current;
        const pagination = getReportPaginationParameters(
            report.grid.pagination,
            activePage,
            activePageSize
        );
        const requestPayload = {
            ...report.request,
            filters: [
                ...(Array.isArray(report.request.filters) ? report.request.filters : []),
                ...buildFilters(activeFilters, report.filters ?? []),
            ],
            sort: activeSorting,
            ...pagination,
        };
        const cacheKey = createRequestCacheKey(`report:${report.id}`, requestPayload);

        if (!bypassCache) {
            const cachedResponse = getCachedResponse(cacheKey);
            if (cachedResponse) {
                setResult(cachedResponse);
                setLoadedReportId(report.id);
                setCurrentPage(activePage);
                setCurrentPageSize(activePageSize);
                setCurrentSorting(activeSorting);
                setGridError("");
                setIsGridLoading(false);
                return;
            }
        }

        const controller = new AbortController();
        activeController.current = controller;
        setIsGridLoading(true);
        setGridError("");

        try {
            const response = await getOrCreateInFlightRequest(
                cacheKey,
                signal => executeRequest(requestPayload, { signal }),
                controller.signal
            );

            if (sequence !== requestSequence.current) {
                return;
            }

            if (!response.success) {
                setGridError(response.message || "The API could not load this report.");
                return;
            }

            setResult(response);
            setCachedResponse(cacheKey, response);
            setLoadedReportId(report.id);
            setCurrentPage(activePage);
            setCurrentPageSize(activePageSize);
            setCurrentSorting(activeSorting);
        } catch (error: unknown) {
            if (isRequestAbort(error) || sequence !== requestSequence.current) {
                return;
            }

            const message = getRequestErrorMessage(
                error,
                "An unexpected error occurred while loading the report."
            );
            setGridError(message);
        } finally {
            if (sequence === requestSequence.current) {
                setIsGridLoading(false);
            }
        }
    }, [report]);

    useEffect(() => {
        if (!report) {
            return;
        }

        const timer = window.setTimeout(() => {
            clearFilters();
            setAppliedFilters({});
            void loadReport({}, 1, report.grid.pagination.pageSize, report.request.sort ?? []);
        }, 0);

        return () => {
            window.clearTimeout(timer);
            activeController.current?.abort();
            exportController.current?.abort();
        };
    }, [report, clearFilters, loadReport]);

    const validateRequiredFilters = () => {
        const missing = report?.filters.filter(
            filter => filter.required && isEmptyFilterValue(filters[filter.field])
        ) ?? [];

        if (missing.length === 0) {
            setFilterError("");
            return true;
        }

        setFilterError(`Complete the required filter${missing.length > 1 ? "s" : ""}: ${missing.map(filter => filter.label).join(", ")}.`);
        return false;
    };

    const getGridSorting = (): SortDefinition[] => api?.getColumnState()
        .filter(column => column.sort === "asc" || column.sort === "desc")
        .map(column => ({
            field: column.colId,
            direction: column.sort === "desc" ? "DESC" : "ASC",
        })) ?? report?.request.sort ?? [];

    const handleSearch = () => {
        if (!validateRequiredFilters()) {
            return false;
        }

        setCurrentPage(1);
        setAppliedFilters({ ...filters });
        void loadReport(filters, 1, undefined, getGridSorting());
        return true;
    };

    const handleClear = () => {
        clearFilters();
        setFilterError("");
        setCurrentPage(1);
        setAppliedFilters({});
        void loadReport({}, 1, undefined, getGridSorting());
    };

    const handleRefresh = useCallback(() => {
        void loadReport(appliedFilters, currentPage, currentPageSize, currentSorting, true);
    }, [appliedFilters, currentPage, currentPageSize, currentSorting, loadReport]);

    const {
        containerRef: reportPageRef,
        pullDistance,
        armed: pullToRefreshArmed,
    } = usePullToRefresh({
        onRefresh: handleRefresh,
        disabled: isGridLoading,
    });

    const handleSaveReport = () => {
        if (!report) {
            return;
        }

        const now = new Date().toISOString();
        const savedPage = currentPage;
        const savedPageSize = currentPageSize;
        const sorting = currentSorting;

        saveSavedReport({
            id: `${report.id}-${Date.now()}`,
            reportId: report.id,
            name: report.title,
            createdAt: now,
            updatedAt: now,
            state: {
                filters: appliedFilters,
                sorting,
                pagination: { page: savedPage, pageSize: savedPageSize },
            },
        });

        setSavedReportsRevision(previous => previous + 1);
        window.alert("Report saved successfully.");
    };

    const handleLoadSavedReport = async (savedReport: SavedReport) => {
        if (!report) {
            return;
        }

        const savedPage = savedReport.state.pagination?.page ?? 1;
        const savedPageSize = savedReport.state.pagination?.pageSize
            ?? report.grid.pagination.pageSize;
        replaceFilters(savedReport.state.filters);
        setAppliedFilters({ ...savedReport.state.filters });
        setFilterError("");
        setCurrentPage(savedPage);
        await loadReport(savedReport.state.filters, savedPage, savedPageSize, savedReport.state.sorting);

        if (api) {
            api.setGridOption("paginationPageSize", savedPageSize);
            api.applyColumnState({
                state: savedReport.state.sorting.map(sort => ({
                    colId: sort.field,
                    sort: sort.direction.toLowerCase() as "asc" | "desc",
                })),
                defaultState: { sort: null },
            });
        }
    };

    const handleExportAll = async (format: "csv" | "excel") => {
        if (!report) {
            return;
        }

        exportController.current?.abort();
        const controller = new AbortController();
        exportController.current = controller;
        setExportStatus("Preparing export…");

        try {
            const response = await executeRequest(
                {
                    ...report.request,
                    pagination: undefined,
                    filters: [
                        ...(Array.isArray(report.request.filters)
                            ? report.request.filters
                            : []),
                        ...buildFilters(appliedFilters, report.filters ?? []),
                    ],
                    sort: currentSorting,
                },
                { signal: controller.signal }
            );

            if (!response.success) {
                setExportStatus(response.message || "Unable to prepare the export.");
                return;
            }

            const exportRows = response.data ?? [];
            if (exportRows.length === 0) {
                setExportStatus("There are no rows to export.");
                return;
            }

            if (format === "csv") {
                exportRowsCSV(
                    exportRows,
                    report.export?.filename ? `${report.export.filename}.csv` : "report.csv"
                );
            } else {
                exportExcel(
                    exportRows,
                    report.export?.filename
                        ? `${report.export.filename}.xlsx`
                        : "report.xlsx"
                );
            }

            setExportStatus("");
        } catch (error: unknown) {
            if (!isRequestAbort(error)) {
                setExportStatus(getRequestErrorMessage(error, "Unable to prepare the export."));
            }
        }
    };

    if (!report) {
        return (
            <ErrorState
                title={reportConfigurationError ? "Report configuration error" : "Report not found"}
                message={reportConfigurationError ?? `Report "${reportId || ""}" was not found.`}
            />
        );
    }

    return (
        <main ref={reportPageRef} className="report-page">
            <div
                className="pull-to-refresh"
                style={{ "--pull-distance": `${pullDistance}px` } as CSSProperties}
                aria-hidden={pullDistance === 0}
            >
                {pullToRefreshArmed ? "Release to refresh" : "Pull to refresh"}
            </div>
            <header className="report-page__header">
                <div>
                    <h1>{report.title}</h1>
                    {report.description && <p>{report.description}</p>}
                </div>
            </header>

            {report.filters.length > 0 && (
                <ResponsiveFilterPanel
                    filters={report.filters}
                    className="report-section"
                    error={filterError}
                    disabled={isGridLoading}
                    onApply={handleSearch}
                    onClear={handleClear}
                />
            )}

            {isSavedReportsEnabled(report.toolbar) && (
                <SavedReports
                    key={`${report.id}-${savedReportsRevision}`}
                    reportId={report.id}
                    onLoad={handleLoadSavedReport}
                />
            )}

            <ReportTableFrame
                title="Report Result"
                ariaLabel="Report results"
                busy={isGridLoading}
                actions={(
                    <>
                        {exportStatus && (
                            <p
                                className={exportStatus === "Preparing export…" ? "report-status" : "form-error"}
                                role="status"
                            >
                                {exportStatus}
                            </p>
                        )}
                        <ReportToolbar
                            config={report.toolbar}
                            exportConfig={report.export}
                            onRefresh={handleRefresh}
                            isRefreshing={isGridLoading}
                            isExporting={exportStatus === "Preparing export…"}
                            onExportAll={handleExportAll}
                            onSaveReport={handleSaveReport}
                            rows={rows}
                        />
                    </>
                )}
            >
                    {gridError && rows.length > 0 && (
                        <div className="report-inline-error" role="alert">
                            <span>{gridError}</span>
                            <button type="button" className="app-button" onClick={handleRefresh}>Try again</button>
                        </div>
                    )}

                    {rows.length > 0 && (
                        <GenericGrid
                            rows={rows}
                            columns={report.columns}
                            gridConfig={report.grid}
                            initialSort={report.sort}
                            serverPagination={{
                                page: currentPage,
                                pageSize: currentPageSize,
                                totalRows: result?.meta?.totalRows ?? result?.meta?.rowsReturned ?? rows.length,
                                disabled: isGridLoading,
                                onPageChange: page => void loadReport(appliedFilters, page, currentPageSize, currentSorting),
                                onPageSizeChange: pageSize => void loadReport(appliedFilters, 1, pageSize, currentSorting),
                            }}
                            onSortChange={sorting => void loadReport(appliedFilters, 1, currentPageSize, sorting)}
                        />
                    )}

                    {!isGridLoading && gridError && rows.length === 0 && (
                        <ErrorState message={gridError} onRetry={() => void loadReport(appliedFilters, currentPage, currentPageSize, currentSorting, true)} />
                    )}

                    {!isGridLoading && !gridError && rows.length === 0 && <Empty />}

                    {isGridLoading && (
                        <div className="report-table-frame__loading">
                            <Loading label={rows.length ? "Refreshing report data…" : "Loading report data…"} compact />
                        </div>
                    )}
            </ReportTableFrame>
        </main>
    );
}
