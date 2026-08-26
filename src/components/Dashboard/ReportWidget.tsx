import { useFilters } from "../../engine/FilterContext";
import { buildWhere } from "../../engine/FilterQueryBuilder";

import {
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import { getReport } from "../../engine/ReportEngine/reportLoader";
import { loadDefinition } from "../../engine/ReportDefinitionEngine";

import { executeRequest } from "../../api/request";

import type { ApiResponse } from "../../types/api";

import { parseResponse } from "../../engine/ResponseEngine/responseParser";

import ReportDataGrid from "./ReportDataGrid";

import Loading from "../Common/Loading";
import ErrorState from "../Common/Error";
import Empty from "../Common/Empty";

import { UIState } from "../../engine/UIStateEngine";

import { buildGrouping } from "../../engine/GroupingEngine";

import { useDashboard } from "../../engine/DashboardContext";

interface ReportWidgetProps {
    reportId: string;
    title: string;
    description?: string;
}

function ReportWidgetFrame({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <div
            style={{
                width: "100%",
                height: "100%",
            }}
        >
            <h2
                style={{
                    marginTop: 0,
                    marginBottom: "4px",
                }}
            >
                {title}
            </h2>

            {description && (
                <div
                    style={{
                        fontSize: "12px",
                        opacity: 0.6,
                        marginBottom: "10px",
                    }}
                >
                    {description}
                </div>
            )}

            {children}
        </div>
    );
}

export default function ReportWidget({
    reportId,
    title,
    description,
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
                    response.rowsReturned === 0 ||
                    !response.data?.length
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
            catch (error: unknown) {

                setUiState(
                    UIState.ERROR
                );

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        :
                    "Unexpected error occurred."
                );

            }

        };

        loadWidget();

    }, [report, filters, refreshKey]);

    if (!report) {
        return (
            <ReportWidgetFrame
                title={title}
                description={description}
            >
                <ErrorState message="Report not found." />
            </ReportWidgetFrame>
        );
    }

    if (uiState === UIState.LOADING) {
        return (
            <ReportWidgetFrame
                title={title}
                description={description}
            >
                <Loading />
            </ReportWidgetFrame>
        );
    }

    if (uiState === UIState.ERROR) {
        return (
            <ReportWidgetFrame
                title={title}
                description={description}
            >
                <ErrorState
                    message={errorMessage}
                />
            </ReportWidgetFrame>
        );
    }

    if (uiState === UIState.EMPTY) {
        return (
            <ReportWidgetFrame
                title={title}
                description={description}
            >
                <Empty />
            </ReportWidgetFrame>
        );
    }

    return (
        <ReportWidgetFrame
            title={title}
            description={description}
        >
            <ReportDataGrid
                rows={rows}
                columns={report.columns}
                gridConfig={report.grid}
            />
        </ReportWidgetFrame>
    );
}
