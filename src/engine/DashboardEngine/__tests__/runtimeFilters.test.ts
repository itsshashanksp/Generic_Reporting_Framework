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

    it("rejects conflicts with mapped dashboard fields", () => {
        const errors = validateDashboard(dashboard([
            widget({ runtimeFilters: [filter("WidgetDate")], filterFields: { BillDate: "WidgetDate" } }),
        ], [filter("BillDate")])).errors;
        expect(errors.some(error => error.includes("conflicts with a dashboard filter"))).toBe(true);
    });

    it("rejects conflicts with authored request filters", () => {
        const result = loadDashboardConfiguration(dashboard([widget({
            request: {
                action: "select", source: { table: "Orders" }, fields: ["Status"],
                filters: [{ field: "Status", operator: "=", value: "Open" }],
            },
        })]));
        expect(result.status).toBe("invalid");
        expect(result.validation.errors.some(error => error.includes("conflicts with an authored request filter"))).toBe(true);
    });

    it("keeps dashboards without runtimeFilters valid", () => {
        const { runtimeFilters: _ignored, ...plain } = widget();
        void _ignored;
        expect(validateDashboard(dashboard([plain])).errors).toEqual([]);
    });
});
