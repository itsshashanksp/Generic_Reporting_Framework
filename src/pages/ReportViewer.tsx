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

    const [sortModel, setSortModel] = useState<
        {
            column: string;
            direction: "ASC" | "DESC";
        }[]
    >([]);

    const { rows } = result
        ? parseResponse(result)
        : {
              rows: [],
          };

    const loadReport = useCallback(async (activeFilters = filters) => {

        if (!report) {

            setUiState(UIState.ERROR);
            setErrorMessage("Report not found.");

            return;

        }

        setUiState(UIState.LOADING);

        try {

            const response = await executeRequest({

                ...report.request,

                where: [
                    ...(Array.isArray(report.request.where)
                    ? report.request.where
                    : []),

                     ...buildWhere(activeFilters),

                ],

                sort: sortModel,

            });

            setResult(response);

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

    }, [report, filters, sortModel]);

    const handleSearch = () => {

        console.log("Current Filters:", filters);

        console.log("Where:", buildWhere(filters));

        loadReport();

    };

    const handleClear = () => {

        clearFilters();

        loadReport({});

    };

    const handleSortChange = (
        sort: {
            column: string;
            direction: "ASC" | "DESC";
        }[]
    ) => {

        setSortModel(sort);

    };

    useEffect(() => {

        if (report) {

            if (!report) return;

            loadReport();

        }

    }, [report]);

    useEffect(() => {

        if (!report) return;

        loadReport();

    }, [sortModel]);


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
                onSortChange={handleSortChange}
            />

        </div>

    );

}