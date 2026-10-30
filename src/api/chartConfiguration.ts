import { apiClient } from "./client";
import type { ChartType } from "../types/widget";

export interface ChartColorConfiguration {
    dashboardId: string;
    widgetId: string;
    chartType: ChartType;
    authoredChartType?: ChartType;
    revision: string;
    seriesColors: Record<string, string>;
    categoryColors: Record<string, string>;
    authoredSeriesColors?: Record<string, string>;
    authoredCategoryColors?: Record<string, string>;
    numberFormat?: "full" | "compact" | "compact-indian";
    valueFormat?: "number" | "decimal" | "currency";
    authoredNumberFormat?: "full" | "compact" | "compact-indian";
    authoredValueFormat?: "number" | "decimal" | "currency";
    orientation?: "vertical" | "horizontal";
    authoredOrientation?: "vertical" | "horizontal";
    customized?: boolean;
}

export interface ChartCustomizationDraft {
    chartType: ChartType;
    seriesColors: Record<string, string>;
    categoryColors: Record<string, string>;
    numberFormat?: "full" | "compact" | "compact-indian";
    valueFormat?: "number" | "decimal" | "currency";
    orientation?: "vertical" | "horizontal";
}

export async function getDashboardChartColors(dashboardId: string) {
    const response = await apiClient({ action: "configuration.chartColors.get", dashboardId });
    return response.data as unknown as ChartColorConfiguration[];
}

export async function updateDashboardChartConfiguration(
    dashboardId: string,
    widgetId: string,
    customization: ChartCustomizationDraft | null,
    expectedRevision: string,
) {
    const response = await apiClient({
        action: "configuration.chartColors.update",
        dashboardId,
        widgetId,
        ...(customization ?? { reset: true }),
        expectedRevision,
    });
    return response.data[0] as unknown as ChartColorConfiguration;
}

/** Backward-compatible color-only client for existing callers. */
export async function updateDashboardChartColors(
    dashboardId: string,
    widgetId: string,
    colors: Record<string, string>,
    expectedRevision: string,
) {
    const response = await apiClient({ action: "configuration.chartColors.update", dashboardId, widgetId, colors, expectedRevision });
    return response.data[0] as unknown as ChartColorConfiguration;
}
