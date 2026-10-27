import { describe, expect, it } from "vitest";

import { validateDashboard } from "../../engine/DashboardValidator";
import { loadDashboardConfiguration, resolveDashboardWidgetDefinition } from "../../engine/DashboardEngine";
import { getReportValidationErrors } from "../../engine/ReportDefinitionEngine/validator";
import { loadNavigation } from "../../engine/NavigationEngine";
import { buildWidgetRegistry } from "../../engine/WidgetEngine/widgetLoader";
import type { DashboardDefinition } from "../../types/dashboard";

const reports = import.meta.glob("../../../examples/reports/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const dashboards = import.meta.glob("../../../examples/dashboards/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const widgets = import.meta.glob("../../../examples/widgets/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const menus = import.meta.glob("../../../examples/menu.json", { eager: true, import: "default" }) as Record<string, unknown>;
const maintainedReports = import.meta.glob("../reports/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const maintainedDashboards = import.meta.glob("../dashboards/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const maintainedWidgets = import.meta.glob("../widgets/*.json", { eager: true, import: "default" }) as Record<string, unknown>;

const reportIds = Object.values(reports).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);
const widgetIds = Object.keys(buildWidgetRegistry(widgets));
const dashboardIds = Object.values(dashboards).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);

describe("version-controlled example library", () => {
    it("validates every deployable report, dashboard, reusable widget and menu", () => {
        for (const [file, report] of Object.entries(reports)) expect(getReportValidationErrors(report), file).toEqual([]);
        for (const [file, dashboard] of Object.entries(dashboards)) {
            expect(validateDashboard(dashboard, { reportIds, widgetIds }).errors, file).toEqual([]);
            const definition = dashboard as DashboardDefinition;
            for (const widget of definition.widgets.filter(widget => widget.request || widget.queryDefinition)) {
                expect(
                    () => resolveDashboardWidgetDefinition(widget, definition.filters),
                    `${file} widget ${widget.id}`,
                ).not.toThrow();
            }
        }
        for (const [file, menu] of Object.entries(menus)) {
            expect(() => loadNavigation(menu, { reportIds, dashboardIds }), file).not.toThrow();
        }
        expect(widgetIds.length).toBeGreaterThan(0);
    });

    it("keeps SQL Resource references as logical generic IDs", () => {
        const serialized = JSON.stringify([reports, dashboards, widgets]);
        expect(serialized).not.toMatch(/loyal-ibms|ItemMasterTable|BillDetTable|PurMastTable/);
        expect(serialized).toContain("catalog/customer-summary");
    });

    it("keeps complete widget runtime-filter demonstrations in the public library", () => {
        const byId = new Map(Object.values(dashboards).flatMap(value =>
            typeof value === "object" && value !== null && "id" in value
                ? [[String(value.id), value as { widgets?: Array<Record<string, unknown>> }]] as const
                : []));
        for (const id of [
            "widget-runtime-filters-dashboard",
            "combined-dashboard-widget-filters",
            "dynamic-widget-runtime-filters",
            "referenced-widget-runtime-filters",
        ]) {
            const example = byId.get(id);
            expect(example, id).toBeDefined();
            expect(example?.widgets?.some(widget => Array.isArray(widget.runtimeFilters) && widget.runtimeFilters.length > 0), id).toBe(true);
        }
        const referenced = byId.get("referenced-widget-runtime-filters")?.widgets ?? [];
        expect(referenced.some(widget => typeof widget.widgetId === "string")).toBe(true);
        expect(referenced.some(widget => typeof widget.reportId === "string")).toBe(true);
    });

    it("validates every locally maintained runtime definition when deployment JSON is present", () => {
        const localReportIds = Object.values(maintainedReports).flatMap(value =>
            typeof value === "object" && value && "id" in value ? [String(value.id)] : []);
        const localWidgetIds = Object.keys(buildWidgetRegistry(maintainedWidgets));

        for (const [file, report] of Object.entries(maintainedReports)) {
            expect(getReportValidationErrors(report), file).toEqual([]);
        }
        for (const [file, dashboard] of Object.entries(maintainedDashboards)) {
            expect(validateDashboard(dashboard, {
                reportIds: localReportIds,
                widgetIds: localWidgetIds,
            }).errors, file).toEqual([]);
            const loaded = loadDashboardConfiguration(dashboard, file);
            expect(loaded.status, file).toBe("valid");
            if (loaded.status === "valid") {
                for (const widget of loaded.dashboard.widgets) {
                    expect(
                        () => resolveDashboardWidgetDefinition(widget, loaded.dashboard.filters),
                        `${file} widget ${widget.id}`,
                    ).not.toThrow();
                }
            }
        }
    });

    const maintainedItemDashboard = Object.values(maintainedDashboards).find(value =>
        typeof value === "object" && value !== null && "id" in value && value.id === "item-dashboard") as DashboardDefinition | undefined;

    it.skipIf(!maintainedItemDashboard)("loads the ignored Item Dashboard chart definitions without treating graphic exports as report exports", () => {
        const itemDashboard = maintainedItemDashboard;
        const charts = itemDashboard?.widgets?.filter(widget => widget.type === "chart") ?? [];
        expect(charts.length).toBeGreaterThan(0);
        for (const chart of charts) {
            expect((chart.export as { formats?: string[] }).formats).toEqual(["png", "svg", "csv", "excel"]);
            expect(() => resolveDashboardWidgetDefinition(chart, itemDashboard?.filters ?? [])).not.toThrow();
        }
    });

    it("keeps the public catalog explicit about modern conditional presentation options", () => {
        const catalog = Object.values(dashboards).find(value =>
            typeof value === "object" && value !== null && "id" in value
            && value.id === "widget-catalog-dashboard") as { widgets?: Array<Record<string, unknown>> } | undefined;
        const catalogWidgets = catalog?.widgets ?? [];
        const table = catalogWidgets.find(widget => widget.type === "table");
        const charts = catalogWidgets.filter(widget => widget.type === "chart");

        expect(table?.pagination).toMatchObject({
            pageSize: 10,
            pageSizeOptions: [10, 25, 50],
            showTotalRecords: true,
            showPageNumbers: true,
        });
        expect(charts.some(widget => (widget.chartOptions as Record<string, unknown>)?.appearance === "donut")).toBe(true);
        expect(charts.some(widget => (widget.chartOptions as Record<string, unknown>)?.orientation === "horizontal")).toBe(true);
        expect(charts.every(widget => (widget.export as { formats?: string[] })?.formats?.join(",") === "png,svg,csv,excel")).toBe(true);
    });
});
