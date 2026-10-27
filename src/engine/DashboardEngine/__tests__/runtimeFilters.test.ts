import { describe, expect, it } from "vitest";

import { validateDashboard } from "../../DashboardValidator";
import { loadDashboardConfiguration, resolveDashboardWidgetDefinition } from "..";
import type { DashboardWidget } from "../../../types/widget";

const filter = (field = "Status") => ({ field, label: field, type: "text", operator: "equals" });
const widget = (extra: Record<string, unknown> = {}): DashboardWidget => ({
    id: "orders", type: "stat", title: "Orders",
    request: { action: "select", source: { table: "Orders" }, fields: ["Status"] },
    runtimeFilters: [filter()],
    ...extra,
}) as DashboardWidget;
const dashboard = (widgets: unknown[], filters: unknown[] = []) => ({ id: "runtime", title: "Runtime", filters, widgets });

describe("dashboard widget runtimeFilters validation", () => {
    it("accepts the existing filter definition language", () => {
        expect(validateDashboard(dashboard([widget()])).errors).toEqual([]);
    });

    it("accepts percentage stat formatting without changing existing formats", () => {
        for (const format of ["number", "decimal", "currency", "percentage"]) {
            expect(validateDashboard(dashboard([widget({ format })])).errors, format).toEqual([]);
        }
        expect(validateDashboard(dashboard([widget({ format: "ratio" })])).errors)
            .toContain('Stat widget "orders" has invalid format.');
    });

    it("accepts dialog display and rejects unsupported runtime filter displays", () => {
        expect(validateDashboard(dashboard([widget({ runtimeFilterDisplay: "dialog" })])).errors).toEqual([]);
        expect(validateDashboard(dashboard([widget({ runtimeFilterDisplay: "drawer" })])).errors)
            .toContain('Widget "orders" runtimeFilterDisplay must be inline or dialog.');
    });

    it("validates table pagination presentation settings", () => {
        const table = {
            ...widget({ type: "table", pagination: { style: "modern", pageSize: 25, pageSizeOptions: [10, 25], showFirstLast: true } }),
        };
        expect(validateDashboard(dashboard([table])).errors).toEqual([]);
        const errors = validateDashboard(dashboard([{ ...table, pagination: { style: "legacy", pageSize: -1, pageSizeOptions: [10, 10] } }])).errors;
        expect(errors).toEqual(expect.arrayContaining([
            'Table widget "orders" pagination style must be modern.',
            'Table widget "orders" pagination pageSize must be a positive integer.',
            'Table widget "orders" pagination pageSizeOptions must not contain duplicates.',
        ]));
    });

    it("validates modern chart options and chart export formats", () => {
        const chart = widget({
            type: "chart", xField: "Status", yField: "Total", chartType: "pie",
            chartOptions: { appearance: "donut", showCenterTotal: true, topN: 10, showOthers: true, othersLabel: "Remaining" },
            export: { enabled: true, formats: ["png", "svg", "csv", "excel"], filename: "status-chart" },
        });
        expect(validateDashboard(dashboard([chart])).errors).toEqual([]);
        expect(() => resolveDashboardWidgetDefinition(chart)).not.toThrow();
        expect(resolveDashboardWidgetDefinition(chart)?.export).toBeUndefined();

        const errors = validateDashboard(dashboard([widget({
            type: "chart", xField: "Status", yField: "Total",
            chartOptions: { appearance: "ring", orientation: "diagonal", topN: 0, smooth: "yes" },
            export: { enabled: true, formats: ["pdf", "png", "png"] },
        })])).errors;
        expect(errors).toEqual(expect.arrayContaining([
            'Chart widget "orders" chartOptions appearance must be pie or donut.',
            'Chart widget "orders" chartOptions orientation must be vertical or horizontal.',
            'Chart widget "orders" chartOptions topN must be a positive integer.',
            'Chart widget "orders" chartOptions smooth must be a boolean.',
            'Chart widget "orders" export formats must contain png, svg, csv, or excel.',
        ]));
    });

    it("keeps CSV/Excel export on table data definitions and accepts legacy pageSize", () => {
        const table = widget({
            type: "table",
            pageSize: 10,
            export: { enabled: true, formats: ["csv", "excel"], exportCurrentView: true },
        });
        const definition = resolveDashboardWidgetDefinition(table);

        expect(definition?.export).toEqual(table.export);
        expect(loadDashboardConfiguration(dashboard([table])).status).toBe("valid");
    });

    it("resolves registered report and reusable-widget references", () => {
        expect(resolveDashboardWidgetDefinition({
            id: "item-report", type: "report", title: "Item report", reportId: "item",
        })?.id).toBe("item");
        expect(resolveDashboardWidgetDefinition({
            id: "stock-chart", type: "chart", title: "Stock chart",
            widgetId: "retail-item-stock-value-by-category", xField: "Category", yField: "StockValue",
        })?.id).toBe("retail-item-stock-value-by-category");
    });

    it("identifies the widget when internal data-definition validation fails", () => {
        expect(() => resolveDashboardWidgetDefinition(widget({
            type: "table",
            export: { enabled: true, formats: [] },
        }))).toThrow('Unable to resolve dashboard widget "orders": Invalid report configuration: Report export formats must be a non-empty array containing csv or excel.');
    });

    it("rejects duplicate and unsafe fields", () => {
        const errors = validateDashboard(dashboard([widget({
            runtimeFilters: [filter("Status"), filter("Status"), filter("Bad Field")],
        })])).errors;
        expect(errors.some(error => error.includes("Duplicate widget \"orders\" runtime filter field: Status"))).toBe(true);
        expect(errors.some(error => error.includes("field must be a field name"))).toBe(true);
    });

    it("warns when a runtime filter repeats a mapped dashboard field", () => {
        const result = validateDashboard(dashboard([
            widget({ runtimeFilters: [filter("WidgetDate")], filterFields: { BillDate: "WidgetDate" } }),
        ], [filter("BillDate")]));
        expect(result.valid).toBe(true);
        expect(result.warnings.some(warning => warning.includes("repeats a dashboard filter"))).toBe(true);
    });

    it("warns when a runtime filter repeats an authored request filter", () => {
        const result = loadDashboardConfiguration(dashboard([widget({
            request: {
                action: "select", source: { table: "Orders" }, fields: ["Status"],
                filters: [{ field: "Status", operator: "=", value: "Open" }],
            },
        })]));
        expect(result.status).toBe("valid");
        expect(result.validation.warnings.some(warning => warning.includes("repeats an authored request filter"))).toBe(true);
    });

    it("keeps flat OR valid but reports its cross-source semantics", () => {
        const result = loadDashboardConfiguration(dashboard([widget({
            filterLogic: "OR",
            request: {
                action: "select", source: { table: "Orders" }, fields: ["Status"],
                filters: [{ field: "Tenant", operator: "=", value: "A" }],
            },
        })], [filter("Region")]));
        expect(result.status).toBe("valid");
        expect(result.validation.warnings.some(warning => warning.includes("flat OR"))).toBe(true);
    });

    it("keeps dashboards without runtimeFilters valid", () => {
        const { runtimeFilters: _ignored, ...plain } = widget();
        void _ignored;
        expect(validateDashboard(dashboard([plain])).errors).toEqual([]);
    });

    it("allows hidden optional filters and rejects hidden required dashboard and widget filters", () => {
        const optionalShared = { ...filter("OptionalShared"), visible: false };
        const optionalWidget = { ...filter("OptionalWidget"), visible: false };
        expect(validateDashboard(dashboard([widget({ runtimeFilters: [optionalWidget] })], [optionalShared])).errors).toEqual([]);

        const requiredShared = { ...filter("RequiredShared"), visible: false, required: true };
        const requiredWidget = { ...filter("RequiredWidget"), visible: false, required: true };
        const errors = validateDashboard(dashboard([widget({ runtimeFilters: [requiredWidget] })], [requiredShared])).errors;
        expect(errors.filter(error => error.includes("cannot be both hidden and required")).length).toBeGreaterThanOrEqual(2);
    });
});
