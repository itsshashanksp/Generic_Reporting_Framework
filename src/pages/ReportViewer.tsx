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

export default function ReportViewer() {

    const { reportId } = useParams();

    const rawReport = getReport(reportId || "");

    const report = useMemo(() => {
        return rawReport ? loadDefinition(rawReport) : null;
    }, [rawReport]);

    const {
        filters,
        clearFilters,
    } = useFilters();

    const [result, setResult] = useState<ApiResponse | null>(null);

    const [uiState, setUiState] = useState<UIState>(UIState.LOADING);

    const [errorMessage, setErrorMessage] = useState("");

    const [currentPage, setCurrentPage] = useState(1);

    const [totalRows, setTotalRows] = useState(0);

    const { rows } = result
        ? parseResponse(result)
        : {
              rows: [],
          };

    const loadReport = useCallback(
    async (
        activeFilters = filters,
        activePage = currentPage
    ) => {

        if (!report) {

            setUiState(UIState.ERROR);
            setErrorMessage("Report not found.");

            return;

        }

        setUiState(UIState.LOADING);

        try {

            const grouping = buildGrouping(
                 report.grid.grouping
            );
            const requestColumns =
                report.grid.grouping?.enabled
                    ? grouping.columns
                    : report.request.columns;

            const response = await executeRequest({

                ...report.request,

                columns: requestColumns,

                groupBy: grouping.groupBy,

                where: [
                    ...(Array.isArray(report.request.where)
                    ? report.request.where
                    : []),

                     ...buildWhere(activeFilters),

                ],

                page: activePage,

                pageSize: report.grid.pagination.pageSize,

            });

            setResult(response);

            setTotalRows(response.rowsReturned);

            if (!response.success) {

                setUiState(UIState.ERROR);

                setErrorMessage(
                    response.message || "Failed to load report."
                );

                return;

            }

            if (response.rowsReturned === 0) {

                setUiState(UIState.EMPTY);

                return;

            }

            setUiState(UIState.SUCCESS);

        }
        catch (err: any) {

            setUiState(UIState.ERROR);

            setErrorMessage(
                err.message || "Unexpected error occurred."
            );

        }

    }, [report, filters, currentPage
]);

    const handleSearch = () => {

        console.log("Current Filters:", filters);

        console.log("Where:", buildWhere(filters));

        setCurrentPage(1);

        loadReport(filters, 1);

    };

    const handleClear = () => {

        clearFilters();

        setCurrentPage(1);

        loadReport({}, 1);

    };

    const handlePageChange = (page: number) => {

        setCurrentPage(page);

        loadReport(filters, page);

    };

    useEffect(() => {

        if (report) {

            loadReport();

        }

    }, [report]);

    if (uiState === UIState.LOADING)
        return <Loading />;

    if (uiState === UIState.ERROR)
        return <Error message={errorMessage} />;

    if (uiState === UIState.EMPTY)
        return <Empty />;

    return (

        <div>

            <h1>{report!.title}</h1>

            <h2>Request</h2>

            <pre>
                {JSON.stringify(report!.request, null, 4)}
            </pre>

            <h2>Report Information</h2>

            <p>
                <strong>Rows Returned:</strong> {result?.rowsReturned}
            </p>

            <p>
                <strong>Execution Time:</strong> {result?.executionTime} ms
            </p>

            <FilterRenderer
                filters={report!.filters}
            />

            <div
                style={{
                    display: "flex",
                    gap: "10px",
                    margin: "15px 0",
                }}
            >

                <button onClick={handleSearch}>
                    Search
                </button>

                <button onClick={handleClear}>
                    Clear
                </button>

            </div>

            <ReportToolbar
                config={report!.toolbar}
            />

            <GenericGrid
                rows={rows}
                columns={report!.columns}
                gridConfig={report!.grid}
                currentPage={currentPage}
                totalRows={totalRows}
                onPageChange={handlePageChange} 
            />

        </div>

    );

}