import { describe, expect, it } from "vitest";

import billDashboard from "../../../../examples/complete/retail-reference/config/dashboards/bill.json";
import { getDashboard, mapWidgetFilters, resolveDashboardWidgetRequest } from "..";
import { validateDashboard } from "../../DashboardValidator";
import type { FilterDefinition } from "../../../types/filter";

const billDate: FilterDefinition = { field: "Bill_Date", label: "Start Date", type: "daterange", operator: "between" };
const branch: FilterDefinition = { field: "Br_Code", label: "Branch", type: "text" };

function dashboardWith(widget: Record<string, unknown>, filters: FilterDefinition[] = [billDate, branch]) {
    return {
        id: "mapping-dashboard",
        title: "Mapping dashboard",
        filters,
        widgets: [{
            id: "purchases",
            type: "stat",
            title: "Purchases",
            queryDefinition: { format: "sql", resource: "widgets/bill-total-purchases" },
            ...widget,
        }],
    };
}

describe("dashboard widget filterFields", () => {
    it("renames mapped definitions and values only, without mutating its inputs", () => {
        const shared = [billDate, branch];
        const values = { Bill_Date: ["2021-04-01", "2022-03-31"], Br_Code: "B1" };
        const sharedCopy = structuredClone(shared);
        const valuesCopy = structuredClone(values);

        const mapped = mapWidgetFilters(shared, values, { Bill_Date: "GIN_Date" });

        expect(mapped.filters).toEqual([{ ...billDate, field: "GIN_Date" }, branch]);
        expect(mapped.values).toEqual({ GIN_Date: ["2021-04-01", "2022-03-31"], Br_Code: "B1" });
        expect(shared).toEqual(sharedCopy);
        expect(values).toEqual(valuesCopy);
        expect(mapWidgetFilters(shared, values)).toEqual({ filters: shared, values });
    });

    it("accepts a mapping from a shared filter to a field name", () => {
        const result = validateDashboard(dashboardWith({ filterFields: { Bill_Date: "GIN_Date" } }));
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
    });

    it.each([
        ["an unknown source", { Ship_Date: "GIN_Date" }, 'source "Ship_Date" is not a shared dashboard filter field'],
        ["a qualified target", { Bill_Date: "PurMastTable.GIN_Date" }, 'target for "Bill_Date" must be a field name'],
        ["an expression target", { Bill_Date: "GIN_Date) OR (1=1" }, 'target for "Bill_Date" must be a field name'],
        ["a non-string target", { Bill_Date: 7 }, 'target for "Bill_Date" must be a field name'],
        ["a self mapping", { Bill_Date: "bill_date" }, 'maps "Bill_Date" to itself'],
        ["a duplicate target", { Bill_Date: "GIN_Date", Br_Code: "gin_date" }, 'maps both "Bill_Date" and "Br_Code" to "gin_date"'],
        ["a shared-filter collision", { Bill_Date: "br_code" }, 'target "br_code" collides with shared dashboard filter'],
    ])("rejects %s", (_name, filterFields, message) => {
        const result = validateDashboard(dashboardWith({ filterFields }));
        expect(result.valid).toBe(false);
        expect(result.errors.join("\n")).toContain(message);
    });

    it("rejects a collision with the widget's own filter", () => {
        const result = validateDashboard(dashboardWith({
            filterFields: { Bill_Date: "GIN_Date" },
            filters: [{ field: "gin_date", label: "Goods inward", type: "daterange", operator: "between" }],
        }));
        expect(result.valid).toBe(false);
        expect(result.errors.join("\n")).toContain('target "GIN_Date" collides with this widget\'s filter');
    });

    it.each([[[]], [{}], ["Bill_Date:GIN_Date"], [null]])("rejects malformed filterFields %j", filterFields => {
        const result = validateDashboard(dashboardWith({ filterFields }));
        expect(result.valid).toBe(false);
        expect(result.errors.join("\n")).toContain("filterFields must be an object mapping shared filter fields to field names");
    });

    it("maps exactly the Bill dashboard purchases widgets to GIN_Date", () => {
        expect(billDashboard.widgets
            .filter(widget => "filterFields" in widget)
            .map(widget => [widget.id, widget.filterFields])).toEqual([
            ["purchases-month-wise", { Bill_Date: "GIN_Date" }],
            ["total-purchases", { Bill_Date: "GIN_Date" }],
        ]);
    });

    it("declares GIN_Date for mapped purchases widgets and Bill_Date for sales widgets", () => {
        const result = getDashboard("bill-dashboard");
        if (result.status !== "valid") throw new Error(`Expected a valid Bill dashboard: ${JSON.stringify(result.validation)}`);
        const shared = result.dashboard.filters ?? [];
        const sharedCopy = structuredClone(shared);

        const declarations = Object.fromEntries(result.dashboard.widgets.map(widget => {
            const request = resolveDashboardWidgetRequest(widget, shared) as { execution?: { filters?: object } };
            return [widget.id, request.execution?.filters];
        }));

        expect(declarations).toEqual({
            "sales-month-wise": { Bill_Date: { placement: "source" } },
            "purchases-month-wise": { GIN_Date: { placement: "source" } },
            "top-10-categories": { Bill_Date: { placement: "source" } },
            "top-10-month-wise-category-wise": { Bill_Date: { placement: "source" } },
            "category-sales-month-wise": { Bill_Date: { placement: "source" } },
            "total-sales": { Bill_Date: { placement: "source" } },
            "total-purchases": { GIN_Date: { placement: "source" } },
        });
        expect(shared).toEqual(sharedCopy);
        expect(shared.map(filter => filter.field)).toEqual(["Bill_Date"]);
    });
});
