import { useFilters } from "../../engine/FilterContext";
import { buildWhere } from "../../engine/FilterQueryBuilder";

import { useEffect, useMemo, useState } from "react";

import { getReport } from "../../engine/ReportEngine/reportLoader";
import { loadDefinition } from "../../engine/ReportDefinitionEngine";

import { executeRequest } from "../../api/request";

import type { ApiResponse } from "../../types/api";

import { parseResponse } from "../../engine/ResponseEngine/responseParser";

import ReportDataGrid from "./ReportDataGrid";

import Loading from "../Common/Loading";
import Error from "../Common/Error";
import Empty from "../Common/Empty";

import { UIState } from "../../engine/UIStateEngine";

import { buildGrouping } from "../../engine/GroupingEngine";

import { useDashboard } from "../../engine/DashboardContext";

interface ReportWidgetProps {
    reportId: string;
    title: string;
}

export default function ReportWidget({
    reportId,
    title,
}: ReportWidgetProps) {

    const { filters } = useFilters();
    const { refreshKey } = useDashboard();

    const rawReport = getReport(reportId);

    const report = useMemo(() => {

        return rawReport
            ? loadDefinition(rawReport)
            : null;

    }, [rawReport]);

    const [result, setResult] =
        useState<ApiResponse | null>(null);

    const [uiState, setUiState] =
        useState<UIState>(UIState.LOADING);

    const [errorMessage, setErrorMessage] =
        useState("");

    const {
        rows,
    } = result
        ? parseResponse(result)
        : {
            rows: [],
        };

    useEffect(() => {

        if (!report) {

            setUiState(UIState.ERROR);

            setErrorMessage(
                "Report not found."
            );

            return;
        }

        const loadWidget = async () => {

            setUiState(UIState.LOADING);

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

                            ...buildWhere(filters),
                        ],

                    });

                setResult(response);

                if (!response.success) {

                    setUiState(
                        UIState.ERROR
                    );

                    setErrorMessage(
                        response.message ||
                        "Failed to load report."
                    );

                    return;
                }

                if (
                    response.rowsReturned === 0
                ) {

                    setUiState(
                        UIState.EMPTY
                    );

                    return;
                }

                setUiState(
                    UIState.SUCCESS
                );

            }
            catch (error: any) {

                setUiState(
                    UIState.ERROR
                );

                setErrorMessage(
                    error.message ||
                    "Unexpected error occurred."
                );

            }

        };

        loadWidget();

    }, [report, filters, refreshKey]);

    if (uiState === UIState.LOADING) {
        return <Loading />;
    }

    if (uiState === UIState.ERROR) {
        return (
            <Error
                message={errorMessage}
            />
        );
    }

    if (uiState === UIState.EMPTY) {
        return <Empty />;
    }

    return (

        <div
            style={{
                width: "100%",
                height: "100%",
            }}
        >

            <h2>
                {title}
            </h2>

            <ReportDataGrid
                rows={rows}
                columns={report!.columns}
                gridConfig={report!.grid}
            />

        </div>

    );
}