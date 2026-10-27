import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getRequestErrorMessage } from "../../api/request";
import { exportChartPNG, exportChartSVG, exportExcel, exportRowsCSV } from "../../engine/ExportEngine";
import type { WidgetFilterFields } from "../../engine/DashboardEngine/filterFields";
import type { ExportConfig } from "../../types/export";
import type { FilterDefinition } from "../../types/filter";
import type { ChartOptions, WidgetRequest } from "../../types/widget";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import ExportMenu, { type ExportMenuOption } from "../Common/ExportMenu";
import Loading from "../Common/Loading";
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

function isVisiblePieLabel(props: PieLabelProps, data: ChartDatum[]) {
    return typeof props.index === "number"
        && getVisiblePieLabelIndexes(data, Number(props.outerRadius) || 0).has(props.index);
}

function renderPieLabel(props: PieLabelProps, data: ChartDatum[]) {
    if (!isVisiblePieLabel(props, data)) return null;
    const cx = Number(props.cx) || 0;
    const cy = Number(props.cy) || 0;
    const radius = (Number(props.outerRadius) || 0) + 16;
    const radians = -(Number(props.midAngle) || 0) * Math.PI / 180;
    const x = cx + Math.cos(radians) * radius;
    const y = cy + Math.sin(radians) * radius;
    return <text x={x} y={y} dy="0.35em" textAnchor={x >= cx ? "start" : "end"} className="dashboard-chart-external-label">{formatChartNumber(props.value)}</text>;
}

function renderPieLabelLine(props: PieLabelProps, data: ChartDatum[]) {
    if (!isVisiblePieLabel(props, data) || !props.points?.length) return <g />;
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
}: ChartWidgetProps & { widgetFilterControls: WidgetFilterControls }) {
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        request, filterDefinitions, cacheScope, filterFields, runtimeFilters, widgetFilterControls.appliedValues
    );
    const chartRef = useRef<HTMLDivElement>(null);
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState("");
    const sourceData = useMemo(() => mapChartData(response?.data ?? [], xField, yField), [response, xField, yField]);
    const data = useMemo(() => applyChartTopN(sourceData, chartOptions), [sourceData, chartOptions]);
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

    const runExport = async (format: "png" | "svg" | "csv" | "excel") => {
        if (exporting || !chartRef.current) return;
        setExporting(true);
        setExportError("");
        try {
            if (format === "png") await exportChartPNG(chartRef.current, `${filename}.png`);
            else if (format === "svg") exportChartSVG(chartRef.current, `${filename}.svg`);
            else if (format === "csv") exportRowsCSV(sourceRows, `${filename}.csv`);
            else await exportExcel(sourceRows, `${filename}.xlsx`);
        } catch (cause: unknown) {
            setExportError(getRequestErrorMessage(cause, `Unable to export ${format.toUpperCase()}.`));
        } finally {
            setExporting(false);
        }
    };
    const topNActive = Boolean(chartOptions?.topN && sourceData.length > chartOptions.topN);
    const exportOptions: ExportMenuOption[] = exportConfig?.enabled
        ? exportConfig.formats.map(format => ({
            id: format,
            label: format === "csv" || format === "excel"
                ? `${topNActive ? "Complete filtered source" : "Chart data"} — ${format === "csv" ? "CSV" : "Excel"}`
                : `Displayed chart — ${format.toUpperCase()}`,
            onSelect: () => void runExport(format),
            disabled: loading || !sourceData.length || ((format === "png" || format === "svg") && (pieHasNegative || !hasNumericData)),
        }))
        : [];
    const tooltip = showTooltip && <Tooltip formatter={value => formatChartTooltipValue(value)} contentStyle={{ border: `1px solid ${GRID_COLOR}`, borderRadius: 8, boxShadow: "0 8px 24px rgb(15 23 42 / 12%)" }} />;

    return (
        <DashboardWidgetFrame
            title={title}
            description={description}
            refreshing={loading && sourceData.length > 0}
            actions={<>{widgetFilterControls.button}<ExportMenu options={exportOptions} disabled={loading || !sourceData.length} busy={exporting} menuLabel={`${title} export options`} /></>}
            filterPanel={widgetFilterControls.panel}
        >
            {loading && sourceData.length === 0 && <Loading label="Loading chart…" compact />}
            {!loading && error && sourceData.length === 0 && <ErrorState title="Unable to load chart" message={error} onRetry={retry} compact />}
            {!loading && error && sourceData.length > 0 && <div className="dashboard-widget-inline-error" role="alert"><span>Refresh failed.</span><button type="button" className="app-button" onClick={retry}>Retry</button></div>}
            {exportError && <div className="dashboard-widget-inline-error" role="alert"><span>{exportError}</span><button type="button" className="app-button" onClick={() => setExportError("")}>Dismiss</button></div>}
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
                                <Line type={chartOptions?.smooth ? "monotone" : "linear"} dataKey="value" name={yField} stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={chartOptions?.showPoints !== false ? { r: 3 } : false} activeDot={{ r: 5 }} connectNulls={false} label={labels} />
                            </LineChart>
                        ) : chartType === "pie" ? (
                            <PieChart margin={{ top: 4, right: 8, bottom: legend ? 24 : 4, left: 8 }}>
                                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy={legend ? "43%" : "50%"} outerRadius={labels ? "70%" : "80%"} innerRadius={chartOptions?.appearance === "donut" ? "50%" : 0} paddingAngle={chartOptions?.appearance === "donut" ? 2 : 0} label={labels ? props => renderPieLabel(props, data) : false} labelLine={labels ? props => renderPieLabelLine(props, data) : false}>
                                    {data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="#fff" strokeWidth={2} />)}
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
                                <Bar dataKey="value" name={yField} fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} label={labels ? { formatter: formatChartNumber, position: "right" } : false} />
                            </BarChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 12, right: 18, bottom: 12, left: 4 }}>
                                {grid && <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />}
                                <XAxis dataKey="name" stroke={AXIS_COLOR} tickLine={false} axisLine={false} minTickGap={16} />
                                <YAxis stroke={AXIS_COLOR} tickLine={false} axisLine={false} domain={axisDomain} tickFormatter={formatChartNumber} width={58} />
                                {tooltip}{legend && <Legend />}
                                <Bar dataKey="value" name={yField} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} label={labels ? { formatter: formatChartNumber, position: "top" } : false} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                    </div>
                </div>
            )}
        </DashboardWidgetFrame>
    );
}
