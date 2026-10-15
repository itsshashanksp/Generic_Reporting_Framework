import { ResponsiveFilterPanel } from "../components/Filters";
import {
    getDashboard,
    getPartialDateRanges,
    resolveDashboardWidgetDefinition,
    resolveDashboardWidgetColumns,
    resolveDashboardWidgetRequest,
} from "../engine/DashboardEngine";

import ReportWidget from "../components/Dashboard/ReportWidget";
import StatWidget from "../components/Dashboard/StatWidget";
import ChartWidget from "../components/Dashboard/ChartWidget";

import { useFilters } from "../engine/FilterContext";
import { isRequiredFilterIncomplete } from "../engine/FilterEngine";
import {
    useDashboard,
    DashboardProvider,
} from "../engine/DashboardContext";

import type { DashboardDefinition } from "../types/dashboard";
import type { FilterValues } from "../engine/FilterContext";
import type { FilterDefinition } from "../types/filter";

import { useEffect, useMemo, useState } from "react";


import type { CSSProperties } from "react";

import TableWidget from "../components/Dashboard/TableWidget";
import ErrorState from "../components/Common/Error";

export default function Dashboard({
    dashboardId = "item-dashboard",
}: {
    dashboardId?: string;
}) {

    const dashboardResult = useMemo(
        () => getDashboard(dashboardId),
        [dashboardId]
    );

    if (
        dashboardResult.status ===
        "not-found"
    ) {
        return (
            <ErrorState
                title="Dashboard not found"
                message={`Dashboard "${dashboardId}" was not found.`}
            />
        );
    }

    if (
        dashboardResult.status ===
        "invalid"
    ) {
        return (
            <div
                className="dashboard-configuration-error"
                role="alert"
            >
                <h1>
                    Dashboard Configuration Error
                </h1>

                <p>
                    The dashboard configuration contains
                    the following errors:
                </p>

                <ul>
                    {dashboardResult.validation.errors.map(
                        (error, index) => (
                            <li key={`${index}-${error}`}>
                                {error}
                            </li>
                        )
                    )}
                </ul>
            </div>
        );
    }

    const dashboard =
        dashboardResult.dashboard;

    return (
        <DashboardProvider
            key={dashboard.id}
            autoRefresh={dashboard.autoRefresh}
        >
            <DashboardContent
                dashboard={dashboard}
            />
        </DashboardProvider>
    );
}

function DashboardContent({
    dashboard,
}: {
    dashboard: DashboardDefinition;
}) {

    const [filterError, setFilterError] = useState("");

    const columns =
        dashboard.layout?.columns ?? 12;

    const tabletColumns =
        dashboard.layout?.tabletColumns ?? 6;

    const mobileColumns =
        dashboard.layout?.mobileColumns ?? 1;

    const visibleWidgets =
        dashboard.widgets.filter(
            widget =>
                widget.visible !== false
        );

    const {
        filters,
        clearFilters,
    } = useFilters();

    const {
        refreshDashboard,
        isRefreshing,
        finishRefresh,
        applyFilters,
        appliedFilters,
    } = useDashboard();

    // Widgets mount (and so request, refresh and export) only once the applied
    // filters complete every required filter, e.g. both dates of a range.
    const missingAppliedFilters = (dashboard.filters ?? []).filter(
        filter => isRequiredFilterIncomplete(filter, appliedFilters[filter.field])
    );

    useEffect(() => {

        clearFilters();

    }, [dashboard.id, clearFilters]);

    const handleSearch = () => {
        const missing = (dashboard.filters ?? []).filter(
            filter => isRequiredFilterIncomplete(filter, filters[filter.field])
        );

        if (missing.length > 0) {
            setFilterError(`Complete the required filter${missing.length > 1 ? "s" : ""}: ${missing.map(describeRequiredFilter).join(", ")}.`);
            // Remove results for an earlier range rather than show them as current.
            applyFilters({});
            return false;
        }

        // "optional": a range applies only with both dates. The applied
        // filters stay as they were, and the applied-range line says so.
        const partial = getPartialDateRanges(dashboard.filters ?? [], filters, dashboard.dateFilterBehavior);
        if (partial.length > 0) {
            setFilterError(`Enter both a start and an end date for ${partial.map(filter => filter.label).join(", ")}, or clear the dates to search without a date range. The results shown are unchanged.`);
            return false;
        }

        setFilterError("");
        applyFilters(filters);
        return true;
    };

    const handleClearFilters = () => {
        clearFilters();
        setFilterError("");
        applyFilters({});
    };

    useEffect(() => {

        if (!isRefreshing) {
            return;
        }

        const timer = setTimeout(() => {

            finishRefresh();

        }, 1000);

        return () => {
            clearTimeout(timer);
        };

    }, [
        isRefreshing,
        finishRefresh,
    ]);

    return (
        <main className="dashboard-page">

            <header className="dashboard-header">
                <div>
                    <h1>{dashboard.title}</h1>
                    {dashboard.description && <p>{dashboard.description}</p>}
                </div>
                <button
                    type="button"
                    className="app-button app-button--primary"
                    onClick={refreshDashboard}
                    disabled={isRefreshing || missingAppliedFilters.length > 0}
                    title="Refresh dashboard data"
                >
                    {isRefreshing ? "Refreshing…" : "Refresh"}
                </button>
            </header>

            {dashboard.filters &&
                dashboard.filters.length > 0 && (
                    <ResponsiveFilterPanel
                        filters={dashboard.filters}
                        className="dashboard-filters"
                        error={filterError}
                        onApply={handleSearch}
                        onClear={handleClearFilters}
                    />
                )}

            {dashboard.dateFilterBehavior && missingAppliedFilters.length === 0 && (
                <p className="dashboard-applied-range" aria-live="polite">
                    {describeAppliedDateRanges(dashboard.filters ?? [], appliedFilters)}
                </p>
            )}

            {missingAppliedFilters.length > 0 ? (
                <div
                    className="dashboard-empty"
                    role="status"
                >
                    Enter {missingAppliedFilters.map(describeRequiredFilter).join(", ")} and choose Search to load this dashboard.
                </div>
            ) : visibleWidgets.length === 0 ? (
                <div
                    className="dashboard-empty"
                    role="status"
                >
                    No dashboard widgets are available.
                </div>
            ) : (
                <div
                    className="dashboard-grid"
                    style={{
                        display: "grid",

                        gridTemplateColumns:
                            `repeat(${columns}, 1fr)`,

                        gap: "16px",

                        "--dashboard-tablet-columns":
                            tabletColumns,

                        "--dashboard-mobile-columns":
                            mobileColumns,

                    } as CSSProperties}
                >

                    {visibleWidgets.map(
                        widget => {

                            const widgetDefinition =
                                resolveDashboardWidgetDefinition(widget, dashboard.filters ?? []);
                            const widgetRequest = widgetDefinition?.request
                                ?? resolveDashboardWidgetRequest(widget, dashboard.filters ?? []);
                            const widgetColumns = widgetDefinition?.columns
                                ?? resolveDashboardWidgetColumns(widget, dashboard.filters ?? []);

                            /*
                             * Keep widget width
                             * between 1 and the
                             * configured column count.
                             */
                            const widgetWidth =
                                Math.min(
                                    Math.max(
                                        widget.width ?? 12,
                                        1
                                    ),
                                    columns
                                );

                            const tabletWidgetWidth =
                                getResponsiveWidgetWidth(
                                    widgetWidth,
                                    columns,
                                    tabletColumns
                                );

                            const mobileWidgetWidth =
                                getResponsiveWidgetWidth(
                                    widgetWidth,
                                    columns,
                                    mobileColumns
                                );

                            /*
                             * Validate X position.
                             *
                             * Prevent:
                             * - negative X
                             * - widget extending
                             *   beyond dashboard width
                             */
                            const positionX =
                                widget.position
                                    ? Math.max(
                                          0,
                                          Math.min(
                                              widget.position.x,
                                              columns -
                                                  widgetWidth
                                          )
                                      )
                                    : null;

                            /*
                             * Validate Y position.
                             *
                             * CSS Grid rows start
                             * from 1.
                             */
                            const positionY =
                                widget.position
                                    ? Math.max(
                                          1,
                                          widget.position.y
                                      )
                                    : null;

                            return (
                                <div
                                    key={widget.id}
                                    className={`dashboard-widget${widget.type === "table" || widget.type === "report" ? " dashboard-widget--table" : ""}`}
                                    style={{
                                        /*
                                         * Use configured X
                                         * position when available.
                                         */
                                        gridColumn:
                                            positionX !== null
                                                ? `${positionX + 1} / span ${widgetWidth}`
                                                : `span ${widgetWidth}`,

                                        /*
                                         * Use configured Y
                                         * position when available.
                                         */
                                        gridRow:
                                            positionY !== null
                                                ? `${positionY}`
                                                : "auto",

                                        height:
                                            widget.height !== undefined
                                                ? `${widget.height}px`
                                                : "auto",

                                        "--dashboard-tablet-widget-width":
                                            tabletWidgetWidth,

                                        "--dashboard-mobile-widget-width":
                                            mobileWidgetWidth,
                                    } as CSSProperties}
                                >

                                    {widget.type === "report" &&
                                        widgetDefinition && (
                                            <ReportWidget
                                                definition={widgetDefinition}
                                                title={
                                                    widget.title
                                                }
                                                description={
                                                    widget.description
                                                }
                                                filterDefinitions={
                                                    dashboard.filters ?? []
                                                }
                                                filterFields={widget.filterFields}
                                                cacheScope={`${dashboard.id}:${widget.id}`}
                                            />
                                        )}

                                    {widget.type === "stat" &&
                                        widgetRequest && (
                                            <StatWidget
                                                title={
                                                    widget.title
                                                }
                                                description={
                                                    widget.description
                                                }
                                                request={
                                                    widgetRequest
                                                }
                                                valueField={widget.valueField}
                                                format={
                                                    widget.format
                                                }
                                                filterDefinitions={
                                                    dashboard.filters ?? []
                                                }
                                                filterFields={widget.filterFields}
                                                cacheScope={`${dashboard.id}:${widget.id}`}
                                            />
                                        )}

                                    {widget.type === "table" &&
                                        widgetRequest && (
                                            <TableWidget
                                                title={
                                                    widget.title
                                                }
                                                description={
                                                    widget.description
                                                }
                                                pageSize={
                                                    widget.pageSize
                                                }
                                                pageSizeOptions={
                                                    widget.pageSizeOptions
                                                }
                                                request={
                                                    widgetRequest
                                                }
                                                columns={
                                                    widgetColumns
                                                }
                                                filterDefinitions={
                                                    dashboard.filters ?? []
                                                }
                                                filterFields={widget.filterFields}
                                                cacheScope={`${dashboard.id}:${widget.id}`}
                                                exportConfig={widget.export}
                                            />
                                        )}

                                    {widget.type === "chart" &&
                                        widgetRequest &&
                                        widget.xField &&
                                        widget.yField && (
                                            <ChartWidget
                                                title={
                                                    widget.title
                                                }
                                                description={
                                                    widget.description
                                                }
                                                request={
                                                    widgetRequest
                                                }
                                                xField={
                                                    widget.xField
                                                }
                                                yField={
                                                    widget.yField
                                                }
                                                chartType={
                                                    widget.chartType
                                                }
                                                showLegend={
                                                    widget.showLegend
                                                }
                                                showTooltip={
                                                    widget.showTooltip
                                                }
                                                showGrid={
                                                    widget.showGrid
                                                }
                                                showLabels={
                                                    widget.showLabels
                                                }
                                                filterDefinitions={
                                                    dashboard.filters ?? []
                                                }
                                                filterFields={widget.filterFields}
                                                cacheScope={`${dashboard.id}:${widget.id}`}
                                            />
                                        )}

                                </div>
                            );
                        }
                    )}

                </div>
            )}

        </main>
    );
}

function getResponsiveWidgetWidth(
    widgetWidth: number,
    desktopColumns: number,
    responsiveColumns: number
) {
    return Math.min(
        responsiveColumns,
        Math.max(
            1,
            Math.ceil(
                widgetWidth /
                desktopColumns *
                responsiveColumns
            )
        )
    );
}

function describeRequiredFilter(filter: FilterDefinition) {
    return filter.type === "daterange"
        ? `${filter.label} (start and end dates)`
        : filter.label;
}

/** Which date range the shown results use, so an edited but unsearched form is not mistaken for them. */
function describeAppliedDateRanges(filters: FilterDefinition[], applied: FilterValues) {
    return filters
        .filter(filter => filter.type === "daterange")
        .map(filter => {
            const value = applied[filter.field];
            return Array.isArray(value) && value.length === 2 && value.every(item => item !== "" && item !== null && item !== undefined)
                ? `Showing results for ${filter.label} ${String(value[0])} to ${String(value[1])}.`
                : `Showing results without a ${filter.label} range.`;
        })
        .join(" ");
}
