import { describe, expect, it } from "vitest";

import { validateDashboard } from "../../DashboardValidator";
import { resolveDashboardWidgetPresentationDefinition } from "..";
import type { DashboardWidget } from "../../../types/widget";

const request = { action: "select", source: { table: "Orders" }, fields: ["Category", "Value"] };
const columns = [
    { field: "Category", header: "Category", dataType: "text" },
    { field: "Value", header: "Value", dataType: "currency" },
];
const dashboard = (presentation: unknown) => ({
    id: "presentations",
    title: "Presentations",
    widgets: [{
        id: "orders",
        type: "table",
        title: "Orders",
        request,
        columns,
        presentation,
    }],
});

describe("dashboard presentation validation", () => {
    it("accepts independent table and complete chart definitions", () => {
        expect(validateDashboard(dashboard({
            allowSwitching: true,
            defaultView: "table",
            allowedViews: ["table", "column", "pie"],
            chart: {
                request: { ...request, groupBy: ["Category"] },
                columns,
                xField: "Category",
                yField: "Value",
                export: { enabled: true, formats: ["png", "svg", "csv", "excel"] },
            },
            table: {
                pagination: { pageSize: 25, pageSizeOptions: [10, 25, 50] },
                export: { enabled: true, formats: ["csv", "excel"], exportAll: true },
            },
        })).errors).toEqual([]);
    });

    it("rejects malformed, duplicate, and unsupported view policies", () => {
        const errors = validateDashboard(dashboard({
            allowSwitching: "yes",
            defaultView: "radar",
            allowedViews: ["table", "table", "radar"],
        })).errors;
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining("allowSwitching must be a boolean"),
            expect.stringContaining("defaultView must be table"),
            expect.stringContaining("allowedViews must not contain duplicates"),
        ]));
    });

    it("rejects a table-origin chart without a complete source and presentation export leakage", () => {
        const errors = validateDashboard(dashboard({
            defaultView: "table",
            allowedViews: ["table", "pie"],
            table: { export: { enabled: true, formats: ["png"] } },
            chart: { columns, xField: "Category", yField: "Value" },
        })).errors;
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining("explicit complete or aggregated chart query"),
            expect.stringContaining("formats must contain csv or excel"),
        ]));
    });

    it("rejects missing mappings, invalid numeric metadata, and unknown properties", () => {
        const errors = validateDashboard(dashboard({
            defaultView: "pie",
            allowedViews: ["table", "pie"],
            chart: {
                request,
                columns: [
                    { field: "Category", header: "Category", dataType: "text" },
                    { field: "Value", header: "Value", dataType: "text" },
                ],
                xField: "Category",
                yField: "Value",
                unsupported: true,
            },
        })).errors;
        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining('unknown property "unsupported"'),
            expect.stringContaining("must be declared as number, currency, or percentage"),
        ]));
    });

    it("keeps legacy widgets valid and rejects presentation switching on stat widgets", () => {
        expect(validateDashboard({ ...dashboard(undefined), widgets: [{ ...dashboard(undefined).widgets[0], presentation: undefined }] }).errors).toEqual([]);
        const invalid = dashboard({ defaultView: "table", allowedViews: ["table", "pie"] });
        invalid.widgets[0].type = "stat";
        expect(validateDashboard(invalid).errors).toContain('Widget "orders" presentation is supported only for table and chart widgets.');
    });

    it("resolves the active source while preserving page-filter exclusions and runtime metadata", () => {
        const configured = dashboard({
            defaultView: "table",
            allowedViews: ["table", "pie"],
            chart: {
                request: { action: "select", source: { table: "OrderSummary" }, fields: ["Category", "Value"] },
                columns,
                xField: "Category",
                yField: "Value",
            },
        }).widgets[0] as unknown as DashboardWidget;
        configured.pageFilterExclusions = ["Branch"];
        configured.runtimeFilters = [{ field: "Minimum", label: "Minimum", type: "number", operator: "greaterThanOrEqual" }];
        const definition = resolveDashboardWidgetPresentationDefinition(configured, "pie", [
            { field: "Status", label: "Status", type: "text", operator: "equals" },
            { field: "Branch", label: "Branch", type: "text", operator: "equals" },
        ]);

        expect(definition?.request).toMatchObject({ source: { table: "OrderSummary" } });
        expect(definition?.filters.map(filter => filter.field)).toEqual(["Minimum", "Status"]);
    });
});
