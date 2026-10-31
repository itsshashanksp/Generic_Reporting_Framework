import { ResponsiveFilterPanel } from "../components/Filters";
import {
    getDashboard,
    getTargetedDashboardFilters,
    getPartialDateRanges,
    inheritDashboardDatabase,
    resolveDashboardWidgetDefinition,
    resolveDashboardWidgetColumns,
    resolveDashboardWidgetRequest,
    resolveDashboardWidgetPresentationDefinition,
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

import { memo, useEffect, useMemo, useRef, useState } from "react";


import type { CSSProperties } from "react";

import TableWidget from "../components/Dashboard/TableWidget";
import ErrorState from "../components/Common/Error";
import type { ChartColorConfiguration, ChartCustomizationDraft } from "../api/chartConfiguration";
import useDocumentTitle from "../components/Layout/useDocumentTitle";
import useDashboardRowHeaderAlignment from "../components/Dashboard/useDashboardRowHeaderAlignment";
import WidgetCustomizationDialog from "../components/Dashboard/WidgetCustomizationDialog";
import {
    getInitialPresentationView,
    getWidgetPresentationAvailability,
    resolveChartPresentation,
    presentationViewLabel,
} from "../engine/WidgetPresentationEngine";
import type { ChartOptions, WidgetPresentationView, WidgetTableViewState } from "../types/widget";
import type { PresentationAvailability } from "../engine/WidgetPresentationEngine";

const LEGACY_CHART_VIEWS: WidgetPresentationView[] = ["column", "bar", "line", "area", "pie", "doughnut", "treemap", "radial-bar"];

export default function Dashboard({
    dashboardId = "item-dashboard",
    chartColors = {},
    canCustomizeCharts = false,
    chartConfigurationError = "",
    onSaveChartConfiguration,
}: {
    dashboardId?: string;
    chartColors?: Record<string, ChartColorConfiguration>;
    canCustomizeCharts?: boolean;
    chartConfigurationError?: string;
    onSaveChartConfiguration?: (widgetId: string, customization: ChartCustomizationDraft | null, revision: string) => Promise<ChartColorConfiguration>;
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
                chartColors={chartColors}
                canCustomizeCharts={canCustomizeCharts}
                chartConfigurationError={chartConfigurationError}
                onSaveChartConfiguration={onSaveChartConfiguration}
            />
        </DashboardProvider>
    );
}

function DashboardContent({
    dashboard,
    chartColors,
    canCustomizeCharts,
    chartConfigurationError,
    onSaveChartConfiguration,
}: {
    dashboard: DashboardDefinition;
    chartColors: Record<string, ChartColorConfiguration>;
    canCustomizeCharts: boolean;
    chartConfigurationError: string;
    onSaveChartConfiguration?: (widgetId: string, customization: ChartCustomizationDraft | null, revision: string) => Promise<ChartColorConfiguration>;
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
    const dashboardGridRef = useRef<HTMLDivElement>(null);
    const widgetLayoutKey = visibleWidgets.map(widget => [
        widget.id,
        widget.width ?? "auto",
        widget.height ?? "auto",
        widget.position?.x ?? "auto",
        widget.position?.y ?? "auto",
    ].join(":")).join("|");

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
    const hasUnpinnedWidget = visibleWidgets.some(widget => {
        const request = resolveDashboardWidgetRequest(widget, dashboard.filters ?? []);
        if (request && request.database === undefined) return true;
        if (!widget.presentation || widget.presentation.allowSwitching === false) return false;
        return widget.presentation.allowedViews.some(view =>
            resolveDashboardWidgetPresentationDefinition(widget, view, dashboard.filters ?? [])?.request.database === undefined
        );
    });
    const pageDatabaseSelection = globalDatabase
        ? globalDatabase.pageDatabaseSelection && hasUnpinnedWidget
        : dashboard.databaseSelection === true;
    const databaseSelection = useDatabaseSelection(
        `dashboard:${dashboard.id}`,
        pageDatabaseSelection,
        globalDatabase?.database
    );
    const selectedDatabase = databaseSelection.database;
    const effectiveInheritedDatabase = pageDatabaseSelection ? selectedDatabase : globalDatabase?.database ?? "";
    const databaseBlocked = databaseSelection.status !== "off" && databaseSelection.status !== "ready"
        || !pageDatabaseSelection && hasUnpinnedWidget && globalDatabase?.resolving === true;

    // Widgets mount (and so request, refresh and export) only once the applied
    // filters complete every required filter, e.g. both dates of a range.
    const missingAppliedFilters = (dashboard.filters ?? []).filter(
        filter => isRequiredFilterIncomplete(filter, appliedFilters[filter.field])
    );
    useDashboardRowHeaderAlignment(
        dashboardGridRef,
        `${widgetLayoutKey}:${databaseBlocked}:${missingAppliedFilters.length}`,
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
                    {pageDatabaseSelection && (
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

            {chartConfigurationError && canCustomizeCharts && <p className="dashboard-widget-inline-error" role="alert">{chartConfigurationError}</p>}

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
                    ref={dashboardGridRef}
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
                            chartColorConfiguration={chartColors[widget.id]}
                            canCustomizeChart={canCustomizeCharts}
                            onSaveChartConfiguration={onSaveChartConfiguration}
                            filterDefinitions={getTargetedDashboardFilters(dashboard.filters ?? [], widget.id, widget.pageFilterExclusions)}
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

export const DashboardWidgetCard = memo(function DashboardWidgetCard({
    widget,
    dashboardId,
    filterDefinitions,
    inheritedDatabase,
    columns,
    tabletColumns,
    mobileColumns,
    chartColorConfiguration,
    canCustomizeChart,
    onSaveChartConfiguration,
}: {
    widget: DashboardDefinition["widgets"][number];
    dashboardId: string;
    filterDefinitions: FilterDefinition[];
    inheritedDatabase: string;
    columns: number;
    tabletColumns: number;
    mobileColumns: number;
    chartColorConfiguration?: ChartColorConfiguration;
    canCustomizeChart: boolean;
    onSaveChartConfiguration?: (widgetId: string, customization: ChartCustomizationDraft | null, revision: string) => Promise<ChartColorConfiguration>;
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
    const presentationOptions = useMemo(
        () => getWidgetPresentationAvailability(widget),
        [widget]
    );
    const customizationOptions = useMemo<PresentationAvailability[]>(() => {
        if (presentationOptions.length) return presentationOptions;
        if (widget.type === "table") return [{ view: "table", label: "Table", available: true, reason: null }];
        if (widget.type !== "chart") return [];
        if (widget.presentation?.allowSwitching === false) {
            const view = getInitialPresentationView(widget);
            return [{ view, label: presentationViewLabel(view), available: true, reason: null }];
        }
        return LEGACY_CHART_VIEWS.map(view => ({ view, label: presentationViewLabel(view), available: true, reason: null }));
    }, [presentationOptions, widget]);
    const [selectedPresentation, setSelectedPresentation] = useState<ReturnType<typeof getInitialPresentationView> | null>(null);
    const [customizationOpen, setCustomizationOpen] = useState(false);
    const [chartOptionOverrides, setChartOptionOverrides] = useState<ChartOptions>({});
    const [chartTooltipOverride, setChartTooltipOverride] = useState<boolean | undefined>();
    const savedChartPresentation = chartColorConfiguration
        ? chartColorConfiguration.chartType === "bar"
            ? chartColorConfiguration.orientation === "horizontal" ? "bar" : "column"
            : chartColorConfiguration.chartType
        : null;
    const activePresentation = selectedPresentation
        ?? (savedChartPresentation && customizationOptions.some(option => option.view === savedChartPresentation && option.available)
            ? savedChartPresentation
            : getInitialPresentationView(widget));
    const tablePresentation = widget.presentation?.table;
    const initialTableColumns = tablePresentation?.columns ?? resolved.columns ?? [];
    const initialTablePageSize = tablePresentation?.pagination?.pageSize
        ?? tablePresentation?.pageSize
        ?? widget.pagination?.pageSize
        ?? widget.pageSize
        ?? 10;
    const [tableViewState, setTableViewState] = useState<WidgetTableViewState>(() => ({
        page: 1,
        pageSize: initialTablePageSize,
        sort: tablePresentation?.sort ?? resolved.definition?.sort ?? [],
        columnVisibility: Object.fromEntries(initialTableColumns.map(column => [column.field, column.visible !== false])),
    }));
    const [presentationRuntimeFilters, setPresentationRuntimeFilters] = useState<FilterValues>({});
    const presentationEnabled = presentationOptions.length >= 2;
    const customizationEnabled = customizationOptions.length > 0;
    const presentationControl = customizationEnabled ? (
        <button
            type="button"
            className="app-button widget-customize-action"
            onClick={() => setCustomizationOpen(true)}
        >Customize</button>
    ) : null;
    const activeMode = presentationEnabled
        ? activePresentation === "table" ? "table" : "chart"
        : widget.type;
    const presentationResolved = useMemo(() => {
        if (!presentationEnabled || (activeMode !== "table" && activeMode !== "chart")) return resolved;
        const definition = resolveDashboardWidgetPresentationDefinition(widget, activePresentation, filterDefinitions);
        const baseRequest = definition?.request;
        const request = baseRequest && inheritDashboardDatabase(baseRequest, inheritedDatabase);
        return {
            request,
            definition: definition && request ? { ...definition, request } : definition,
            columns: definition?.columns,
        };
    }, [presentationEnabled, activeMode, resolved, widget, activePresentation, filterDefinitions, inheritedDatabase]);
    const activeResolved = presentationEnabled ? presentationResolved : resolved;
    const activeChart = activeMode === "chart"
        ? resolveChartPresentation(widget, activePresentation)
        : null;
    const widgetWidth = Math.min(Math.max(widget.width ?? 12, 1), columns);
    const positionX = widget.position
        ? Math.max(0, Math.min(widget.position.x, columns - widgetWidth))
        : null;
    const positionY = widget.position ? Math.max(1, widget.position.y) : null;
    const widgetContextKey = `${widget.id}:${activeResolved.request?.database ?? ""}`;
    const cacheScope = `${dashboardId}:${widget.id}${presentationEnabled ? `:${activeMode}` : ""}`;

    return (
        <div
            key={widgetContextKey}
            className={`dashboard-widget${activeMode === "table" || activeMode === "report" ? " dashboard-widget--table" : ""}`}
            data-dashboard-widget={widget.id}
            data-fixed-height={widget.height !== undefined ? "true" : undefined}
            style={{
                gridColumn: positionX !== null ? `${positionX + 1} / span ${widgetWidth}` : `span ${widgetWidth}`,
                gridRow: positionY !== null ? `${positionY}` : "auto",
                height: widget.height !== undefined ? `${widget.height}px` : "auto",
                "--dashboard-tablet-widget-width": getResponsiveWidgetWidth(widgetWidth, columns, tabletColumns),
                "--dashboard-mobile-widget-width": getResponsiveWidgetWidth(widgetWidth, columns, mobileColumns),
            } as CSSProperties}
        >
            {activeMode === "report" && activeResolved.definition && (
                <ReportWidget definition={activeResolved.definition} title={widget.title} description={widget.description}
                    filterDefinitions={filterDefinitions} filterFields={widget.filterFields} runtimeFilters={widget.runtimeFilters}
                    runtimeFilterDisplay={widget.runtimeFilterDisplay} cacheScope={cacheScope} />
            )}
            {activeMode === "stat" && activeResolved.request && (
                <StatWidget title={widget.title} description={widget.description} request={activeResolved.request}
                    valueField={widget.valueField} format={widget.format} currency={widget.currency} filterDefinitions={filterDefinitions}
                    filterFields={widget.filterFields} runtimeFilters={widget.runtimeFilters}
                    runtimeFilterDisplay={widget.runtimeFilterDisplay} cacheScope={cacheScope} />
            )}
            {activeMode === "table" && activeResolved.request && (
                <TableWidget title={widget.title} description={widget.description}
                    pageSize={presentationEnabled ? tablePresentation?.pageSize ?? widget.pageSize : widget.pageSize}
                    pageSizeOptions={presentationEnabled ? tablePresentation?.pageSizeOptions ?? widget.pageSizeOptions : widget.pageSizeOptions}
                    pagination={presentationEnabled ? tablePresentation?.pagination ?? widget.pagination : widget.pagination}
                    request={activeResolved.request}
                    columns={activeResolved.columns} filterDefinitions={filterDefinitions} filterFields={widget.filterFields}
                    runtimeFilters={widget.runtimeFilters} runtimeFilterDisplay={widget.runtimeFilterDisplay}
                    runtimeFilterValues={customizationEnabled ? presentationRuntimeFilters : undefined}
                    onRuntimeFilterValuesChange={customizationEnabled ? setPresentationRuntimeFilters : undefined}
                    cacheScope={cacheScope}
                    exportConfig={presentationEnabled
                        ? tablePresentation?.export ?? (widget.type === "table" ? widget.export : undefined)
                        : widget.export}
                    grouping={activeResolved.definition?.grid.grouping}
                    headerActions={presentationControl}
                    viewState={customizationEnabled ? tableViewState : undefined}
                    onViewStateChange={customizationEnabled ? next => setTableViewState(previous => (
                        previous.page === next.page
                        && previous.pageSize === next.pageSize
                        && previous.queryKey === next.queryKey
                        && JSON.stringify(previous.sort) === JSON.stringify(next.sort)
                        && JSON.stringify(previous.columnVisibility) === JSON.stringify(next.columnVisibility)
                            ? previous
                            : next
                    )) : undefined} />
            )}
            {activeMode === "chart" && activeResolved.request
                && (activeChart?.xField ?? widget.xField) && (activeChart?.yField ?? widget.yField) && (
                <ChartWidget title={widget.title} description={widget.description} request={activeResolved.request}
                    xField={(activeChart?.xField ?? widget.xField)!} yField={(activeChart?.yField ?? widget.yField)!}
                    chartType={widget.chartType ?? activeChart?.chartType}
                    chartOptions={{ ...widget.chartOptions, ...widget.presentation?.chart?.chartOptions, ...chartOptionOverrides }}
                    showLegend={widget.presentation?.chart?.showLegend ?? widget.showLegend}
                    showTooltip={chartTooltipOverride ?? widget.presentation?.chart?.showTooltip ?? widget.showTooltip}
                    showGrid={widget.presentation?.chart?.showGrid ?? widget.showGrid}
                    showLabels={widget.presentation?.chart?.showLabels ?? widget.showLabels} filterDefinitions={filterDefinitions}
                    filterFields={widget.filterFields} runtimeFilters={widget.runtimeFilters}
                    runtimeFilterDisplay={widget.runtimeFilterDisplay}
                    runtimeFilterValues={customizationEnabled ? presentationRuntimeFilters : undefined}
                    onRuntimeFilterValuesChange={customizationEnabled ? setPresentationRuntimeFilters : undefined}
                    exportConfig={presentationEnabled
                        ? widget.presentation?.chart?.export ?? (widget.type === "chart" ? widget.export : undefined)
                        : widget.export} cacheScope={cacheScope}
                    colorConfiguration={chartColorConfiguration} canCustomizeColors={false}
                    headerActions={presentationControl}
                    presentationChartType={activeChart?.chartType}
                    presentationOrientation={activeChart?.orientation}
                    onSaveConfiguration={onSaveChartConfiguration ? (customization, revision) => onSaveChartConfiguration(widget.id, customization, revision) : undefined} />
            )}
            {customizationOpen && customizationEnabled && (
                <WidgetCustomizationDialog
                    widget={widget}
                    options={customizationOptions}
                    activeView={activePresentation}
                    tableState={tableViewState}
                    chartOptions={{ ...widget.chartOptions, ...widget.presentation?.chart?.chartOptions, ...chartOptionOverrides }}
                    showTooltip={chartTooltipOverride ?? widget.presentation?.chart?.showTooltip ?? widget.showTooltip}
                    filterDefinitions={filterDefinitions}
                    inheritedDatabase={inheritedDatabase}
                    runtimeFilterValues={presentationRuntimeFilters}
                    cacheScope={cacheScope}
                    colorConfiguration={chartColorConfiguration}
                    canCustomizeChart={canCustomizeChart}
                    onSaveChartConfiguration={onSaveChartConfiguration
                        ? (customization, revision) => onSaveChartConfiguration(widget.id, customization, revision)
                        : undefined}
                    onApply={customization => {
                        setSelectedPresentation(customization.view);
                        setTableViewState(customization.tableState);
                        setChartOptionOverrides(customization.chartOptions);
                        setChartTooltipOverride(customization.showTooltip);
                    }}
                    onClose={() => setCustomizationOpen(false)}
                />
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
