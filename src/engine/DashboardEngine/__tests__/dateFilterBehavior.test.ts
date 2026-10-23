import { describe, expect, it } from "vitest";

import billDashboard from "../../../../examples/complete/retail-reference/config/dashboards/bill.json";
import {
    applyDateFilterBehavior,
    getDashboard,
    getDashboardIds,
    getPartialDateRanges,
    loadDashboardConfiguration,
} from "..";
import { validateDashboard } from "../../DashboardValidator";
import { loadFilters } from "../../FilterEngine";
import type { FilterDefinition } from "../../../types/filter";

const billDate: FilterDefinition = { field: "Bill_Date", label: "Start Date", type: "daterange", operator: "between" };
const branch: FilterDefinition = { field: "Br_Code", label: "Branch", type: "text" };

function dashboardWith(extra: Record<string, unknown>, filters: unknown[] = [billDate, branch]) {
    return {
        id: "date-behavior-dashboard",
        title: "Date behavior dashboard",
        filters,
        widgets: [{
            id: "total",
            type: "stat",
            title: "Total",
            queryDefinition: { format: "sql", resource: "widgets/bill-total-sales" },
        }],
        ...extra,
    };
}

describe("dashboard dateFilterBehavior", () => {
    it.each(["required", "optional"])("accepts %j", behavior => {
        const result = validateDashboard(dashboardWith({ dateFilterBehavior: behavior }));
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
    });

    it("leaves filters exactly as configured when the property is omitted", () => {
        const configuration = dashboardWith({});
        const result = loadDashboardConfiguration(configuration);
        if (result.status !== "valid") throw new Error(JSON.stringify(result.validation));
        expect(result.dashboard.dateFilterBehavior).toBeUndefined();
        expect(result.dashboard.filters).toEqual(loadFilters([billDate, branch]));
        expect(result.dashboard.filters?.map(filter => filter.required)).toEqual([false, false]);
    });

    it.each([["mandatory"], [true], [1], [null], [["required"]]])("rejects the invalid value %j", behavior => {
        const result = validateDashboard(dashboardWith({ dateFilterBehavior: behavior }));
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`Dashboard dateFilterBehavior must be "required" or "optional"; received ${JSON.stringify(behavior)}.`);
    });

    it("rejects a behavior on a dashboard without a shared date range", () => {
        const result = validateDashboard(dashboardWith({ dateFilterBehavior: "required" }, [branch]));
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Dashboard dateFilterBehavior "required" requires at least one shared daterange filter.');
    });

    it("rejects optional combined with a required date range", () => {
        const result = validateDashboard(dashboardWith({ dateFilterBehavior: "optional" }, [{ ...billDate, required: true }]));
        expect(result.valid).toBe(false);
        expect(result.errors.join("\n")).toContain('"optional" conflicts with required daterange filter "Bill_Date"');
    });

    it("requires every shared date range under required, without mutating the configuration", () => {
        const filters = [billDate, branch];
        const copy = structuredClone(filters);
        expect(applyDateFilterBehavior(filters, "required")).toEqual([{ ...billDate, required: true }, branch]);
        expect(applyDateFilterBehavior(filters, "optional")).toBe(filters);
        expect(applyDateFilterBehavior(filters, undefined)).toBe(filters);
        expect(filters).toEqual(copy);

        const result = loadDashboardConfiguration(dashboardWith({ dateFilterBehavior: "required" }));
        if (result.status !== "valid") throw new Error(JSON.stringify(result.validation));
        expect(result.dashboard.filters?.map(filter => [filter.field, filter.required])).toEqual([["Bill_Date", true], ["Br_Code", false]]);
    });

    it("finds partial ranges only under optional", () => {
        const filters = [billDate];
        const values = (value: unknown) => ({ Bill_Date: value }) as Parameters<typeof getPartialDateRanges>[1];
        for (const partial of [["2021-04-01", ""], ["", "2022-03-31"], ["2021-04-01", null], ["2021-04-01"]]) {
            expect(getPartialDateRanges(filters, values(partial), "optional")).toEqual(filters);
            expect(getPartialDateRanges(filters, values(partial), undefined)).toEqual([]);
            expect(getPartialDateRanges(filters, values(partial), "required")).toEqual([]);
        }
        for (const accepted of [undefined, ["", ""], [], ["2021-04-01", "2022-03-31"]]) {
            expect(getPartialDateRanges(filters, values(accepted), "optional")).toEqual([]);
        }
    });

    it("configures the Bill dashboard as required and leaves unconfigured dashboards as they were", () => {
        expect(billDashboard.dateFilterBehavior).toBe("required");
        const unconfigured = getDashboardIds().filter(id => {
            const result = getDashboard(id);
            return result.status === "valid" && result.dashboard.dateFilterBehavior === undefined;
        });
        expect(unconfigured.length).toBeGreaterThan(0);
        for (const id of unconfigured) {
            const result = getDashboard(id);
            if (result.status !== "valid") throw new Error(`Expected ${id} to be valid`);
            const configured = loadDashboardConfiguration({ ...result.dashboard, dateFilterBehavior: undefined }, id);
            expect(configured.status === "valid" && configured.dashboard.filters).toEqual(result.dashboard.filters);
            expect(result.dashboard.filters?.every(filter => filter.required === false)).toBe(true);
        }
        const bill = getDashboard("bill-dashboard");
        if (bill.status !== "valid") throw new Error("Expected a valid Bill dashboard");
        expect(bill.dashboard.filters?.map(filter => [filter.field, filter.type, filter.required])).toEqual([["Bill_Date", "daterange", true]]);
    });
});
