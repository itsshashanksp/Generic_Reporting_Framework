import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";

import {
    executeRequest,
    getRequestErrorMessage,
    isRequestAbort,
} from "../api/request";
import { useAuthenticatedUsername } from "../auth";
import Empty from "../components/Common/Empty";
import ErrorState from "../components/Common/Error";
import Loading from "../components/Common/Loading";
import usePullToRefresh from "../components/Common/usePullToRefresh";
import { ResponsiveFilterPanel } from "../components/Filters";
import GenericGrid from "../components/Grid/GenericGrid";
import ReportTableFrame from "../components/Grid/ReportTableFrame";
import SavedReports from "../components/SavedReports/SavedReports";
import { ReportToolbar } from "../components/Toolbar";
import { useDatabaseSelection } from "../components/Toolbar/useDatabaseSelection";
import { resolveConfiguredDatabase, useOptionalGlobalDatabase } from "../engine/DatabaseContext";
import { useFilters } from "../engine/FilterContext";
import { buildFilters } from "../engine/FilterQueryBuilder";
import { isEmptyFilterValue } from "../engine/FilterEngine";
import { useGrid } from "../engine/GridContext";
import { getReportPaginationParameters, isSavedReportsEnabled } from "../engine/ReportDefinitionEngine";
import { getReport, getReportError } from "../engine/ReportEngine/reportLoader";
import { createRequestCacheKey, getCachedResponse, getOrCreateInFlightRequest, setCachedResponse } from "../engine/RequestCache";
import { saveSavedReport } from "../engine/SavedReportEngine";
import { ExportFileError, ExportIntegrityError, exportExcel, exportRowsCSV, fetchAllRowsForExport } from "../engine/ExportEngine";
import type { ApiResponse } from "../types/api";
import type { FilterValue } from "../engine/FilterContext/FilterContext";
import type { SavedReport } from "../types/savedReport";
import type { SortDefinition } from "../types/report";


export default function ReportViewer() {
    const { reportId } = useParams();
    const { filters, replaceFilters, clearFilters } = useFilters();
    // Saved views are scoped to the signed-in user; without one they are unavailable.
    const savedReportsOwner = useAuthenticatedUsername();
    const { api } = useGrid();
    const report = getReport(reportId || "") ?? null;
    const reportConfigurationError = getReportError(reportId || "");
    const globalDatabase = useOptionalGlobalDatabase();
    // Runtime database (reports with databaseSelection): initialized from the
    // configured/global default when authorized, then the backend fallback.
    // Every report request
    // (load, page, sort, filters, refresh, export) reads databaseRef; "" means
    // not resolved yet, and then nothing is requested.
    const configuredDatabase = resolveConfiguredDatabase(report?.request.database, globalDatabase?.database);
    const databaseSelection = useDatabaseSelection(
        report?.id ?? "",
        report?.databaseSelection === true,
        configuredDatabase
    );
    const selectedDatabase = databaseSelection.database;
    const inheritsGlobalDatabase = Boolean(report && !report.databaseSelection && !report.request.database);
    const databaseBlocked = databaseSelection.status !== "off" && databaseSelection.status !== "ready"
        || inheritsGlobalDatabase && globalDatabase?.resolving === true;
    const [initialRequestState] = useState(() => {
        if (!report) {
            return { response: null, pageSize: 10 };
        }
        // A switchable report shows a cached result only for its resolved database.
        if (report.databaseSelection && !selectedDatabase) {
            return { response: null, pageSize: report.grid.pagination.pageSize };
        }

        const pageSize = report.grid.pagination.pageSize;
        const requestPayload = {
            ...withRuntimeDatabase(report.request, report.databaseSelection ? selectedDatabase : configuredDatabase),
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
    const [isExporting, setIsExporting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentPageSize, setCurrentPageSize] = useState(initialRequestState.pageSize);
    const [currentSorting, setCurrentSorting] = useState<SortDefinition[]>(report?.request.sort ?? []);
    const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>({});
    const [savedReportsRevision, setSavedReportsRevision] = useState(0);
    const databaseRef = useRef(report?.databaseSelection ? "" : configuredDatabase);
    const previousGlobalDatabase = useRef(globalDatabase?.database ?? "");
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
        if (!report.databaseSelection && !report.request.database && globalDatabase?.resolving) {
            return;
        }
        // Never fall back to the backend default by omitting the database.
        if (report.databaseSelection && !databaseRef.current) {
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
            ...withRuntimeDatabase(report.request, databaseRef.current),
            filters: [
                ...(Array.isArray(report.request.filters) ? report.request.filters : []),
                ...buildFilters(activeFilters, report.filters ?? [], report.request.action === "sql"),
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
    }, [report, globalDatabase?.resolving]);

    useEffect(() => {
        if (!report) {
            return;
        }

        // A switchable report loads once its database is resolved (below).
        databaseRef.current = report.databaseSelection ? "" : configuredDatabase;
        const timer = window.setTimeout(() => {
            clearFilters();
            setAppliedFilters({});
            if (!report.databaseSelection) {
                void loadReport({}, 1, report.grid.pagination.pageSize, report.request.sort ?? []);
            }
        }, 0);

        return () => {
            window.clearTimeout(timer);
            activeController.current?.abort();
            exportController.current?.abort();
        };
        // Global changes are handled below without clearing filters or paging.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [report, clearFilters, loadReport]);

    useEffect(() => {
        const next = globalDatabase?.database ?? "";
        const previous = previousGlobalDatabase.current;
        previousGlobalDatabase.current = next;
        if (!report || report.databaseSelection || report.request.database || globalDatabase?.resolving || next === previous) return;
        databaseRef.current = next;
        setResult(null);
        setLoadedReportId("");
        void loadReport(appliedFilters, currentPage, currentPageSize, currentSorting);
    }, [globalDatabase?.database, globalDatabase?.resolving, report, appliedFilters, currentPage, currentPageSize, currentSorting, loadReport]);

    // First load of a switchable report, as soon as its database is resolved.
    useEffect(() => {
        if (!report?.databaseSelection || !selectedDatabase || databaseRef.current) return;
        databaseRef.current = selectedDatabase;
        const timer = window.setTimeout(() => {
            void loadReport({}, 1, report.grid.pagination.pageSize, report.request.sort ?? []);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [report, selectedDatabase, loadReport]);

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

    const handleDatabaseChange = (database: string) => {
        if (!report || !databaseSelection.options.some(option => option.id === database && !option.disabled)) return;
        const firstChoice = !databaseRef.current;
        databaseRef.current = database;
        databaseSelection.select(database);
        // Never present rows from the previous database as current while the
        // new context is loading (or if that request later fails).
        setResult(null);
        setLoadedReportId("");
        setGridError("");
        if (firstChoice) {
            void loadReport({}, 1, report.grid.pagination.pageSize, report.request.sort ?? []);
            return;
        }
        // Same filters and sort against the other database, from page 1. A
        // request still running for the previous database is aborted.
        void loadReport(appliedFilters, 1, currentPageSize, currentSorting);
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
        if (!report || !savedReportsOwner) {
            return;
        }

        const now = new Date().toISOString();
        const savedPage = currentPage;
        const savedPageSize = currentPageSize;
        const sorting = currentSorting;

        saveSavedReport(savedReportsOwner, {
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
        if (!report || (report.databaseSelection && !databaseRef.current)) {
            return;
        }

        exportController.current?.abort();
        const controller = new AbortController();
        exportController.current = controller;
        setExportStatus("Preparing export…");
        setIsExporting(true);

        try {
            // Same request as the grid (fields, filters, filter logic, database,
            // current sort); the helper pages it within the backend maximum.
            const exportRows = await fetchAllRowsForExport(
                {
                    ...withRuntimeDatabase(report.request, databaseRef.current),
                    pagination: undefined,
                    filters: [
                        ...(Array.isArray(report.request.filters)
                            ? report.request.filters
                            : []),
                        ...buildFilters(appliedFilters, report.filters ?? [], report.request.action === "sql"),
                    ],
                    sort: currentSorting,
                },
                {
                    signal: controller.signal,
                    onProgress: (loadedRows, totalRows) => {
                        if (exportController.current !== controller) return;
                        setExportStatus(totalRows === null
                            ? `Preparing export… ${loadedRows.toLocaleString()} rows`
                            : `Preparing export… ${loadedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows`);
                    },
                }
            );

            if (exportRows.length === 0) {
                setExportStatus("There are no rows to export.");
                return;
            }

            if (format === "csv") {
                try {
                    exportRowsCSV(
                        exportRows,
                        report.export?.filename ? `${report.export.filename}.csv` : "report.csv"
                    );
                } catch (cause: unknown) {
                    throw new ExportFileError("The CSV file could not be created.", { cause });
                }
            } else {
                await exportExcel(
                    exportRows,
                    report.export?.filename
                        ? `${report.export.filename}.xlsx`
                        : "report.xlsx"
                );
            }

            setExportStatus("");
        } catch (error: unknown) {
            if (!isRequestAbort(error)) {
                const message = getRequestErrorMessage(error, "Unable to prepare the export.");
                setExportStatus(error instanceof ExportIntegrityError ? `${message} Nothing was exported.` : message);
            }
        } finally {
            if (exportController.current === controller) {
                exportController.current = null;
                setIsExporting(false);
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
                    database={report.databaseSelection ? selectedDatabase : configuredDatabase || undefined}
                    className="report-section"
                    error={filterError}
                    disabled={isGridLoading}
                    onApply={handleSearch}
                    onClear={handleClear}
                />
            )}

            {isSavedReportsEnabled(report.toolbar) && savedReportsOwner && (
                <SavedReports
                    key={`${report.id}-${savedReportsRevision}`}
                    reportId={report.id}
                    owner={savedReportsOwner}
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
                                className={isExporting ? "report-status" : "form-error"}
                                role="status"
                            >
                                {exportStatus}
                            </p>
                        )}
                        <ReportToolbar
                            config={report.toolbar}
                            exportConfig={report.export}
                            onRefresh={handleRefresh}
                            databaseSelector={report.databaseSelection ? {
                                value: selectedDatabase,
                                options: databaseSelection.options,
                                disabled: isExporting,
                                onChange: handleDatabaseChange,
                            } : undefined}
                            isRefreshing={isGridLoading}
                            isExporting={isExporting}
                            onExportAll={handleExportAll}
                            onExportMessage={setExportStatus}
                            onSaveReport={savedReportsOwner ? handleSaveReport : undefined}
                            rows={rows}
                        />
                    </>
                )}
            >
                    {databaseBlocked ? (
                        databaseSelection.status === "loading" || globalDatabase?.resolving
                            ? <div className="report-table-frame__loading"><Loading label="Loading databases…" compact /></div>
                            : databaseSelection.status === "listing-failed"
                                ? <ErrorState title="Database list unavailable" message={databaseSelection.error} onRetry={databaseSelection.retry} />
                                : <ErrorState title="No database available" message="No authorized, enabled and available database was returned." onRetry={databaseSelection.retry} />
                    ) : (<>
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
                    </>)}
            </ReportTableFrame>
        </main>
    );
}

/** The request with the selected logical database; no database stays omitted. */
function withRuntimeDatabase<T extends { database?: string }>(request: T, database: string): T {
    if (!database || request.database === database) return request;
    return { ...request, database };
}
