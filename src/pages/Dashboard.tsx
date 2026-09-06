import FilterRenderer from "../components/Filters/FilterRenderer";
import { getDashboard } from "../engine/DashboardEngine";

import ReportWidget from "../components/Dashboard/ReportWidget";
import StatWidget from "../components/Dashboard/StatWidget";
import ChartWidget from "../components/Dashboard/ChartWidget";

import { useFilters } from "../engine/FilterContext";
import {
    useDashboard,
    DashboardProvider,
} from "../engine/DashboardContext";

import type { DashboardDefinition } from "../types/dashboard";

import { useEffect, useMemo, useState } from "react";

import "./Dashboard.css";

import type { CSSProperties } from "react";

import TableWidget from "../components/Dashboard/TableWidget";
import ErrorState from "../components/Common/Error";

export default function Dashboard({
    dashboardId = "customer-dashboard",
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
    } = useDashboard();

    useEffect(() => {

        clearFilters();

    }, [dashboard.id, clearFilters]);

    const handleSearch = () => {
        const missing = (dashboard.filters ?? []).filter(filter => {
            const value = filters[filter.field];
            return filter.required && (
                value === undefined ||
                value === null ||
                value === "" ||
                (Array.isArray(value) && (
                    value.length === 0 ||
                    value.some(item => item === "" || item === null || item === undefined)
                ))
            );
        });

        if (missing.length > 0) {
            setFilterError(`Complete the required filter${missing.length > 1 ? "s" : ""}: ${missing.map(filter => filter.label).join(", ")}.`);
            return;
        }

        setFilterError("");
        applyFilters(filters);
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
                    disabled={isRefreshing}
                    title="Refresh dashboard data"
                >
                    {isRefreshing ? "Refreshing…" : "Refresh"}
                </button>
            </header>

            {dashboard.filters &&
                dashboard.filters.length > 0 && (
                    <section className="dashboard-filters" aria-labelledby="dashboard-filters-title">

                        <h2 id="dashboard-filters-title">Filters</h2>

                        <FilterRenderer
                            filters={dashboard.filters}
                        />

                        {filterError && <p className="form-error" role="alert">{filterError}</p>}

                        <div className="dashboard-filter-actions">

                            <button
                                type="button"
                                className="app-button app-button--primary"
                                onClick={handleSearch}
                            >
                                Search
                            </button>

                            <button
                                type="button"
                                className="app-button"
                                onClick={handleClearFilters}
                            >
                                Clear Filters
                            </button>

                        </div>

                    </section>
                )}

            {visibleWidgets.length === 0 ? (
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
                                    className="dashboard-widget"
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
                                        widget.reportId && (
                                            <ReportWidget
                                                reportId={
                                                    widget.reportId
                                                }
                                                title={
                                                    widget.title
                                                }
                                                description={
                                                    widget.description
                                                }
                                                filterDefinitions={
                                                    dashboard.filters ?? []
                                                }
                                                cacheScope={`${dashboard.id}:${widget.id}`}
                                            />
                                        )}

                                    {widget.type === "stat" &&
                                        widget.request && (
                                            <StatWidget
                                                title={
                                                    widget.title
                                                }
                                                description={
                                                    widget.description
                                                }
                                                request={
                                                    widget.request
                                                }
                                                format={
                                                    widget.format
                                                }
                                                filterDefinitions={
                                                    dashboard.filters ?? []
                                                }
                                                cacheScope={`${dashboard.id}:${widget.id}`}
                                            />
                                        )}

                                    {widget.type === "table" &&
                                        widget.request && (
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
                                                    widget.request
                                                }
                                                filterDefinitions={
                                                    dashboard.filters ?? []
                                                }
                                                cacheScope={`${dashboard.id}:${widget.id}`}
                                                exportConfig={widget.export}
                                            />
                                        )}

                                    {widget.type === "chart" &&
                                        widget.request &&
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
                                                    widget.request
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
