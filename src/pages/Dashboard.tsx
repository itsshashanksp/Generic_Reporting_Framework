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

import { useEffect, useMemo } from "react";

import "./Dashboard.css";

import type { CSSProperties } from "react";

import TableWidget from "../components/Dashboard/TableWidget";

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
            <div>
                <h1>Dashboard Not Found</h1>
            </div>
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
        clearFilters,
    } = useFilters();

    const {
        refreshDashboard,
        isRefreshing,
        finishRefresh,
    } = useDashboard();

    useEffect(() => {

        clearFilters();

    }, [dashboard.id, clearFilters]);

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
        <div
            style={{
                padding: "20px",
            }}
        >

            <h1>
                {dashboard.title}
            </h1>

            {dashboard.description && (
                <p>
                    {dashboard.description}
                </p>
            )}

            {dashboard.filters &&
                dashboard.filters.length > 0 && (
                    <div
                        style={{
                            marginBottom: "20px",
                        }}
                    >

                        <FilterRenderer
                            filters={dashboard.filters}
                        />

                        <div
                            style={{
                                display: "flex",
                                gap: "10px",
                                marginTop: "10px",
                            }}
                        >

                            <button
                                onClick={clearFilters}
                            >
                                Clear Filters
                            </button>

                            <button
                                onClick={refreshDashboard}
                                disabled={isRefreshing}
                            >
                                {isRefreshing
                                    ? "Refreshing..."
                                    : "Refresh"}
                            </button>

                        </div>

                    </div>
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

                                        border:
                                            "1px solid #ddd",

                                        borderRadius:
                                            "8px",

                                        padding:
                                            "16px",

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
                                                request={
                                                    widget.request
                                                }
                                                filterDefinitions={
                                                    dashboard.filters ?? []
                                                }
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
                                            />
                                        )}

                                </div>
                            );
                        }
                    )}

                </div>
            )}

        </div>
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
