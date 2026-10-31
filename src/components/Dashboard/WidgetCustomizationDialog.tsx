import { useMemo, useState } from "react";

import type { ChartColorConfiguration, ChartCustomizationDraft } from "../../api/chartConfiguration";
import { getRequestErrorMessage } from "../../api/request";
import {
    inheritDashboardDatabase,
    resolveDashboardWidgetPresentationDefinition,
} from "../../engine/DashboardEngine";
import {
    getInitialPresentationView,
    resolveChartPresentation,
    type PresentationAvailability,
} from "../../engine/WidgetPresentationEngine";
import type { FilterValues } from "../../engine/FilterContext";
import type { FilterDefinition } from "../../types/filter";
import type { ChartOptions, DashboardWidget, WidgetPresentationView, WidgetTableViewState } from "../../types/widget";
import AccessibleDialog from "../Common/AccessibleDialog";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import Skeleton from "../Common/Skeleton";
import { useToast } from "../Notifications/ToastProvider";
import { ChartViewport } from "./ChartWidget";
import { applyChartTopN, describeChartData, mapChartData } from "./chartData";
import { getChartCapability } from "./chartCapabilities";
import { useDashboardWidgetRequest } from "./useDashboardWidgetRequest";

const EMPTY_ROWS: Record<string, unknown>[] = [];

interface AppliedCustomization {
    view: WidgetPresentationView;
    tableState: WidgetTableViewState;
    chartOptions: ChartOptions;
    showTooltip?: boolean;
}

export default function WidgetCustomizationDialog({
    widget,
    options,
    activeView,
    tableState,
    chartOptions,
    showTooltip,
    filterDefinitions,
    inheritedDatabase,
    runtimeFilterValues,
    cacheScope,
    colorConfiguration,
    canCustomizeChart,
    onSaveChartConfiguration,
    onApply,
    onClose,
}: {
    widget: DashboardWidget;
    options: PresentationAvailability[];
    activeView: WidgetPresentationView;
    tableState: WidgetTableViewState;
    chartOptions: ChartOptions;
    showTooltip?: boolean;
    filterDefinitions: FilterDefinition[];
    inheritedDatabase: string;
    runtimeFilterValues: FilterValues;
    cacheScope: string;
    colorConfiguration?: ChartColorConfiguration;
    canCustomizeChart: boolean;
    onSaveChartConfiguration?: (customization: ChartCustomizationDraft | null, revision: string) => Promise<ChartColorConfiguration>;
    onApply: (customization: AppliedCustomization) => void;
    onClose: () => void;
}) {
    const authoredView = getInitialPresentationView(widget);
    const authoredTable = widget.presentation?.table;
    const authoredColumns = authoredTable?.columns ?? widget.columns ?? [];
    const authoredPageSize = authoredTable?.pagination?.pageSize ?? authoredTable?.pageSize ?? widget.pagination?.pageSize ?? widget.pageSize ?? 10;
    const authoredChartOptions = { ...widget.chartOptions, ...widget.presentation?.chart?.chartOptions };
    const [draftView, setDraftView] = useState(activeView);
    const [draftTableState, setDraftTableState] = useState(tableState);
    const [draftChartOptions, setDraftChartOptions] = useState(chartOptions);
    const authoredShowTooltip = widget.presentation?.chart?.showTooltip ?? widget.showTooltip;
    const [draftShowTooltip, setDraftShowTooltip] = useState(showTooltip ?? authoredShowTooltip);
    const [draftSeriesColors, setDraftSeriesColors] = useState({ ...(colorConfiguration?.seriesColors ?? authoredChartOptions.seriesColors ?? {}) });
    const [draftCategoryColors, setDraftCategoryColors] = useState({ ...(colorConfiguration?.categoryColors ?? authoredChartOptions.categoryColors ?? {}) });
    const [resetRequested, setResetRequested] = useState(false);
    const [saving, setSaving] = useState(false);
    const toast = useToast();
    const resolved = useMemo(() => {
        const definition = resolveDashboardWidgetPresentationDefinition(widget, draftView, filterDefinitions);
        const request = definition?.request && inheritDashboardDatabase(definition.request, inheritedDatabase);
        return definition && request ? { ...definition, request } : definition;
    }, [draftView, filterDefinitions, inheritedDatabase, widget]);
    const chartPreviewRequest = draftView === "table" ? null : resolved?.request ?? null;
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        chartPreviewRequest,
        filterDefinitions,
        `${cacheScope}:customization:${draftView}`,
        widget.filterFields,
        widget.runtimeFilters,
        runtimeFilterValues,
    );
    const rows = response?.data ?? EMPTY_ROWS;
    const columns = resolved?.columns ?? authoredColumns;
    const chart = resolveChartPresentation(widget, draftView);
    const chartData = useMemo(
        () => chart ? applyChartTopN(mapChartData(rows, chart.xField, chart.yField), draftChartOptions) : [],
        [chart, draftChartOptions, rows],
    );
    const capability = chart ? getChartCapability(chart.chartType) : null;
    const incompatibility = capability?.incompatibility(chartData) ?? null;
    const pageSizeOptions = [...new Set([
        ...(authoredTable?.pagination?.pageSizeOptions ?? authoredTable?.pageSizeOptions ?? widget.pagination?.pageSizeOptions ?? widget.pageSizeOptions ?? [10, 25, 50, 100]),
        draftTableState.pageSize,
    ])].sort((left, right) => left - right);

    const reset = () => {
        setDraftView(authoredView);
        setDraftTableState({
            page: 1,
            pageSize: authoredPageSize,
            sort: authoredTable?.sort ?? [],
            columnVisibility: Object.fromEntries(authoredColumns.map(column => [column.field, column.visible !== false])),
        });
        setDraftChartOptions(authoredChartOptions);
        setDraftShowTooltip(authoredShowTooltip);
        setDraftSeriesColors({ ...(colorConfiguration?.authoredSeriesColors ?? authoredChartOptions.seriesColors ?? {}) });
        setDraftCategoryColors({ ...(colorConfiguration?.authoredCategoryColors ?? authoredChartOptions.categoryColors ?? {}) });
        setResetRequested(true);
    };
    const save = async () => {
        setSaving(true);
        try {
            if (draftView !== "table" && canCustomizeChart && colorConfiguration && onSaveChartConfiguration) {
                const selectedChart = resolveChartPresentation(widget, draftView);
                await onSaveChartConfiguration(resetRequested ? null : {
                    chartType: selectedChart?.chartType ?? colorConfiguration.chartType,
                    ...(selectedChart?.orientation ? { orientation: selectedChart.orientation } : {}),
                    seriesColors: draftSeriesColors,
                    categoryColors: draftCategoryColors,
                    ...(draftChartOptions.numberFormat ? { numberFormat: draftChartOptions.numberFormat } : {}),
                    ...(draftChartOptions.valueFormat ? { valueFormat: draftChartOptions.valueFormat } : {}),
                }, colorConfiguration.revision);
            }
            onApply({ view: draftView, tableState: draftTableState, chartOptions: draftChartOptions, showTooltip: draftShowTooltip });
            onClose();
        } catch (cause: unknown) {
            toast.notify("error", getRequestErrorMessage(cause, "Unable to save widget customization."));
        } finally {
            setSaving(false);
        }
    };
    const footer = <footer className="widget-customization__actions">
        <button type="button" className="app-button" disabled={saving} onClick={reset}>Reset to Default</button>
        <button type="button" className="app-button" disabled={saving} onClick={onClose}>Cancel</button>
        <button type="button" className="app-button app-button--primary" disabled={saving || !resolved?.request} onClick={() => void save()}>{saving ? "Saving…" : "Save Changes"}</button>
    </footer>;

    return <AccessibleDialog title="Customize Widget" className="widget-customization" onClose={onClose} footer={footer}>
        <section className="widget-customization__section" aria-labelledby="widget-presentation-heading">
            <h3 id="widget-presentation-heading">Presentation</h3>
            <div className="widget-customization__views">
                {options.map(option => <button
                    key={option.view}
                    type="button"
                    className={`app-button${draftView === option.view ? " app-button--primary" : ""}`}
                    aria-pressed={draftView === option.view}
                    disabled={saving || !option.available}
                    title={option.reason ?? `${option.label} presentation`}
                    onClick={() => { setDraftView(option.view); setResetRequested(false); }}
                >{option.label}</button>)}
            </div>
        </section>

        {draftView !== "table" && <section className="widget-customization__preview" aria-label={`${draftView} live preview`}>
            {loading && <Skeleton kind="chart" label="Loading preview…" />}
            {!loading && error && <ErrorState title="Unable to load preview" message={error} onRetry={retry} compact />}
            {!loading && !error && rows.length === 0 && <Empty title="No preview data" message="The current filters returned no data." compact />}
            {!loading && !error && rows.length > 0 && chart && capability?.supported && !incompatibility && <ChartViewport
                type={chart.chartType}
                data={chartData}
                yField={chart.yField}
                seriesColors={draftSeriesColors}
                categoryColors={draftCategoryColors}
                options={{ ...draftChartOptions, ...(chart.orientation ? { orientation: chart.orientation } : {}) }}
                showLegend={widget.presentation?.chart?.showLegend ?? widget.showLegend}
                showLabels={widget.presentation?.chart?.showLabels ?? widget.showLabels}
                showTooltip={draftShowTooltip}
                showGrid={widget.presentation?.chart?.showGrid ?? widget.showGrid}
                className="widget-customization__chart dashboard-widget-content__chart"
                ariaLabel={`${draftView} chart preview. ${describeChartData(chartData, draftChartOptions, capability.tooltipMode === "proportional")}`}
            />}
            {!loading && chart && incompatibility && <Empty title={`${capability?.label ?? "Chart"} is unavailable`} message={incompatibility} compact />}
        </section>}

        {draftView === "table" ? <section className="widget-customization__section" aria-labelledby="widget-table-heading">
            <h3 id="widget-table-heading">Table Settings</h3>
            <div className="widget-customization__form-grid">
                <label><span>Rows per page</span><select value={draftTableState.pageSize} onChange={event => setDraftTableState(previous => ({ ...previous, pageSize: Number(event.target.value), page: 1 }))}>{pageSizeOptions.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
                <label><span>Sort column</span><select value={draftTableState.sort[0]?.field ?? ""} onChange={event => setDraftTableState(previous => ({ ...previous, sort: event.target.value ? [{ field: event.target.value, direction: previous.sort[0]?.direction ?? "ASC" }] : [] }))}><option value="">Authored order</option>{columns.map(column => <option key={column.field} value={column.field}>{column.header ?? column.field}</option>)}</select></label>
                <label><span>Sort direction</span><select value={draftTableState.sort[0]?.direction ?? "ASC"} disabled={!draftTableState.sort.length} onChange={event => setDraftTableState(previous => ({ ...previous, sort: previous.sort.length ? [{ ...previous.sort[0], direction: event.target.value as "ASC" | "DESC" }] : [] }))}><option value="ASC">Ascending</option><option value="DESC">Descending</option></select></label>
            </div>
            <fieldset className="widget-customization__columns"><legend>Visible columns</legend>{columns.map(column => <label key={column.field}><input type="checkbox" checked={draftTableState.columnVisibility[column.field] !== false} onChange={event => setDraftTableState(previous => ({ ...previous, columnVisibility: { ...previous.columnVisibility, [column.field]: event.target.checked } }))} />{column.header ?? column.field}</label>)}</fieldset>
            <dl className="widget-customization__summary">
                <div><dt>Current page</dt><dd>{draftTableState.page}</dd></div>
                <div><dt>Pagination</dt><dd>Server-side paging and total-record controls remain active in the widget</dd></div>
                <div><dt>Formatting</dt><dd>Uses authored text, numeric, currency, and percentage column metadata</dd></div>
                <div><dt>Exports</dt><dd>{authoredTable?.export?.enabled ? authoredTable.export.formats.map(format => format.toUpperCase()).join(", ") : "Not enabled"}</dd></div>
                {(resolved?.grid.grouping || authoredTable?.export?.exportAll) && <div><dt>Advanced</dt><dd>{resolved?.grid.grouping ? "Authored grouping, aggregation, subtotals, and totals preserved" : "All-rows export preserved"}</dd></div>}
            </dl>
        </section> : <section className="widget-customization__section" aria-labelledby="widget-chart-heading">
            <h3 id="widget-chart-heading">Chart Settings</h3>
            <div className="widget-customization__form-grid">
                <label><span>Number notation</span><select value={draftChartOptions.numberFormat ?? ""} onChange={event => setDraftChartOptions(previous => ({ ...previous, numberFormat: (event.target.value || undefined) as ChartOptions["numberFormat"] }))}><option value="">Framework default</option><option value="compact-indian">Compact Indian</option><option value="full">Full Indian grouping</option><option value="compact">International compact</option></select></label>
                <label><span>Value style</span><select value={draftChartOptions.valueFormat ?? ""} onChange={event => setDraftChartOptions(previous => ({ ...previous, valueFormat: (event.target.value || undefined) as ChartOptions["valueFormat"] }))}><option value="">Number</option><option value="decimal">Decimal</option><option value="currency">Currency</option></select></label>
                <label><span>Top categories</span><input type="number" min="1" value={draftChartOptions.topN ?? ""} placeholder="All" onChange={event => setDraftChartOptions(previous => ({ ...previous, topN: event.target.value ? Number(event.target.value) : undefined }))} /></label>
                <label><span>Others label</span><input type="text" value={draftChartOptions.othersLabel ?? "Other"} disabled={!draftChartOptions.showOthers} onChange={event => setDraftChartOptions(previous => ({ ...previous, othersLabel: event.target.value }))} /></label>
            </div>
            <div className="widget-customization__toggles">
                <label><input type="checkbox" checked={draftChartOptions.showLegend ?? widget.presentation?.chart?.showLegend ?? widget.showLegend ?? false} onChange={event => setDraftChartOptions(previous => ({ ...previous, showLegend: event.target.checked }))} />Legend</label>
                <label><input type="checkbox" checked={draftShowTooltip ?? true} onChange={event => setDraftShowTooltip(event.target.checked)} />Tooltips</label>
                <label><input type="checkbox" checked={draftChartOptions.showLabels ?? draftChartOptions.showDataLabels ?? widget.presentation?.chart?.showLabels ?? widget.showLabels ?? false} onChange={event => setDraftChartOptions(previous => ({ ...previous, showLabels: event.target.checked }))} />Data labels</label>
                <label><input type="checkbox" checked={draftChartOptions.showGrid ?? widget.presentation?.chart?.showGrid ?? widget.showGrid ?? true} onChange={event => setDraftChartOptions(previous => ({ ...previous, showGrid: event.target.checked }))} />Grid</label>
                <label><input type="checkbox" checked={draftChartOptions.showOthers ?? false} onChange={event => setDraftChartOptions(previous => ({ ...previous, showOthers: event.target.checked }))} />Group remaining as Others</label>
                {(chart?.chartType === "line" || chart?.chartType === "area") && <label><input type="checkbox" checked={draftChartOptions.smooth ?? false} onChange={event => setDraftChartOptions(previous => ({ ...previous, smooth: event.target.checked }))} />Smooth line</label>}
                {(chart?.chartType === "pie" || chart?.chartType === "doughnut") && <label><input type="checkbox" checked={draftChartOptions.showCenterTotal ?? false} disabled={chart.chartType !== "doughnut"} onChange={event => setDraftChartOptions(previous => ({ ...previous, showCenterTotal: event.target.checked }))} />Center total</label>}
            </div>
            {canCustomizeChart && <fieldset className="widget-customization__columns"><legend>Chart colors</legend>{(capability?.colorMode === "category" ? chartData.map(item => item.name) : [chart?.yField ?? "Value"]).map((key, index) => <label key={key}><span>{key}</span><input type="color" value={(capability?.colorMode === "category" ? draftCategoryColors[key] : draftSeriesColors[key]) ?? ["#3274d9", "#2f9e8f", "#8b5cf6"][index % 3]} onChange={event => capability?.colorMode === "category" ? setDraftCategoryColors(previous => ({ ...previous, [key]: event.target.value.toUpperCase() })) : setDraftSeriesColors(previous => ({ ...previous, [key]: event.target.value.toUpperCase() }))} /></label>)}</fieldset>}
        </section>}
    </AccessibleDialog>;
}
