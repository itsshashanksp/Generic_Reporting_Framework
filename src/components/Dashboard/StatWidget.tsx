import { useMemo } from "react";
import { formatCurrencyForDisplay, formatNumberForDisplay, formatPercentageForDisplay, NULL_DISPLAY_VALUE } from "../../engine/ValueFormatter";

import type { FilterDefinition } from "../../types/filter";
import type { WidgetFilterFields } from "../../engine/DashboardEngine/filterFields";
import type { WidgetFormat, WidgetRequest } from "../../types/widget";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import Skeleton from "../Common/Skeleton";
import DashboardWidgetFrame from "./DashboardWidgetFrame";
import WidgetFilterController, { type WidgetFilterControls } from "./WidgetFilterController";
import { useDashboardWidgetRequest } from "./useDashboardWidgetRequest";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];

interface StatWidgetProps {
    title: string;
    description?: string;
    request: WidgetRequest;
    valueField?: string;
    format?: WidgetFormat;
    currency?: string;
    filterDefinitions?: FilterDefinition[];
    /** Renames shared dashboard filter fields for this widget (see DashboardWidget). */
    filterFields?: WidgetFilterFields;
    cacheScope?: string;
    runtimeFilters?: FilterDefinition[];
    runtimeFilterDisplay?: "inline" | "dialog";
}

function formatValue(
    value: unknown,
    format: StatWidgetProps["format"],
    currency?: string
) {
    if (value === null || (typeof value === "string" && value.trim() === "")) {
        return NULL_DISPLAY_VALUE;
    }

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) {
        return String(value ?? "—");
    }

    if (format === "currency") {
        return formatCurrencyForDisplay(numericValue, "compact-indian", currency);
    }

    if (format === "decimal") {
        return numericValue.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    if (format === "percentage") {
        return formatPercentageForDisplay(numericValue);
    }

    return formatNumberForDisplay(numericValue);
}

export default function StatWidget({
    runtimeFilters = EMPTY_FILTER_DEFINITIONS,
    ...props
}: StatWidgetProps) {
    return (
        <WidgetFilterController filters={runtimeFilters} database={props.request.database} widgetTitle={props.title} display={props.runtimeFilterDisplay}>
            {controls => <StatWidgetContent {...props} runtimeFilters={runtimeFilters} widgetFilterControls={controls} />}
        </WidgetFilterController>
    );
}

function StatWidgetContent({
    title,
    description,
    request,
    valueField,
    format,
    currency,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
    filterFields,
    cacheScope,
    runtimeFilters = EMPTY_FILTER_DEFINITIONS,
    widgetFilterControls,
}: StatWidgetProps & { widgetFilterControls: WidgetFilterControls }) {
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        request,
        filterDefinitions,
        cacheScope,
        filterFields,
        runtimeFilters,
        widgetFilterControls.appliedValues
    );
    const statistic = useMemo(() => {
        const firstRow = response?.data?.[0];
        if (!firstRow) return { available: false, value: undefined };
        if (valueField) {
            return {
                available: Object.prototype.hasOwnProperty.call(firstRow, valueField),
                value: firstRow[valueField],
            };
        }
        const values = Object.values(firstRow);
        return { available: values.length > 0, value: values[0] };
    }, [response, valueField]);
    const { available: hasValue, value } = statistic;
    const formattedValue = hasValue ? formatValue(value, format, currency) : "";

    return (
        <DashboardWidgetFrame
            title={title}
            description={description}
            busy={loading}
            refreshing={loading && hasValue}
            variant="stat"
            actions={widgetFilterControls.button}
            filterPanel={widgetFilterControls.panel}
        >
            <div className="dashboard-stat-card">
                {loading && !hasValue && <Skeleton kind="stat" label="Loading statistic…" />}
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
                {hasValue && <output className="dashboard-stat-value" title={formattedValue}>{formattedValue}</output>}
            </div>
        </DashboardWidgetFrame>
    );
}
