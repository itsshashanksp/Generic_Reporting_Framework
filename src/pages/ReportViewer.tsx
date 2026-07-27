import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getReport } from "../engine/ReportEngine/reportLoader";
import { executeRequest } from "../api/request";

import type { ApiResponse } from "../types/api";

import GenericGrid from "../components/Grid/GenericGrid";
import { parseResponse } from "../engine/ResponseEngine/responseParser";

export default function ReportViewer() {

    const { reportId } = useParams();

    const report = getReport(reportId || "");

    const [result, setResult] = useState<ApiResponse | null>(null);

    const { rows, columns } = result
        ? parseResponse(result)
        : {
              rows: [],
              columns: [],
          };

    useEffect(() => {

        if (!report) return;

        executeRequest(report.request)
            .then((data) => {
                setResult(data);
            })
            .catch(console.error);

    }, [report]);

    return (

        <div>

            <h1>{report?.title}</h1>

            <h2>Request</h2>

            <pre>
                {JSON.stringify(report?.request, null, 4)}
            </pre>

            {result && (
                <>
                    <h2>Report Information</h2>

                    <p>
                        <strong>Rows Returned:</strong> {result.rowsReturned}
                    </p>

                    <p>
                        <strong>Execution Time:</strong> {result.executionTime} ms
                    </p>

                    <GenericGrid
                        rows={rows}
                        columns={columns}
                    />
                </>
            )}

        </div>

    );
}