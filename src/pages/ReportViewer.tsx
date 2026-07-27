import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getReport } from "../engine/ReportEngine/reportLoader";
import { executeRequest } from "../api/request";

import type { ApiResponse } from "../types/api";

import GenericGrid from "../components/Grid/GenericGrid";
import { parseResponse } from "../engine/ResponseEngine/responseParser";

import Loading from "../components/Common/Loading";
import Error from "../components/Common/Error";
import Empty from "../components/Common/Empty";

import { UIState } from "../engine/UIStateEngine";

export default function ReportViewer() {

    const { reportId } = useParams();

    const report = getReport(reportId || "");

    const [result, setResult] = useState<ApiResponse | null>(null);

    const [uiState, setUiState] = useState<UIState>(UIState.LOADING);

    const [errorMessage, setErrorMessage] = useState("");

    const { rows, columns } = result
        ? parseResponse(result)
        : {
              rows: [],
              columns: [],
          };

    useEffect(() => {

        if (!report) {
            setUiState(UIState.ERROR);
            setErrorMessage("Report not found.");
            return;
        }

        setUiState(UIState.LOADING);

        executeRequest(report.request)
            .then((data) => {

                setResult(data);

                if (!data.success) {
                    setUiState(UIState.ERROR);
                    setErrorMessage(data.message || "Failed to load report.");
                    return;
                }

                if (data.rowsReturned === 0) {
                    setUiState(UIState.EMPTY);
                    return;
                }

                setUiState(UIState.SUCCESS);

            })
            .catch((err) => {

                setUiState(UIState.ERROR);

                setErrorMessage(err.message || "Unexpected error occurred.");

            });

    }, [report]);

    if (uiState === UIState.LOADING)
        return <Loading />;

    if (uiState === UIState.ERROR)
        return <Error message={errorMessage} />;

    if (uiState === UIState.EMPTY)
        return <Empty />;

    return (

        <div>

            <h1>{report?.title}</h1>

            <h2>Request</h2>

            <pre>
                {JSON.stringify(report?.request, null, 4)}
            </pre>

            <h2>Report Information</h2>

            <p>
                <strong>Rows Returned:</strong> {result?.rowsReturned}
            </p>

            <p>
                <strong>Execution Time:</strong> {result?.executionTime} ms
            </p>

            <GenericGrid
                rows={rows}
                columns={columns}
            />

        </div>

    );

}