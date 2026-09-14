import { useMemo } from "react";
import { formatNumberForDisplay } from "../../engine/ValueFormatter";

import type { FilterDefinition } from "../../types/filter";
import type { WidgetRequest } from "../../types/widget";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import Loading from "../Common/Loading";
import DashboardWidgetFrame from "./DashboardWidgetFrame";
import { useDashboardWidgetRequest } from "./useDashboardWidgetRequest";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];

interface StatWidgetProps {
    title: string;
    description?: string;
    request: WidgetRequest;
    valueField?: string;
    format?: "number" | "currency" | "decimal";
    filterDefinitions?: FilterDefinition[];
    cacheScope?: string;
}

function formatValue(
    value: unknown,
    format: StatWidgetProps["format"]
) {
    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        return String(value ?? "—");
    }

    if (format === "currency") {
        return numericValue.toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    if (format === "decimal") {
        return numericValue.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    return formatNumberForDisplay(numericValue);
}

export default function StatWidget({
    title,
    description,
    request,
    valueField,
    format,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
    cacheScope,
}: StatWidgetProps) {
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        request,
        filterDefinitions,
        cacheScope
    );
    const value = useMemo(() => {
        const firstRow = response?.data?.[0];
        return firstRow
            ? valueField ? firstRow[valueField] : Object.values(firstRow)[0]
            : undefined;
    }, [response, valueField]);
    const hasValue = value !== undefined && value !== null;

    return (
        <DashboardWidgetFrame
            title={title}
            description={description}
            refreshing={loading && hasValue}
            variant="stat"
        >
            {loading && !hasValue && <Loading label="Loading statistic…" compact />}
            {!loading && error && !hasValue && (
                <ErrorState
                    title="Unable to load statistic"
                    message={error}
                    onRetry={retry}
                    compact
                />
            )}
            {!loading && error && hasValue && (
                <div className="dashboard-widget-inline-error" role="alert">
                    <span>Refresh failed.</span>
                    <button type="button" className="app-button" onClick={retry}>Retry</button>
                </div>
            )}
            {!loading && !error && !hasValue && (
                <Empty title="No data" message="No statistic is available." compact />
            )}
            {hasValue && <div className="dashboard-stat-value">{formatValue(value, format)}</div>}
        </DashboardWidgetFrame>
    );
}
