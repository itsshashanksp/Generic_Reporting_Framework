import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getRequestErrorMessage } from "../../api/request";
import type { ChartColorConfiguration } from "../../api/chartConfiguration";
import { exportChartPNG, exportChartSVG, exportExcel, exportRowsCSV } from "../../engine/ExportEngine";
import type { WidgetFilterFields } from "../../engine/DashboardEngine/filterFields";
import type { ExportConfig } from "../../types/export";
import type { FilterDefinition } from "../../types/filter";
import type { ChartOptions, WidgetRequest } from "../../types/widget";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import ExportMenu, { type ExportMenuOption } from "../Common/ExportMenu";
import Skeleton from "../Common/Skeleton";
import AccessibleDialog from "../Common/AccessibleDialog";
import { useToast } from "../Notifications/ToastProvider";
import DashboardWidgetFrame from "./DashboardWidgetFrame";
import WidgetFilterController, { type WidgetFilterControls } from "./WidgetFilterController";
import { applyChartTopN, formatChartNumber, formatChartTooltipValue, getHorizontalBarChartHeight, getHorizontalCategoryAxisWidth, getVisiblePieLabelIndexes, mapChartData, type ChartDatum } from "./chartData";
import { useDashboardWidgetRequest } from "./useDashboardWidgetRequest";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];
const CHART_COLORS = ["#3274d9", "#2f9e8f", "#8b5cf6", "#e07a32", "#d94f8a", "#5b8def", "#73a857", "#c49a32"];
const AXIS_COLOR = "#64748b";
const GRID_COLOR = "#e2e8f0";
const axisDomain = [
    (value: number) => Math.min(0, value),
    (value: number) => Math.max(0, value),
] as const;

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

function renderPieLabel(props: PieLabelProps, getVisibility: PieLabelVisibility) {
    if (!isVisiblePieLabel(props, getVisibility)) return null;
    const cx = Number(props.cx) || 0;
    const cy = Number(props.cy) || 0;
    const radius = (Number(props.outerRadius) || 0) + 16;
    const radians = -(Number(props.midAngle) || 0) * Math.PI / 180;
    const x = cx + Math.cos(radians) * radius;
    const y = cy + Math.sin(radians) * radius;
    return <text x={x} y={y} dy="0.35em" textAnchor={x >= cx ? "start" : "end"} className="dashboard-chart-external-label">{formatChartNumber(props.value)}</text>;
}

function renderPieLabelLine(props: PieLabelProps, getVisibility: PieLabelVisibility) {
    if (!isVisiblePieLabel(props, getVisibility) || !props.points?.length) return <g />;
    return <polyline points={props.points.map(point => `${point.x},${point.y}`).join(" ")} className="dashboard-chart-label-line" />;
}

interface ChartWidgetProps {
    title: string;
    description?: string;
    request: WidgetRequest;
    xField: string;
    yField: string;
    chartType?: "bar" | "line" | "pie";
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
    onSaveColors?: (colors: Record<string, string>, revision: string) => Promise<ChartColorConfiguration>;
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
    showLegend = false, showTooltip = true, showGrid = true, showLabels = false,
    exportConfig, filterDefinitions = EMPTY_FILTER_DEFINITIONS, filterFields, cacheScope,
    runtimeFilters = EMPTY_FILTER_DEFINITIONS, widgetFilterControls,
    colorConfiguration, canCustomizeColors = false, onSaveColors,
}: ChartWidgetProps & { widgetFilterControls: WidgetFilterControls }) {
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        request, filterDefinitions, cacheScope, filterFields, runtimeFilters, widgetFilterControls.appliedValues
    );
    const chartRef = useRef<HTMLDivElement>(null);
    const toast = useToast();
    const [exporting, setExporting] = useState(false);
    const [colorDialogOpen, setColorDialogOpen] = useState(false);
    const [draftColors, setDraftColors] = useState<Record<string, string>>({});
    const [savingColors, setSavingColors] = useState(false);
    const sourceData = useMemo(() => mapChartData(response?.data ?? [], xField, yField), [response, xField, yField]);
    const data = useMemo(() => applyChartTopN(sourceData, chartOptions), [sourceData, chartOptions]);
    const pieLabelVisibility = useMemo<PieLabelVisibility>(
        () => outerRadius => getCachedPieLabelVisibility(data, outerRadius),
        [data]
    );
    const hasNumericData = data.some(item => item.value !== null);
    const pieHasNegative = chartType === "pie" && data.some(item => (item.value ?? 0) < 0);
    const pieHasPositive = data.some(item => (item.value ?? 0) > 0);
    const legend = chartOptions?.showLegend ?? showLegend;
    const labels = chartOptions?.showLabels ?? chartOptions?.showDataLabels ?? showLabels;
    const grid = chartOptions?.showGrid ?? showGrid;
    const horizontalBars = chartType === "bar" && chartOptions?.orientation === "horizontal";
    const chartContentHeight = horizontalBars ? getHorizontalBarChartHeight(data.length) : undefined;
    const categoryAxisWidth = horizontalBars ? getHorizontalCategoryAxisWidth(data) : 110;
    const filename = exportConfig?.filename?.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "chart";
    const sourceRows = useMemo(() => sourceData.map(item => ({ [xField]: item.name, [yField]: item.value })), [sourceData, xField, yField]);
    const configuredColors = useMemo(() => chartType === "pie"
        ? colorConfiguration?.categoryColors ?? chartOptions?.categoryColors ?? {}
        : colorConfiguration?.seriesColors ?? chartOptions?.seriesColors ?? {},
    [chartType, colorConfiguration, chartOptions]);
    const activeColors = colorDialogOpen ? draftColors : configuredColors;
    const colorEntries = useMemo(() => {
        if (chartType !== "pie") return [{ key: yField, label: yField }];
        const keys = new Set([...data.map(item => item.name), ...Object.keys(configuredColors)]);
        return [...keys].map(key => ({ key, label: key }));
    }, [chartType, configuredColors, data, yField]);

    const runExport = async (format: "png" | "svg" | "csv" | "excel") => {
        if (exporting || !chartRef.current) return;
        setExporting(true);
        try {
            if (format === "png") await exportChartPNG(chartRef.current, `${filename}.png`);
            else if (format === "svg") exportChartSVG(chartRef.current, `${filename}.svg`);
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
            disabled: loading || !sourceData.length || ((format === "png" || format === "svg") && (pieHasNegative || !hasNumericData)),
        }))
        : [];
    const customizationAvailable = canCustomizeColors && Boolean(colorConfiguration && onSaveColors);
    const openColorDialog = () => {
        setDraftColors({ ...configuredColors });
        setColorDialogOpen(true);
    };
    const tooltip = showTooltip && <Tooltip formatter={value => formatChartTooltipValue(value)} contentStyle={{ border: `1px solid ${GRID_COLOR}`, borderRadius: 8, boxShadow: "0 8px 24px rgb(15 23 42 / 12%)" }} />;

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
            {loading && sourceData.length === 0 && <Skeleton kind="chart" chartType={chartType} label="Loading chart…" />}
            {!loading && error && sourceData.length === 0 && <ErrorState title="Unable to load chart" message={error} onRetry={retry} compact />}
            {!loading && error && sourceData.length > 0 && <div className="dashboard-widget-inline-error" role="alert"><span>Refresh failed.</span><button type="button" className="app-button" onClick={retry}>Retry</button></div>}
            {!loading && !error && sourceData.length === 0 && <Empty title="No chart data" message="The current filters returned no data." compact />}
            {!loading && sourceData.length > 0 && !hasNumericData && <Empty title="No numeric chart data" message={`The ${yField} values are missing or nonnumeric.`} compact />}
            {!loading && pieHasNegative && <Empty title="Pie chart cannot display negative values" message="Use a bar or line chart for signed values. CSV and Excel exports preserve the raw signed data." compact />}
            {!loading && chartType === "pie" && hasNumericData && !pieHasNegative && !pieHasPositive && <Empty title="No positive pie values" message="All displayed values are zero, so no proportional slices can be drawn." compact />}
            {sourceData.length > 0 && hasNumericData && !pieHasNegative && (chartType !== "pie" || pieHasPositive) && (
                <div className={`dashboard-widget-content__chart dashboard-widget-content__chart--${chartType}${horizontalBars ? " dashboard-widget-content__chart--scrollable" : ""}`} role="img" aria-label={`${title} ${chartType} chart`}>
                    <div ref={chartRef} className="dashboard-widget-content__chart-canvas" style={chartContentHeight ? { height: chartContentHeight } : undefined}>
                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === "line" ? (
                            <LineChart data={data} margin={{ top: 12, right: 18, bottom: 12, left: 4 }}>
                                {grid && <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />}
                                <XAxis dataKey="name" stroke={AXIS_COLOR} tickLine={false} axisLine={false} minTickGap={18} />
                                <YAxis stroke={AXIS_COLOR} tickLine={false} axisLine={false} domain={axisDomain} tickFormatter={formatChartNumber} width={58} />
                                {tooltip}{legend && <Legend wrapperStyle={{ paddingTop: 10 }} />}
                                <Line type={chartOptions?.smooth ? "monotone" : "linear"} dataKey="value" name={yField} stroke={activeColors[yField] ?? CHART_COLORS[0]} strokeWidth={2.5} dot={chartOptions?.showPoints !== false ? { r: 3 } : false} activeDot={{ r: 5 }} connectNulls={false} label={labels} isAnimationActive={false} />
                            </LineChart>
                        ) : chartType === "pie" ? (
                            <PieChart margin={{ top: 4, right: 8, bottom: legend ? 24 : 4, left: 8 }}>
                                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy={legend ? "43%" : "50%"} outerRadius={labels ? "70%" : "80%"} innerRadius={chartOptions?.appearance === "donut" ? "50%" : 0} paddingAngle={chartOptions?.appearance === "donut" ? 2 : 0} label={labels ? props => renderPieLabel(props, pieLabelVisibility) : false} labelLine={labels ? props => renderPieLabelLine(props, pieLabelVisibility) : false} isAnimationActive={false}>
                                    {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={activeColors[entry.name] ?? CHART_COLORS[index % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />)}
                                    {chartOptions?.appearance === "donut" && chartOptions.showCenterTotal && <>
                                        <Label value={formatChartNumber(data.reduce((sum, item) => sum + (item.value ?? 0), 0))} position="center" dy={-5} className="dashboard-chart-center-total" />
                                        <Label value="Total" position="center" dy={15} className="dashboard-chart-center-caption" />
                                    </>}
                                </Pie>
                                {tooltip}{legend && <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 10 }} formatter={value => <span title={String(value)}>{String(value)}</span>} />}
                            </PieChart>
                        ) : chartOptions?.orientation === "horizontal" ? (
                            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 12, left: 8 }}>
                                {grid && <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" horizontal={false} />}
                                <XAxis type="number" stroke={AXIS_COLOR} tickLine={false} axisLine={false} domain={axisDomain} tickFormatter={formatChartNumber} minTickGap={18} />
                                <YAxis type="category" dataKey="name" width={categoryAxisWidth} stroke={AXIS_COLOR} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={0} />
                                {tooltip}{legend && <Legend />}
                                <Bar dataKey="value" name={yField} fill={activeColors[yField] ?? CHART_COLORS[0]} radius={[0, 4, 4, 0]} label={labels ? { formatter: formatChartNumber, position: "right" } : false} isAnimationActive={false} />
                            </BarChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 12, right: 18, bottom: 12, left: 4 }}>
                                {grid && <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />}
                                <XAxis dataKey="name" stroke={AXIS_COLOR} tickLine={false} axisLine={false} minTickGap={16} />
                                <YAxis stroke={AXIS_COLOR} tickLine={false} axisLine={false} domain={axisDomain} tickFormatter={formatChartNumber} width={58} />
                                {tooltip}{legend && <Legend />}
                                <Bar dataKey="value" name={yField} fill={activeColors[yField] ?? CHART_COLORS[0]} radius={[4, 4, 0, 0]} label={labels ? { formatter: formatChartNumber, position: "top" } : false} isAnimationActive={false} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                    </div>
                </div>
            )}
            {colorDialogOpen && colorConfiguration && onSaveColors && (
                <AccessibleDialog title="Customize Chart Colors" className="chart-color-dialog" onClose={() => setColorDialogOpen(false)}>
                    <div className="chart-color-dialog__fields">
                        {colorEntries.map(({ key, label }, index) => (
                            <label key={key}>
                                <span title={label}>{label}</span>
                                <input
                                    type="color"
                                    aria-label={`${label} color`}
                                    value={draftColors[key] ?? CHART_COLORS[index % CHART_COLORS.length]}
                                    onChange={event => setDraftColors(previous => ({ ...previous, [key]: event.target.value.toUpperCase() }))}
                                    disabled={savingColors}
                                />
                            </label>
                        ))}
                    </div>
                    <footer className="chart-color-dialog__actions">
                        <button type="button" className="app-button" disabled={savingColors} onClick={() => {
                            setDraftColors({});
                            toast.notify("info", "Default chart colors selected. Save changes to apply them.");
                        }}>Reset to Default</button>
                        <button type="button" className="app-button" disabled={savingColors} onClick={() => setColorDialogOpen(false)}>Cancel</button>
                        <button
                            type="button"
                            className="app-button app-button--primary"
                            disabled={savingColors}
                            onClick={() => {
                                setSavingColors(true);
                                void onSaveColors(draftColors, colorConfiguration.revision)
                                    .then(() => {
                                        toast.notify("success", Object.keys(draftColors).length
                                            ? "Chart colors saved successfully."
                                            : "Chart colors reset to default.");
                                        setColorDialogOpen(false);
                                    })
                                    .catch(error => toast.notify("error", getRequestErrorMessage(error, "Unable to save chart colors.")))
                                    .finally(() => setSavingColors(false));
                            }}
                        >{savingColors ? "Saving…" : "Save Changes"}</button>
                    </footer>
                </AccessibleDialog>
            )}
        </DashboardWidgetFrame>
    );
}
