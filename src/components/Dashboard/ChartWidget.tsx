import { useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Legend, Line, LineChart, Pie, PieChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from "recharts";

import { getRequestErrorMessage } from "../../api/request";
import type { ChartColorConfiguration, ChartCustomizationDraft } from "../../api/chartConfiguration";
import { exportChartPNG, exportChartSVG, exportExcel, exportRowsCSV } from "../../engine/ExportEngine";
import type { WidgetFilterFields } from "../../engine/DashboardEngine/filterFields";
import type { ExportConfig } from "../../types/export";
import type { FilterDefinition } from "../../types/filter";
import type { ChartOptions, ChartType, WidgetRequest } from "../../types/widget";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import ExportMenu, { type ExportMenuOption } from "../Common/ExportMenu";
import Skeleton from "../Common/Skeleton";
import AccessibleDialog from "../Common/AccessibleDialog";
import { useToast } from "../Notifications/ToastProvider";
import DashboardWidgetFrame from "./DashboardWidgetFrame";
import WidgetFilterController, { type WidgetFilterControls } from "./WidgetFilterController";
import { applyChartTopN, formatChartNumber, formatChartTooltipValue, getHorizontalBarChartHeight, getHorizontalCategoryAxisWidth, getVisiblePieLabelIndexes, isLikelyOrderedChartDimension, mapChartData, type ChartDatum } from "./chartData";
import { useDashboardWidgetRequest } from "./useDashboardWidgetRequest";
import { CHART_CAPABILITIES, getChartCapability } from "./chartCapabilities";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];
const CHART_COLORS = ["#3274d9", "#2f9e8f", "#8b5cf6", "#e07a32", "#d94f8a", "#5b8def", "#73a857", "#c49a32"];
const AXIS_COLOR = "#64748b";
const GRID_COLOR = "#e2e8f0";
const axisDomain = [
    (value: number) => Math.min(0, value),
    (value: number) => Math.max(0, value),
] as const;

type ChartSelection = {
    capability: (typeof CHART_CAPABILITIES)[number];
    label: string;
    orientation?: NonNullable<ChartOptions["orientation"]>;
};

function chartSelectionsForCategory(category: (typeof CHART_CAPABILITIES)[number]["category"]): ChartSelection[] {
    return CHART_CAPABILITIES.filter(capability => capability.category === category).flatMap<ChartSelection>(capability => capability.type === "bar"
        ? [{ capability, label: "Column", orientation: "vertical" }, { capability, label: "Bar", orientation: "horizontal" }]
        : [{ capability, label: capability.label }]);
}

interface PieLabelProps {
    cx?: number;
    cy?: number;
    outerRadius?: number;
    midAngle?: number;
    index?: number;
    value?: unknown;
    points?: Array<{ x: number; y: number }>;
}

type PieLabelVisibility = (outerRadius: number) => Set<number>;
const pieLabelVisibilityCache = new WeakMap<ChartDatum[], Map<number, Set<number>>>();

function getCachedPieLabelVisibility(data: ChartDatum[], outerRadius: number) {
    let byRadius = pieLabelVisibilityCache.get(data);
    if (!byRadius) {
        byRadius = new Map();
        pieLabelVisibilityCache.set(data, byRadius);
    }
    const cached = byRadius.get(outerRadius);
    if (cached) return cached;
    const visible = getVisiblePieLabelIndexes(data, outerRadius);
    byRadius.set(outerRadius, visible);
    return visible;
}

function isVisiblePieLabel(props: PieLabelProps, getVisibility: PieLabelVisibility) {
    return typeof props.index === "number"
        && getVisibility(Number(props.outerRadius) || 0).has(props.index);
}

function renderPieLabel(props: PieLabelProps, getVisibility: PieLabelVisibility, options?: ChartOptions) {
    if (!isVisiblePieLabel(props, getVisibility)) return null;
    const cx = Number(props.cx) || 0;
    const cy = Number(props.cy) || 0;
    const radius = (Number(props.outerRadius) || 0) + 16;
    const radians = -(Number(props.midAngle) || 0) * Math.PI / 180;
    const x = cx + Math.cos(radians) * radius;
    const y = cy + Math.sin(radians) * radius;
    return <text x={x} y={y} dy="0.35em" textAnchor={x >= cx ? "start" : "end"} className="dashboard-chart-external-label">{formatChartNumber(props.value, options)}</text>;
}

function renderPieLabelLine(props: PieLabelProps, getVisibility: PieLabelVisibility) {
    if (!isVisiblePieLabel(props, getVisibility) || !props.points?.length) return <g />;
    return <polyline points={props.points.map(point => `${point.x},${point.y}`).join(" ")} className="dashboard-chart-label-line" />;
}

function formatTooltipPresentation(value: unknown, options: ChartOptions, proportionalTotal = 0) {
    const fullValue = formatChartTooltipValue(value, options);
    if (proportionalTotal <= 0) return fullValue;
    const percentage = Number(value) / proportionalTotal * 100;
    return `${fullValue} (${percentage.toLocaleString("en-IN", { maximumFractionDigits: 2 })}%)`;
}

function ChartCustomizationPreview({ type, data, yField, seriesColors, categoryColors, options }: {
    type: ChartType;
    data: ChartDatum[];
    yField: string;
    seriesColors: Record<string, string>;
    categoryColors: Record<string, string>;
    options: ChartOptions;
}) {
    const horizontal = type === "bar" && options.orientation === "horizontal";
    const proportionalTotal = getChartCapability(type).tooltipMode === "proportional"
        ? data.reduce((sum, item) => sum + Math.max(0, item.value ?? 0), 0)
        : 0;
    const proportional = proportionalTotal > 0;
    const labels = options.showLabels ?? options.showDataLabels ?? proportional;
    const legend = options.showLegend ? <Legend /> : null;
    const labelVisibility: PieLabelVisibility = outerRadius => getCachedPieLabelVisibility(data, outerRadius);
    const tooltip = <Tooltip formatter={value => formatTooltipPresentation(value, options, proportionalTotal)} labelFormatter={label => String(label ?? "")} />;
    const categoryCells = data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={categoryColors[entry.name] ?? CHART_COLORS[index % CHART_COLORS.length]} />);
    return <div className="chart-color-dialog__preview" role="img" aria-label={`${type} chart preview`}>
        <ResponsiveContainer width="100%" height="100%">
            {type === "line" ? <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <XAxis dataKey="name" hide /><YAxis hide domain={axisDomain} />
                {tooltip}{legend}
                <Line type="linear" dataKey="value" stroke={seriesColors[yField] ?? CHART_COLORS[0]} strokeWidth={2.5} dot={false} label={labels} isAnimationActive={false} />
            </LineChart> : type === "area" ? <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <XAxis dataKey="name" hide /><YAxis hide domain={axisDomain} />
                {tooltip}{legend}
                <Area type="linear" dataKey="value" stroke={seriesColors[yField] ?? CHART_COLORS[0]} fill={seriesColors[yField] ?? CHART_COLORS[0]} fillOpacity={0.25} label={labels} isAnimationActive={false} />
            </AreaChart> : type === "pie" || type === "doughnut" ? <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="68%" innerRadius={type === "doughnut" ? "48%" : 0} label={labels ? entry => renderPieLabel(entry, labelVisibility, options) : false} labelLine={labels ? entry => renderPieLabelLine(entry, labelVisibility) : false} isAnimationActive={false}>
                    {categoryCells}
                </Pie>
                {tooltip}{legend}
            </PieChart> : type === "treemap" ? <Treemap data={data} dataKey="value" nameKey="name" isAnimationActive={false}>{categoryCells}{tooltip}{legend}</Treemap>
            : type === "radial-bar" ? <RadialBarChart data={data} innerRadius="20%" outerRadius="90%"><RadialBar dataKey="value" background label={labels} isAnimationActive={false}>{categoryCells}</RadialBar>{tooltip}{legend}</RadialBarChart>
            : <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                {horizontal ? <><XAxis type="number" hide domain={axisDomain} /><YAxis type="category" dataKey="name" hide /></> : <><XAxis dataKey="name" hide /><YAxis hide domain={axisDomain} /></>}
                {tooltip}{legend}
                <Bar dataKey="value" fill={seriesColors[yField] ?? CHART_COLORS[0]} radius={[4, 4, 0, 0]} label={labels} isAnimationActive={false} />
            </BarChart>}
        </ResponsiveContainer>
    </div>;
}

interface ChartWidgetProps {
    title: string;
    description?: string;
    request: WidgetRequest;
    xField: string;
    yField: string;
    chartType?: ChartType;
    chartOptions?: ChartOptions;
    showLegend?: boolean;
    showTooltip?: boolean;
    showGrid?: boolean;
    showLabels?: boolean;
    exportConfig?: ExportConfig;
    filterDefinitions?: FilterDefinition[];
    filterFields?: WidgetFilterFields;
    cacheScope?: string;
    runtimeFilters?: FilterDefinition[];
    runtimeFilterDisplay?: "inline" | "dialog";
    colorConfiguration?: ChartColorConfiguration;
    canCustomizeColors?: boolean;
    onSaveConfiguration?: (customization: ChartCustomizationDraft | null, revision: string) => Promise<ChartColorConfiguration>;
}

export default function ChartWidget({ runtimeFilters = EMPTY_FILTER_DEFINITIONS, ...props }: ChartWidgetProps) {
    return (
        <WidgetFilterController filters={runtimeFilters} database={props.request.database} widgetTitle={props.title} display={props.runtimeFilterDisplay}>
            {controls => <ChartWidgetContent {...props} runtimeFilters={runtimeFilters} widgetFilterControls={controls} />}
        </WidgetFilterController>
    );
}

function ChartWidgetContent({
    title, description, request, xField, yField, chartType = "bar", chartOptions,
    showLegend = false, showTooltip = true, showGrid = true, showLabels,
    exportConfig, filterDefinitions = EMPTY_FILTER_DEFINITIONS, filterFields, cacheScope,
    runtimeFilters = EMPTY_FILTER_DEFINITIONS, widgetFilterControls,
    colorConfiguration, canCustomizeColors = false, onSaveConfiguration,
}: ChartWidgetProps & { widgetFilterControls: WidgetFilterControls }) {
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        request, filterDefinitions, cacheScope, filterFields, runtimeFilters, widgetFilterControls.appliedValues
    );
    const chartRef = useRef<HTMLDivElement>(null);
    const toast = useToast();
    const [exporting, setExporting] = useState(false);
    const [colorDialogOpen, setColorDialogOpen] = useState(false);
    const [draftChartType, setDraftChartType] = useState<ChartType>(chartType);
    const [draftSeriesColors, setDraftSeriesColors] = useState<Record<string, string>>({});
    const [draftCategoryColors, setDraftCategoryColors] = useState<Record<string, string>>({});
    const [draftNumberFormat, setDraftNumberFormat] = useState<ChartOptions["numberFormat"]>();
    const [draftValueFormat, setDraftValueFormat] = useState<ChartOptions["valueFormat"]>();
    const [draftOrientation, setDraftOrientation] = useState<NonNullable<ChartOptions["orientation"]>>(chartOptions?.orientation ?? "vertical");
    const [draftReset, setDraftReset] = useState(false);
    const [savingColors, setSavingColors] = useState(false);
    const sourceData = useMemo(() => mapChartData(response?.data ?? [], xField, yField), [response, xField, yField]);
    const data = useMemo(() => applyChartTopN(sourceData, chartOptions), [sourceData, chartOptions]);
    const pieLabelVisibility = useMemo<PieLabelVisibility>(
        () => outerRadius => getCachedPieLabelVisibility(data, outerRadius),
        [data]
    );
    const hasNumericData = data.some(item => item.value !== null);
    const savedChartType = colorConfiguration?.chartType ?? chartType;
    const renderedChartType: ChartType = savedChartType === "pie"
        && chartOptions?.appearance === "donut"
        && colorConfiguration?.customized !== true
        ? "doughnut"
        : savedChartType;
    const renderedCapability = getChartCapability(renderedChartType);
    const effectiveChartOptions = {
        ...chartOptions,
        numberFormat: colorConfiguration?.numberFormat ?? chartOptions?.numberFormat,
        valueFormat: colorConfiguration?.valueFormat ?? chartOptions?.valueFormat,
        orientation: colorConfiguration?.orientation ?? chartOptions?.orientation ?? "vertical",
    };
    const renderingIncompatibility = renderedCapability.incompatibility(data);
    const proportionalChart = renderedCapability.tooltipMode === "proportional";
    const pieHasNegative = proportionalChart && data.some(item => (item.value ?? 0) < 0);
    const pieHasPositive = data.some(item => (item.value ?? 0) > 0);
    const legend = chartOptions?.showLegend ?? showLegend;
    const labels = chartOptions?.showLabels ?? chartOptions?.showDataLabels ?? showLabels ?? proportionalChart;
    const grid = chartOptions?.showGrid ?? showGrid;
    const horizontalBars = renderedChartType === "bar" && effectiveChartOptions.orientation === "horizontal";
    const chartContentHeight = horizontalBars ? getHorizontalBarChartHeight(data.length) : undefined;
    const categoryAxisWidth = horizontalBars ? getHorizontalCategoryAxisWidth(data) : 110;
    const valueAxisWidth = Math.min(104, Math.max(58, ...data.map(item => formatChartNumber(item.value, effectiveChartOptions).length * 7 + 12)));
    const categoryTick = (value: unknown) => {
        const label = String(value ?? "");
        return label.length > 18 ? `${label.slice(0, 17)}…` : label;
    };
    const filename = exportConfig?.filename?.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";
    const sourceRows = useMemo(() => sourceData.map(item => ({ [xField]: item.name, [yField]: item.value })), [sourceData, xField, yField]);
    const configuredSeriesColors = colorConfiguration?.seriesColors ?? chartOptions?.seriesColors ?? {};
    const configuredCategoryColors = colorConfiguration?.categoryColors ?? chartOptions?.categoryColors ?? {};
    const configuredColors = renderedCapability.colorMode === "category" ? configuredCategoryColors : configuredSeriesColors;
    const activeColors = configuredColors;
    const colorEntries = useMemo(() => {
        if (getChartCapability(draftChartType).colorMode !== "category") return [{ key: yField, label: yField }];
        const keys = new Set([...data.map(item => item.name), ...Object.keys(draftCategoryColors)]);
        return [...keys].map(key => ({ key, label: key }));
    }, [draftChartType, draftCategoryColors, data, yField]);

    const runExport = async (format: "png" | "svg" | "csv" | "excel") => {
        if (exporting || ((format === "png" || format === "svg") && !chartRef.current)) return;
        setExporting(true);
        try {
            if (format === "png" && chartRef.current) await exportChartPNG(chartRef.current, `${filename}.png`);
            else if (format === "svg" && chartRef.current) exportChartSVG(chartRef.current, `${filename}.svg`);
            else if (format === "csv") exportRowsCSV(sourceRows, `${filename}.csv`);
            else await exportExcel(sourceRows, `${filename}.xlsx`);
        } catch (cause: unknown) {
            toast.notify("error", getRequestErrorMessage(cause, `Unable to export ${format.toUpperCase()}.`));
        } finally {
            setExporting(false);
        }
    };
    const topNActive = Boolean(chartOptions?.topN && sourceData.length > chartOptions.topN);
    const exportOptions: ExportMenuOption[] = exportConfig?.enabled
        ? exportConfig.formats.map(format => ({
            id: format,
            label: format === "csv" || format === "excel"
                ? `Download ${format === "csv" ? "CSV" : "Excel"}${topNActive ? " — complete filtered source" : ""}`
                : `Download ${format.toUpperCase()}`,
            group: format === "png" || format === "svg" ? "Chart Image" : "Chart Data",
            onSelect: () => void runExport(format),
            disabled: loading || !sourceData.length || ((format === "png" || format === "svg") && renderingIncompatibility !== null),
        }))
        : [];
    const customizationAvailable = renderedCapability.supported && canCustomizeColors && Boolean(colorConfiguration && onSaveConfiguration);
    const openColorDialog = () => {
        setDraftChartType(savedChartType);
        setDraftOrientation(colorConfiguration?.orientation ?? chartOptions?.orientation ?? "vertical");
        setDraftSeriesColors({ ...configuredSeriesColors });
        setDraftCategoryColors({ ...configuredCategoryColors });
        setDraftNumberFormat(effectiveChartOptions.numberFormat);
        setDraftValueFormat(effectiveChartOptions.valueFormat);
        setDraftReset(false);
        setColorDialogOpen(true);
    };
    const proportionalTotal = data.reduce((sum, item) => sum + Math.max(0, item.value ?? 0), 0);
    const trendRecommendation = (renderedChartType === "line" || renderedChartType === "area")
        && !isLikelyOrderedChartDimension(data);
    const tooltip = showTooltip && <Tooltip
        formatter={value => formatTooltipPresentation(value, effectiveChartOptions, proportionalChart ? proportionalTotal : 0)}
        labelFormatter={label => String(label ?? "")}
        allowEscapeViewBox={{ x: false, y: false }}
        contentStyle={{ border: `1px solid ${GRID_COLOR}`, borderRadius: 8, boxShadow: "0 8px 24px rgb(15 23 42 / 12%)" }}
    />;
    const customizationFooter = colorConfiguration && onSaveConfiguration ? <footer className="chart-color-dialog__actions">
        <button type="button" className="app-button" disabled={savingColors} onClick={() => {
            setDraftChartType(colorConfiguration.authoredChartType ?? chartType);
            setDraftOrientation(colorConfiguration.authoredOrientation ?? chartOptions?.orientation ?? "vertical");
            setDraftSeriesColors({ ...(colorConfiguration.authoredSeriesColors ?? {}) });
            setDraftCategoryColors({ ...(colorConfiguration.authoredCategoryColors ?? {}) });
            setDraftNumberFormat(colorConfiguration.authoredNumberFormat ?? chartOptions?.numberFormat);
            setDraftValueFormat(colorConfiguration.authoredValueFormat ?? chartOptions?.valueFormat);
            setDraftReset(true);
            toast.notify("info", "Authored chart defaults selected. Save changes to apply them.");
        }}>Reset to Default</button>
        <button type="button" className="app-button" disabled={savingColors} onClick={() => setColorDialogOpen(false)}>Cancel</button>
        <button
            type="button"
            className="app-button app-button--primary"
            disabled={savingColors}
            onClick={() => {
                setSavingColors(true);
                void onSaveConfiguration(draftReset ? null : {
                    chartType: draftChartType,
                    ...(draftChartType === "bar" ? { orientation: draftOrientation } : {}),
                    seriesColors: draftSeriesColors,
                    categoryColors: draftCategoryColors,
                    ...(draftNumberFormat ? { numberFormat: draftNumberFormat } : {}),
                    ...(draftValueFormat ? { valueFormat: draftValueFormat } : {}),
                }, colorConfiguration.revision)
                    .then(() => {
                        toast.notify("success", draftReset
                            ? "Chart customization reset to authored defaults."
                            : "Chart customization saved successfully.");
                        setColorDialogOpen(false);
                    })
                    .catch(error => toast.notify("error", getRequestErrorMessage(error, "Unable to save chart configuration.")))
                    .finally(() => setSavingColors(false));
            }}
        >{savingColors ? "Saving…" : "Save Changes"}</button>
    </footer> : null;

    return (
        <DashboardWidgetFrame
            title={title}
            description={description}
            busy={loading}
            refreshing={loading && sourceData.length > 0}
            actions={<>
                {widgetFilterControls.button}
                {customizationAvailable && <button type="button" className="app-button chart-customize-action" onClick={openColorDialog} disabled={savingColors}>Customize</button>}
                <ExportMenu options={exportOptions} disabled={loading || !sourceData.length} busy={exporting} triggerLabel="Export" busyLabel="Exporting…" menuLabel={`${title} export options`} />
            </>}
            filterPanel={widgetFilterControls.panel}
        >
            {loading && sourceData.length === 0 && <Skeleton kind="chart" chartType={renderedChartType} label="Loading chart…" />}
            {!loading && error && sourceData.length === 0 && <ErrorState title="Unable to load chart" message={error} onRetry={retry} compact />}
            {!loading && error && sourceData.length > 0 && <div className="dashboard-widget-inline-error" role="alert"><span>Refresh failed.</span><button type="button" className="app-button" onClick={retry}>Retry</button></div>}
            {!loading && !error && sourceData.length === 0 && <Empty title="No chart data" message="The current filters returned no data." compact />}
            {!loading && sourceData.length > 0 && !hasNumericData && <Empty title="No numeric chart data" message={`The ${yField} values are missing or nonnumeric.`} compact />}
            {!loading && sourceData.length > 0 && !renderedCapability.supported && <Empty title="Legacy Funnel chart is unsupported" message="The source data and field mappings are preserved. Choose a supported chart type in the dashboard configuration; the persisted Funnel definition was not rewritten." compact />}
            {!loading && trendRecommendation && <p className="dashboard-chart-recommendation" role="note">These categories do not appear to be chronological or numeric. A bar chart may communicate the comparison more clearly; source order has been preserved.</p>}
            {!loading && renderedCapability.supported && pieHasNegative && <Empty title={`${renderedCapability.label} cannot display negative values`} message="Use a bar, line, or area chart for signed values. CSV and Excel exports preserve the raw signed data." compact />}
            {!loading && renderedCapability.supported && proportionalChart && hasNumericData && !pieHasNegative && !pieHasPositive && <Empty title={`No positive ${renderedCapability.label.toLowerCase()} values`} message="All displayed values are zero, so no proportional marks can be drawn." compact />}
            {!loading && !proportionalChart && sourceData.length > 0 && hasNumericData && renderingIncompatibility && <Empty title={`${renderedCapability.label} is unavailable`} message={renderingIncompatibility} compact />}
            {sourceData.length > 0 && renderingIncompatibility === null && (
                <div className={`dashboard-widget-content__chart dashboard-widget-content__chart--${renderedChartType}${horizontalBars ? " dashboard-widget-content__chart--scrollable" : ""}`} role="img" aria-label={`${title} ${renderedChartType} chart`}>
                    <div ref={chartRef} className="dashboard-widget-content__chart-canvas" style={chartContentHeight ? { height: chartContentHeight } : undefined}>
                    <ResponsiveContainer width="100%" height="100%">
                        {renderedChartType === "line" ? (
                            <LineChart data={data} margin={{ top: 12, right: 18, bottom: 12, left: 4 }}>
                                {grid && <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />}
                                <XAxis dataKey="name" stroke={AXIS_COLOR} tickLine={false} axisLine={false} minTickGap={18} padding={{ left: 14, right: 14 }} tickFormatter={categoryTick} />
                                <YAxis stroke={AXIS_COLOR} tickLine={false} axisLine={false} domain={axisDomain} tickFormatter={value => formatChartNumber(value, effectiveChartOptions)} width={valueAxisWidth} />
                                {tooltip}{legend && <Legend wrapperStyle={{ paddingTop: 10 }} />}
                                <Line type={chartOptions?.smooth ? "monotone" : "linear"} dataKey="value" name={yField} stroke={activeColors[yField] ?? CHART_COLORS[0]} strokeWidth={2.5} dot={chartOptions?.showPoints !== false ? { r: 3 } : false} activeDot={{ r: 5 }} connectNulls={false} label={labels} isAnimationActive={false} />
                            </LineChart>
                        ) : renderedChartType === "area" ? (
                            <AreaChart data={data} margin={{ top: 12, right: 18, bottom: 12, left: 4 }}>
                                {grid && <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />}
                                <XAxis dataKey="name" stroke={AXIS_COLOR} tickLine={false} axisLine={false} minTickGap={18} padding={{ left: 14, right: 14 }} tickFormatter={categoryTick} />
                                <YAxis stroke={AXIS_COLOR} tickLine={false} axisLine={false} domain={axisDomain} tickFormatter={value => formatChartNumber(value, effectiveChartOptions)} width={valueAxisWidth} />
                                {tooltip}{legend && <Legend wrapperStyle={{ paddingTop: 10 }} />}
                                <Area type={chartOptions?.smooth ? "monotone" : "linear"} dataKey="value" name={yField} stroke={activeColors[yField] ?? CHART_COLORS[0]} fill={activeColors[yField] ?? CHART_COLORS[0]} fillOpacity={0.22} strokeWidth={2.5} connectNulls={false} label={labels} isAnimationActive={false} />
                            </AreaChart>
                        ) : renderedChartType === "pie" || renderedChartType === "doughnut" ? (
                            <PieChart margin={{ top: 4, right: 8, bottom: legend ? 24 : 4, left: 8 }}>
                                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy={legend ? "43%" : "50%"} outerRadius={labels ? "70%" : "82%"} innerRadius={renderedChartType === "doughnut" ? "52%" : 0} paddingAngle={renderedChartType === "doughnut" ? 2 : 1} label={labels ? props => renderPieLabel(props, pieLabelVisibility, effectiveChartOptions) : false} labelLine={labels ? props => renderPieLabelLine(props, pieLabelVisibility) : false} isAnimationActive={false}>
                                    {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={activeColors[entry.name] ?? CHART_COLORS[index % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />)}
                                    {renderedChartType === "doughnut" && chartOptions?.showCenterTotal && <>
                                        <Label value={formatChartNumber(data.reduce((sum, item) => sum + (item.value ?? 0), 0), effectiveChartOptions)} position="center" dy={-5} className="dashboard-chart-center-total" />
                                        <Label value="Total" position="center" dy={15} className="dashboard-chart-center-caption" />
                                    </>}
                                </Pie>
                                {tooltip}{legend && <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 10 }} formatter={value => <span title={String(value)}>{String(value)}</span>} />}
                            </PieChart>
                        ) : renderedChartType === "treemap" ? (
                            <Treemap data={data} dataKey="value" nameKey="name" isAnimationActive={false}>
                                {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={activeColors[entry.name] ?? CHART_COLORS[index % CHART_COLORS.length]} />)}
                                {tooltip}
                            </Treemap>
                        ) : renderedChartType === "radial-bar" ? (
                            <RadialBarChart data={data} innerRadius="20%" outerRadius="90%" startAngle={90} endAngle={-270}>
                                <RadialBar dataKey="value" name={yField} background label={labels ? { position: "insideStart", fill: "#fff" } : false} isAnimationActive={false}>
                                    {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={activeColors[entry.name] ?? CHART_COLORS[index % CHART_COLORS.length]} />)}
                                </RadialBar>
                                {tooltip}{legend && <Legend />}
                            </RadialBarChart>
                        ) : effectiveChartOptions.orientation === "horizontal" ? (
                            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 12, left: 8 }}>
                                {grid && <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" horizontal={false} />}
                                <XAxis type="number" stroke={AXIS_COLOR} tickLine={false} axisLine={false} domain={axisDomain} tickFormatter={value => formatChartNumber(value, effectiveChartOptions)} minTickGap={18} />
                                <YAxis type="category" dataKey="name" width={categoryAxisWidth} stroke={AXIS_COLOR} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
                                {tooltip}{legend && <Legend />}
                                <Bar dataKey="value" name={yField} fill={activeColors[yField] ?? CHART_COLORS[0]} radius={[0, 4, 4, 0]} label={labels ? { formatter: (value: unknown) => formatChartNumber(value, effectiveChartOptions), position: "right" } : false} isAnimationActive={false} />
                            </BarChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 12, right: 18, bottom: 12, left: 4 }}>
                                {grid && <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />}
                                <XAxis dataKey="name" stroke={AXIS_COLOR} tickLine={false} axisLine={false} minTickGap={16} padding={{ left: 12, right: 12 }} tickFormatter={categoryTick} />
                                <YAxis stroke={AXIS_COLOR} tickLine={false} axisLine={false} domain={axisDomain} tickFormatter={value => formatChartNumber(value, effectiveChartOptions)} width={valueAxisWidth} />
                                {tooltip}{legend && <Legend />}
                                <Bar dataKey="value" name={yField} fill={activeColors[yField] ?? CHART_COLORS[0]} radius={[4, 4, 0, 0]} label={labels ? { formatter: (value: unknown) => formatChartNumber(value, effectiveChartOptions), position: "top" } : false} isAnimationActive={false} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                    </div>
                </div>
            )}
            {colorDialogOpen && colorConfiguration && onSaveConfiguration && (
                <AccessibleDialog title="Customize Chart" className="chart-color-dialog" onClose={() => setColorDialogOpen(false)} footer={customizationFooter}>
                    <fieldset className="chart-color-dialog__types">
                        <legend>Chart Type</legend>
                        <div className="chart-color-dialog__type-groups">
                            {[...new Set(CHART_CAPABILITIES.map(capability => capability.category))].map(category => <section key={category} aria-label={`${category} charts`}>
                                <h3>{category}</h3>
                                <div>{chartSelectionsForCategory(category).map(({ capability, label, orientation }) => {
                                const reason = capability.incompatibility(data);
                                const selected = draftChartType === capability.type && (capability.type !== "bar" || draftOrientation === orientation);
                                return <button
                                    key={`${capability.type}-${orientation ?? "default"}`}
                                    type="button"
                                    className={`app-button${selected ? " app-button--primary" : ""}`}
                                    aria-pressed={selected}
                                    disabled={savingColors || reason !== null}
                                    title={reason ?? `Preview ${label} chart`}
                                    onClick={() => { setDraftChartType(capability.type); if (orientation) setDraftOrientation(orientation); setDraftReset(false); }}
                                >{label}</button>;
                                })}</div>
                            </section>)}
                        </div>
                        {getChartCapability(draftChartType).incompatibility(data) && <p role="note">{getChartCapability(draftChartType).incompatibility(data)}</p>}
                    </fieldset>
                    <ChartCustomizationPreview type={draftChartType} data={data} yField={yField} seriesColors={draftSeriesColors} categoryColors={draftCategoryColors} options={{ ...effectiveChartOptions, orientation: draftOrientation, numberFormat: draftNumberFormat, valueFormat: draftValueFormat, showLegend: legend, showLabels: labels }} />
                    <section className="chart-color-dialog__presentation" aria-labelledby="chart-presentation-title">
                        <h3 id="chart-presentation-title">Number Presentation</h3>
                        <div>
                            <label><span>Axis and label notation</span><select value={draftNumberFormat ?? ""} onChange={event => { setDraftNumberFormat((event.target.value || undefined) as ChartOptions["numberFormat"]); setDraftReset(false); }} disabled={savingColors}>
                                <option value="">Framework default — compact Indian</option>
                                <option value="compact-indian">Compact Indian (L / Cr)</option>
                                <option value="full">Full Indian grouping</option>
                                <option value="compact">International compact</option>
                            </select></label>
                            <label><span>Value style</span><select value={draftValueFormat ?? ""} onChange={event => { setDraftValueFormat((event.target.value || undefined) as ChartOptions["valueFormat"]); setDraftReset(false); }} disabled={savingColors}>
                                <option value="">Number</option>
                                <option value="decimal">Decimal</option>
                                <option value="currency">INR currency</option>
                            </select></label>
                        </div>
                    </section>
                    <h3 className="chart-color-dialog__section-title">Chart Colors</h3>
                    <div className="chart-color-dialog__fields">
                        {colorEntries.map(({ key, label }, index) => (
                            <label key={key}>
                                <span title={label}>{label}</span>
                                <input
                                    type="color"
                                    aria-label={`${label} color`}
                                    value={(getChartCapability(draftChartType).colorMode === "category" ? draftCategoryColors[key] : draftSeriesColors[key]) ?? CHART_COLORS[index % CHART_COLORS.length]}
                                    onChange={event => {
                                        const color = event.target.value.toUpperCase();
                                        if (getChartCapability(draftChartType).colorMode === "category") setDraftCategoryColors(previous => ({ ...previous, [key]: color }));
                                        else setDraftSeriesColors(previous => ({ ...previous, [key]: color }));
                                        setDraftReset(false);
                                    }}
                                    disabled={savingColors}
                                />
                            </label>
                        ))}
                    </div>
                </AccessibleDialog>
            )}
        </DashboardWidgetFrame>
    );
}
