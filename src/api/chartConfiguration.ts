import { apiClient } from "./client";

export interface ChartColorConfiguration {
    dashboardId: string;
    widgetId: string;
    chartType: "bar" | "line" | "pie";
    revision: string;
    seriesColors: Record<string, string>;
    categoryColors: Record<string, string>;
}

export async function getDashboardChartColors(dashboardId: string) {
    const response = await apiClient({ action: "configuration.chartColors.get", dashboardId });
    return response.data as unknown as ChartColorConfiguration[];
}

export async function updateDashboardChartColors(
    dashboardId: string,
    widgetId: string,
    colors: Record<string, string>,
    expectedRevision: string,
) {
    const response = await apiClient({
        action: "configuration.chartColors.update",
        dashboardId,
        widgetId,
        colors,
        expectedRevision,
    });
    return response.data[0] as unknown as ChartColorConfiguration;
}
