import { describe, expect, it } from "vitest";

import { validateDashboard } from "../../engine/DashboardValidator";
import { getReportValidationErrors } from "../../engine/ReportDefinitionEngine/validator";
import { loadNavigation } from "../../engine/NavigationEngine";
import { buildWidgetRegistry } from "../../engine/WidgetEngine/widgetLoader";

const reports = import.meta.glob("../../../examples/reports/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const dashboards = import.meta.glob("../../../examples/dashboards/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const widgets = import.meta.glob("../../../examples/widgets/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const menus = import.meta.glob("../../../examples/menu.json", { eager: true, import: "default" }) as Record<string, unknown>;

const reportIds = Object.values(reports).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);
const widgetIds = Object.keys(buildWidgetRegistry(widgets));
const dashboardIds = Object.values(dashboards).flatMap(value => typeof value === "object" && value && "id" in value ? [String(value.id)] : []);

describe("version-controlled example library", () => {
    it("validates every deployable report, dashboard, reusable widget and menu", () => {
        for (const [file, report] of Object.entries(reports)) expect(getReportValidationErrors(report), file).toEqual([]);
        for (const [file, dashboard] of Object.entries(dashboards)) {
            expect(validateDashboard(dashboard, { reportIds, widgetIds }).errors, file).toEqual([]);
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
});
