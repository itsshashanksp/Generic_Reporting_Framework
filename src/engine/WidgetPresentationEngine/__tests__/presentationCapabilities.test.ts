import { describe, expect, it } from "vitest";

import type { DashboardWidget } from "../../../types/widget";
import {
    getInitialPresentationView,
    getWidgetPresentationAvailability,
    resolveChartPresentation,
} from "..";

const baseTable: DashboardWidget = {
    id: "orders",
    type: "table",
    title: "Orders",
    request: { action: "select", source: { table: "Orders" }, fields: ["Category", "Value"] },
    columns: [
        { field: "Category", header: "Category", dataType: "text" },
        { field: "Value", header: "Value", dataType: "currency" },
    ],
};

describe("widget presentation capabilities", () => {
    it("allows category/numeric table and chart views only with an explicit complete chart source", () => {
        const widget: DashboardWidget = {
            ...baseTable,
            presentation: {
                defaultView: "table",
                allowedViews: ["table", "column", "bar", "pie", "doughnut"],
                chart: {
                    request: { action: "select", source: { table: "Summary" }, fields: ["Category", "Value"] },
                    columns: baseTable.columns,
                    xField: "Category",
                    yField: "Value",
                },
            },
        };
        expect(getWidgetPresentationAvailability(widget).every(option => option.available)).toBe(true);
        expect(resolveChartPresentation(widget, "column")).toMatchObject({ chartType: "bar", orientation: "vertical" });
        expect(resolveChartPresentation(widget, "bar")).toMatchObject({ chartType: "bar", orientation: "horizontal" });
    });

    it("does not silently chart a server-paged table source", () => {
        const widget: DashboardWidget = {
            ...baseTable,
            presentation: {
                defaultView: "table",
                allowedViews: ["table", "pie"],
                chart: { columns: baseTable.columns, xField: "Category", yField: "Value" },
            },
        };
        expect(getWidgetPresentationAvailability(widget).find(option => option.view === "pie")).toMatchObject({
            available: false,
            reason: expect.stringContaining("explicit complete or aggregated"),
        });
    });

    it("rejects text measures, missing fields, and unordered trend categories", () => {
        const variants = [
            { columns: [{ field: "Category", header: "Category", dataType: "text" as const }, { field: "Value", header: "Value", dataType: "text" as const }], view: "pie" as const },
            { columns: baseTable.columns, view: "line" as const },
            { columns: baseTable.columns, view: "pie" as const, yField: "Missing" },
        ];
        for (const variant of variants) {
            const widget: DashboardWidget = {
                ...baseTable,
                presentation: {
                    defaultView: "table",
                    allowedViews: ["table", variant.view],
                    chart: {
                        request: { action: "select", source: { table: "Summary" }, fields: ["Category", "Value"] },
                        columns: variant.columns,
                        xField: "Category",
                        yField: variant.yField ?? "Value",
                    },
                },
            };
            expect(getWidgetPresentationAvailability(widget)[1].available).toBe(false);
        }
    });

    it("supports ordered date trends and preserves legacy widgets without controls", () => {
        const widget: DashboardWidget = {
            ...baseTable,
            presentation: {
                defaultView: "line",
                allowedViews: ["table", "line", "area"],
                chart: {
                    request: { action: "select", source: { table: "Summary" }, fields: ["Date", "Value"] },
                    columns: [{ field: "Date", header: "Date", dataType: "date" }, { field: "Value", header: "Value", dataType: "number" }],
                    xField: "Date",
                    yField: "Value",
                },
            },
        };
        expect(getInitialPresentationView(widget)).toBe("line");
        expect(getWidgetPresentationAvailability(widget).every(option => option.available)).toBe(true);
        expect(getWidgetPresentationAvailability(baseTable)).toEqual([]);
    });
});
