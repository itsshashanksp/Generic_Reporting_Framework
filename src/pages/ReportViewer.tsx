import {
    useEffect,
    useMemo,
    useState,
    useCallback,
} from "react";

import { useParams } from "react-router-dom";

import { getReport } from "../engine/ReportEngine/reportLoader";
import { loadDefinition } from "../engine/ReportDefinitionEngine";

import { executeRequest } from "../api/request";

import type { ApiResponse } from "../types/api";

import GenericGrid from "../components/Grid/GenericGrid";
import { parseResponse } from "../engine/ResponseEngine/responseParser";

import Loading from "../components/Common/Loading";
import Error from "../components/Common/Error";
import Empty from "../components/Common/Empty";

import { UIState } from "../engine/UIStateEngine";

import { ReportToolbar } from "../components/Toolbar";
import { FilterRenderer } from "../components/Filters";

import { useFilters } from "../engine/FilterContext";

import { buildWhere } from "../engine/FilterQueryBuilder";

import { buildGrouping } from "../engine/GroupingEngine";

import { useGrid } from "../engine/GridContext";

import { saveSavedReport } from "../engine/SavedReportEngine";
import SavedReports from "../components/SavedReports/SavedReports";

import type { SavedReport } from "../types/savedReport";

import { exportExcel } from "../engine/ExportEngine";


export default function ReportViewer() {

    const { reportId } = useParams();


    const rawReport = getReport(
        reportId || ""
    );


    const report = useMemo(() => {

        return rawReport
            ? loadDefinition(rawReport)
            : null;

    }, [rawReport]);

    if (!rawReport) {
        return (
            <Error
                message={
                    `Report "${reportId || ""}" was not found.`
                }
            />
        );
    }

    const {
        filters,
        clearFilters,
    } = useFilters();


    const [
        result,
        setResult,
    ] = useState<ApiResponse | null>(null);


    const [
        uiState,
        setUiState,
    ] = useState<UIState>(
        UIState.LOADING
    );


    const [
        isGridLoading,
        setIsGridLoading,
    ] = useState(false);


    const [
        gridError,
        setGridError,
    ] = useState("");


    const [
        errorMessage,
        setErrorMessage,
    ] = useState("");


    const [
        currentPage,
        setCurrentPage,
    ] = useState(1);


    const { rows } = result
        ? parseResponse(result)
        : {
              rows: [],
          };


    const { api } = useGrid();


    const loadReport = useCallback(
        async (
            activeFilters = filters,
            activePage = currentPage,
            activePageSize =
                report?.grid.pagination.pageSize ?? 50
        ) => {

    if (!report) {

        setUiState(
            UIState.ERROR
        );

        setErrorMessage(
            `Report "${reportId || ""}" was not found.`
        );

        return;
    }


            /*
             * After the report is already displayed,
             * only the grid should enter the loading state.
             */
            setIsGridLoading(true);

            setGridError("");


            try {

                const grouping =
                    buildGrouping(
                        report.grid.grouping
                    );


                const requestColumns =
                    report.grid.grouping?.enabled
                        ? grouping.columns
                        : report.request.columns;


                const response =
                    await executeRequest({

                        ...report.request,

                        columns:
                            requestColumns,

                        groupBy:
                            grouping.groupBy,

                        where: [

                            ...(Array.isArray(
                                report.request.where
                            )
                                ? report.request.where
                                : []),

                            ...buildWhere(
                                activeFilters
                            ),

                        ],

                        page:
                            activePage,

                        pageSize:
                            activePageSize,

                    });


                setResult(
                    response
                );


                /*
                 * API errors stay inside the grid area.
                 */
                if (!response.success) {

                    setGridError(
                        response.message ||
                        "Failed to load report."
                    );

                    return;
                }


                /*
                 * Zero rows are handled by the grid
                 * area instead of replacing the page.
                 */
                setUiState(
                    UIState.SUCCESS
                );

            }
            catch (err: any) {

                /*
                 * Runtime/API errors after the report
                 * has loaded stay inside the grid.
                 */
                setGridError(
                    err.message ||
                    "Unexpected error occurred."
                );

            }
            finally {

                setIsGridLoading(
                    false
                );

            }

        },
        [
            report,
            reportId,
            filters,
            currentPage,
        ]
    );


    const handleSearch = () => {

        console.log(
            "Current Filters:",
            filters
        );


        console.log(
            "Where:",
            buildWhere(filters)
        );


        setCurrentPage(1);


        loadReport(
            filters,
            1
        );

    };


    const handleClear = () => {

        clearFilters();


        setCurrentPage(1);


        loadReport(
            {},
            1
        );

    };


    const handleSaveReport = () => {

        if (!report) {
            return;
        }


        const now =
            new Date().toISOString();


        const savedPage =
            api
                ? api.paginationGetCurrentPage() + 1
                : currentPage;


        const savedPageSize =
            api
                ? api.paginationGetPageSize()
                : report.grid.pagination.pageSize;


        saveSavedReport({

            id:
                `${report.id}-${Date.now()}`,

            reportId:
                report.id,

            name:
                report.title,

            createdAt:
                now,

            updatedAt:
                now,

            state: {

                filters,

                sorting: [],

                grouping:
                    report.grid.grouping
                        ? {

                              groups:
                                  report.grid.grouping.groups?.map(
                                      (
                                          group: any
                                      ) => ({

                                          field:
                                              group.field,

                                      })
                                  ) ?? [],


                              aggregates:
                                  report.grid.grouping.aggregates?.map(
                                      (
                                          aggregate: any
                                      ) => ({

                                          field:
                                              aggregate.field,

                                          function:
                                              aggregate.function,

                                          alias:
                                              aggregate.alias,

                                      })
                                  ) ?? [],

                          }
                        : undefined,


                pagination: {

                    page:
                        savedPage,

                    pageSize:
                        savedPageSize,

                },

            },

        });


        console.log(
            "Saved page:",
            savedPage
        );


        console.log(
            "Saved page size:",
            savedPageSize
        );


        alert(
            "Report saved successfully."
        );

    };


    const handleLoadSavedReport =
        async (
            savedReport: SavedReport
        ) => {

            if (!report) {
                return;
            }


            const savedPage =
                savedReport.state.pagination?.page ??
                1;


            const savedPageSize =
                savedReport.state.pagination?.pageSize ??
                report.grid.pagination.pageSize;


            setCurrentPage(
                savedPage
            );


            await loadReport(
                savedReport.state.filters,
                savedPage,
                savedPageSize
            );


            if (api) {

                api.setGridOption(
                    "paginationPageSize",
                    savedPageSize
                );


                api.paginationGoToPage(
                    savedPage - 1
                );

            }

        };


    const handleExportAll = async (
        format: "csv" | "excel"
    ) => {

        if (!report || !api) {
            return;
        }


        try {

            const grouping =
                buildGrouping(
                    report.grid.grouping
                );


            const requestColumns =
                report.grid.grouping?.enabled
                    ? grouping.columns
                    : report.request.columns;


            const exportRequest = {

                ...report.request,

                columns:
                    requestColumns,

                groupBy:
                    grouping.groupBy,

                where: [

                    ...(Array.isArray(
                        report.request.where
                    )
                        ? report.request.where
                        : []),

                    ...buildWhere(
                        filters
                    ),

                ],

                /*
                 * Export All intentionally does not
                 * send page or pageSize.
                 */

            };


            const response =
                await executeRequest(
                    exportRequest
                );


            if (!response.success) {

                console.error(
                    "Export All failed:",
                    response.message
                );

                return;
            }


            const exportRows =
                parseResponse(
                    response
                ).rows;


            if (!exportRows.length) {

                console.warn(
                    "Export All: no rows returned."
                );

                return;
            }


            /*
             * Export All CSV uses the AG Grid Community API.
             */
            if (format === "csv") {

                api.setGridOption(
                    "rowData",
                    exportRows
                );


                api.exportDataAsCsv({

                    fileName:
                        report.export?.filename
                            ? `${report.export.filename}.csv`
                            : "report.csv",

                });


                /*
                 * Restore the currently displayed rows.
                 */
                api.setGridOption(
                    "rowData",
                    rows
                );

            }


            /*
             * Export All Excel uses the open-source XLSX
             * implementation. It does not touch the grid.
             */
            if (format === "excel") {

                exportExcel(
                    exportRows,
                    report.export?.filename
                        ? `${report.export.filename}.xlsx`
                        : "report.xlsx"
                );

            }

        }
        catch (error) {

            console.error(
                "Export All failed:",
                error
            );

        }

    };


    /*
     * Initial report load.
     *
     * The first request starts with UIState.LOADING,
     * so the complete page can show the initial loader.
     */
    useEffect(() => {

        if (report) {

            loadReport();

        }

    }, [report]);


    /*
     * Report configuration/loading errors remain
     * page-level errors.
     */
    if (
        uiState === UIState.LOADING
    ) {

        return <Loading />;

    }


    if (
        uiState === UIState.ERROR
    ) {

        return (

            <Error
                message={
                    errorMessage ||
                    `Report "${reportId || ""}" was not found.`
                }
            />

        );

    }


    return (

        <div>

            <h1>
                {report!.title}
            </h1>


            <h2>
                Report Information
            </h2>


            <p>

                <strong>
                    Rows Returned:
                </strong>{" "}

                {result?.rowsReturned}

            </p>


            <p>

                <strong>
                    Execution Time:
                </strong>{" "}

                {result?.executionTime} ms

            </p>


            <FilterRenderer
                filters={
                    report!.filters
                }
            />


            <div
                style={{
                    display: "flex",
                    gap: "10px",
                    margin: "15px 0",
                }}
            >

                <button
                    onClick={
                        handleSearch
                    }
                >
                    Search
                </button>


                <button
                    onClick={
                        handleClear
                    }
                >
                    Clear
                </button>

            </div>


            <SavedReports
                reportId={
                    report!.id
                }
                onLoad={
                    handleLoadSavedReport
                }
            />


            <ReportToolbar
                config={
                    report!.toolbar
                }
                exportConfig={
                    report!.export
                }
                onExportAll={
                    handleExportAll
                }
                onSaveReport={
                    handleSaveReport
                }
                rows={
                    rows
                }
            />


            <div
                style={{
                    position: "relative",
                    minHeight: "200px",
                }}
            >

                {isGridLoading && (

                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background:
                                "rgba(255, 255, 255, 0.7)",
                            display: "flex",
                            alignItems:
                                "center",
                            justifyContent:
                                "center",
                            zIndex: 10,
                        }}
                    >

                        <Loading />

                    </div>

                )}


                {!isGridLoading &&
                    gridError && (

                        <Error
                            message={
                                gridError
                            }
                        />

                    )}


                {!isGridLoading &&
                    !gridError &&
                    rows.length === 0 && (

                        <Empty />

                    )}


                {!isGridLoading &&
                    !gridError &&
                    rows.length > 0 && (

                        <GenericGrid
                            rows={
                                rows
                            }
                            columns={
                                report!.columns
                            }
                            gridConfig={
                                report!.grid
                            }
                        />

                    )}

            </div>

        </div>

    );

}