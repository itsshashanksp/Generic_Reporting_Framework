import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClientMock } = vi.hoisted(() => ({ apiClientMock: vi.fn() }));
vi.mock("../client", () => ({ apiClient: apiClientMock }));

import { getDashboardChartColors, updateDashboardChartColors } from "../chartConfiguration";

const record = {
    dashboardId: "sales-dashboard",
    widgetId: "monthly-sales",
    chartType: "bar" as const,
    revision: "a".repeat(64),
    seriesColors: { Sales: "#2563EB" },
    categoryColors: {},
};

describe("chart configuration API", () => {
    beforeEach(() => apiClientMock.mockReset());

    it("loads colors by stable dashboard and widget IDs", async () => {
        apiClientMock.mockResolvedValue({ data: [record] });
        await expect(getDashboardChartColors("sales-dashboard")).resolves.toEqual([record]);
        expect(apiClientMock).toHaveBeenCalledWith({ action: "configuration.chartColors.get", dashboardId: "sales-dashboard" });
    });

    it("saves only colors with the expected configuration revision", async () => {
        apiClientMock.mockResolvedValue({ data: [record] });
        await expect(updateDashboardChartColors("sales-dashboard", "monthly-sales", { Sales: "#2563EB" }, record.revision)).resolves.toEqual(record);
        expect(apiClientMock).toHaveBeenCalledWith({
            action: "configuration.chartColors.update",
            dashboardId: "sales-dashboard",
            widgetId: "monthly-sales",
            colors: { Sales: "#2563EB" },
            expectedRevision: record.revision,
        });
    });
});
