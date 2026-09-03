import { useMemo } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type { FilterDefinition } from "../../types/filter";
import type { WidgetRequest } from "../../types/widget";
import Empty from "../Common/Empty";
import ErrorState from "../Common/Error";
import Loading from "../Common/Loading";
import DashboardWidgetFrame from "./DashboardWidgetFrame";
import { useDashboardWidgetRequest } from "./useDashboardWidgetRequest";

const EMPTY_FILTER_DEFINITIONS: FilterDefinition[] = [];
const CHART_COLORS = ["#2563eb", "#0d9488", "#7c3aed", "#ea580c", "#db2777"];

interface ChartWidgetProps {
    title: string;
    description?: string;
    request: WidgetRequest;
    xField: string;
    yField: string;
    chartType?: "bar" | "line" | "pie";
    showLegend?: boolean;
    showTooltip?: boolean;
    showGrid?: boolean;
    showLabels?: boolean;
    filterDefinitions?: FilterDefinition[];
    cacheScope?: string;
}

export default function ChartWidget({
    title,
    description,
    request,
    xField,
    yField,
    chartType = "bar",
    showLegend = false,
    showTooltip = true,
    showGrid = true,
    showLabels = false,
    filterDefinitions = EMPTY_FILTER_DEFINITIONS,
    cacheScope,
}: ChartWidgetProps) {
    const { response, loading, error, retry } = useDashboardWidgetRequest(
        request,
        filterDefinitions,
        cacheScope
    );
    const data = useMemo(
        () => response?.data?.map(row => {
            const numericValue = Number(row[yField] ?? 0);

            return {
                name: String(row[xField] ?? ""),
                value: Number.isFinite(numericValue) ? numericValue : 0,
            };
        }) ?? [],
        [response, xField, yField]
    );

    return (
        <DashboardWidgetFrame
            title={title}
            description={description}
            refreshing={loading && data.length > 0}
        >
            {loading && data.length === 0 && <Loading label="Loading chart…" compact />}
            {!loading && error && data.length === 0 && (
                <ErrorState title="Unable to load chart" message={error} onRetry={retry} compact />
            )}
            {!loading && error && data.length > 0 && (
                <div className="dashboard-widget-inline-error" role="alert">
                    <span>Refresh failed.</span>
                    <button type="button" className="app-button" onClick={retry}>Retry</button>
                </div>
            )}
            {!loading && !error && data.length === 0 && (
                <Empty title="No chart data" message="The current filters returned no data." compact />
            )}
            {data.length > 0 && (
                <div className="dashboard-widget-content__chart">
                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === "line" ? (
                            <LineChart data={data}>
                                {showGrid && <CartesianGrid strokeDasharray="3 3" />}
                                <XAxis dataKey="name" />
                                <YAxis />
                                {showTooltip && <Tooltip />}
                                {showLegend && <Legend />}
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke={CHART_COLORS[0]}
                                    strokeWidth={2}
                                    label={showLabels}
                                />
                            </LineChart>
                        ) : chartType === "pie" ? (
                            <PieChart>
                                <Pie
                                    data={data}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius="70%"
                                    label={showLabels}
                                >
                                    {data.map((entry, index) => (
                                        <Cell
                                            key={`${entry.name}-${index}`}
                                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                {showTooltip && <Tooltip />}
                                {showLegend && <Legend />}
                            </PieChart>
                        ) : (
                            <BarChart data={data}>
                                {showGrid && <CartesianGrid strokeDasharray="3 3" />}
                                <XAxis dataKey="name" />
                                <YAxis />
                                {showTooltip && <Tooltip />}
                                {showLegend && <Legend />}
                                <Bar dataKey="value" fill={CHART_COLORS[0]} label={showLabels} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            )}
        </DashboardWidgetFrame>
    );
}
