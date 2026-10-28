import { ResponsiveFilterPanel } from "../components/Filters";
import {
    getDashboard,
    getPartialDateRanges,
    inheritDashboardDatabase,
    resolveDashboardWidgetDefinition,
    resolveDashboardWidgetColumns,
    resolveDashboardWidgetRequest,
} from "../engine/DashboardEngine";

import ReportWidget from "../components/Dashboard/ReportWidget";
import StatWidget from "../components/Dashboard/StatWidget";
import ChartWidget from "../components/Dashboard/ChartWidget";
import DatabaseSelect from "../components/Toolbar/DatabaseSelect";
import { useDatabaseSelection } from "../components/Toolbar/useDatabaseSelection";
import { useOptionalGlobalDatabase } from "../engine/DatabaseContext";

import { useFilters } from "../engine/FilterContext";
import { getFilterValueErrors, isRequiredFilterIncomplete } from "../engine/FilterEngine";
import {
    useDashboard,
    DashboardProvider,
} from "../engine/DashboardContext";

import type { DashboardDefinition } from "../types/dashboard";
import type { FilterValues } from "../engine/FilterContext";
import type { FilterDefinition } from "../types/filter";

import { memo, useEffect, useMemo, useState } from "react";


import type { CSSProperties } from "react";

import TableWidget from "../components/Dashboard/TableWidget";
import ErrorState from "../components/Common/Error";
import useDocumentTitle from "../components/Layout/useDocumentTitle";

export default function Dashboard({
    dashboardId = "item-dashboard",
}: {
    dashboardId?: string;
}) {

    const dashboardResult = useMemo(
        () => getDashboard(dashboardId),
        [dashboardId]
    );
    useDocumentTitle(dashboardResult.status === "valid" ? dashboardResult.dashboard.title : null);

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

    // Same selection logic as reports: an authorized global default is used
    // before the backend registry fallback. Until a database is resolved no widget is mounted, so none
    // can silently query the backend default.
    const globalDatabase = useOptionalGlobalDatabase();
    const databaseSelection = useDatabaseSelection(
        dashboard.id,
        dashboard.databaseSelection === true,
        globalDatabase?.database
    );
    const selectedDatabase = databaseSelection.database;
    const effectiveInheritedDatabase = dashboard.databaseSelection ? selectedDatabase : globalDatabase?.database ?? "";
    const hasUnpinnedWidget = visibleWidgets.some(widget => {
        const request = resolveDashboardWidgetRequest(widget, dashboard.filters ?? []);
        return request && request.database === undefined;
    });
    const databaseBlocked = databaseSelection.status !== "off" && databaseSelection.status !== "ready"
        || !dashboard.databaseSelection && hasUnpinnedWidget && globalDatabase?.resolving === true;

    // Widgets mount (and so request, refresh and export) only once the applied
    // filters complete every required filter, e.g. both dates of a range.
    const missingAppliedFilters = (dashboard.filters ?? []).filter(
        filter => isRequiredFilterIncomplete(filter, appliedFilters[filter.field])
    );

    useEffect(() => {

        clearFilters();

    }, [dashboard.id, clearFilters]);

    const handleSearch = () => {
        const valueErrors = getFilterValueErrors(dashboard.filters ?? [], filters);

        if (valueErrors.length > 0) {
            setFilterError(valueErrors.join(" "));
            // Required-filter failures close the result gate. Optional invalid
            // drafts leave the previously applied result state untouched.
            if ((dashboard.filters ?? []).some(
                filter => filter.required && isRequiredFilterIncomplete(filter, filters[filter.field])
            )) {
                applyFilters({});
            }
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
                <div className="dashboard-header__actions">
                    {dashboard.databaseSelection && (
                        <DatabaseSelect
                            value={selectedDatabase}
                            options={databaseSelection.options}
                            onChange={databaseSelection.select}
                        />
                    )}
                    <button
                        type="button"
                        className="app-button app-button--primary"
                        onClick={refreshDashboard}
                        disabled={isRefreshing || missingAppliedFilters.length > 0 || databaseBlocked}
                        title="Refresh dashboard data"
                    >
                        {isRefreshing ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </header>

            {dashboard.filters &&
                dashboard.filters.length > 0 && (
                    <ResponsiveFilterPanel
                        filters={dashboard.filters}
                        database={effectiveInheritedDatabase || undefined}
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

            {databaseBlocked ? (
                databaseSelection.status === "loading" || globalDatabase?.resolving ? (
                    <div className="dashboard-empty" role="status">Loading databases…</div>
                ) : (
                    <div className="dashboard-empty" role="status">
                        {databaseSelection.status === "listing-failed"
                            ? `The database list could not be loaded: ${databaseSelection.error}`
                            : "No authorized, enabled and available database was returned."}
                        {" "}
                        <button type="button" className="app-button" onClick={databaseSelection.retry}>Try again</button>
                    </div>
                )
            ) : missingAppliedFilters.length > 0 ? (
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

                    {visibleWidgets.map(widget => (
                        <DashboardWidgetCard
                            key={widget.id}
                            widget={widget}
                            dashboardId={dashboard.id}
                            filterDefinitions={dashboard.filters ?? []}
                            inheritedDatabase={effectiveInheritedDatabase}
                            columns={columns}
                            tabletColumns={tabletColumns}
                            mobileColumns={mobileColumns}
                        />
                    ))}

                </div>
            )}

        </main>
    );
}

const DashboardWidgetCard = memo(function DashboardWidgetCard({
    widget,
    dashboardId,
    filterDefinitions,
    inheritedDatabase,
    columns,
    tabletColumns,
    mobileColumns,
}: {
    widget: DashboardDefinition["widgets"][number];
    dashboardId: string;
    filterDefinitions: FilterDefinition[];
    inheritedDatabase: string;
    columns: number;
    tabletColumns: number;
    mobileColumns: number;
}) {
    const resolved = useMemo(() => {
        const definition = resolveDashboardWidgetDefinition(widget, filterDefinitions);
        const baseRequest = definition?.request ?? resolveDashboardWidgetRequest(widget, filterDefinitions);
        const request = baseRequest && inheritDashboardDatabase(baseRequest, inheritedDatabase);
        return {
            request,
            definition: definition && request ? { ...definition, request } : definition,
            columns: definition?.columns ?? resolveDashboardWidgetColumns(widget, filterDefinitions),
        };
    }, [widget, filterDefinitions, inheritedDatabase]);
    const widgetWidth = Math.min(Math.max(widget.width ?? 12, 1), columns);
    const positionX = widget.position
        ? Math.max(0, Math.min(widget.position.x, columns - widgetWidth))
        : null;
    const positionY = widget.position ? Math.max(1, widget.position.y) : null;
    const widgetContextKey = `${widget.id}:${resolved.request?.database ?? ""}`;
    const cacheScope = `${dashboardId}:${widget.id}`;

    return (
        <div
            key={widgetContextKey}
            className={`dashboard-widget${widget.type === "table" || widget.type === "report" ? " dashboard-widget--table" : ""}`}
            data-fixed-height={widget.height !== undefined ? "true" : undefined}
            style={{
                gridColumn: positionX !== null ? `${positionX + 1} / span ${widgetWidth}` : `span ${widgetWidth}`,
                gridRow: positionY !== null ? `${positionY}` : "auto",
                height: widget.height !== undefined ? `${widget.height}px` : "auto",
                "--dashboard-tablet-widget-width": getResponsiveWidgetWidth(widgetWidth, columns, tabletColumns),
                "--dashboard-mobile-widget-width": getResponsiveWidgetWidth(widgetWidth, columns, mobileColumns),
            } as CSSProperties}
        >
            {widget.type === "report" && resolved.definition && (
                <ReportWidget definition={resolved.definition} title={widget.title} description={widget.description}
                    filterDefinitions={filterDefinitions} filterFields={widget.filterFields} runtimeFilters={widget.runtimeFilters}
                    runtimeFilterDisplay={widget.runtimeFilterDisplay} cacheScope={cacheScope} />
            )}
            {widget.type === "stat" && resolved.request && (
                <StatWidget title={widget.title} description={widget.description} request={resolved.request}
                    valueField={widget.valueField} format={widget.format} filterDefinitions={filterDefinitions}
                    filterFields={widget.filterFields} runtimeFilters={widget.runtimeFilters}
                    runtimeFilterDisplay={widget.runtimeFilterDisplay} cacheScope={cacheScope} />
            )}
            {widget.type === "table" && resolved.request && (
                <TableWidget title={widget.title} description={widget.description} pageSize={widget.pageSize}
                    pageSizeOptions={widget.pageSizeOptions} pagination={widget.pagination} request={resolved.request}
                    columns={resolved.columns} filterDefinitions={filterDefinitions} filterFields={widget.filterFields}
                    runtimeFilters={widget.runtimeFilters} runtimeFilterDisplay={widget.runtimeFilterDisplay}
                    cacheScope={cacheScope} exportConfig={widget.export} />
            )}
            {widget.type === "chart" && resolved.request && widget.xField && widget.yField && (
                <ChartWidget title={widget.title} description={widget.description} request={resolved.request}
                    xField={widget.xField} yField={widget.yField} chartType={widget.chartType}
                    chartOptions={widget.chartOptions} showLegend={widget.showLegend} showTooltip={widget.showTooltip}
                    showGrid={widget.showGrid} showLabels={widget.showLabels} filterDefinitions={filterDefinitions}
                    filterFields={widget.filterFields} runtimeFilters={widget.runtimeFilters}
                    runtimeFilterDisplay={widget.runtimeFilterDisplay} exportConfig={widget.export} cacheScope={cacheScope} />
            )}
        </div>
    );
});

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
