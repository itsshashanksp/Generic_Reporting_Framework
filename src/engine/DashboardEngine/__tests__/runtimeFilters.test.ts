import { describe, expect, it } from "vitest";

import { validateDashboard } from "../../DashboardValidator";
import { loadDashboardConfiguration } from "..";

const filter = (field = "Status") => ({ field, label: field, type: "text", operator: "equals" });
const widget = (extra: Record<string, unknown> = {}) => ({
    id: "orders", type: "stat", title: "Orders",
    request: { action: "select", source: { table: "Orders" }, fields: ["Status"] },
    runtimeFilters: [filter()],
    ...extra,
});
const dashboard = (widgets: unknown[], filters: unknown[] = []) => ({ id: "runtime", title: "Runtime", filters, widgets });

describe("dashboard widget runtimeFilters validation", () => {
    it("accepts the existing filter definition language", () => {
        expect(validateDashboard(dashboard([widget()])).errors).toEqual([]);
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
