import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDashboard, getDashboardIds, resolveDashboardWidgetRequest } from "../../DashboardEngine";
import { validateDashboard } from "../../DashboardValidator";
import { fetchAllRowsForExport } from "../../ExportEngine/fetchAllRows";
import { clearRequestCache, createRequestCacheKey } from "../../RequestCache";
import { buildFilters } from "../../FilterQueryBuilder";
import type { DashboardWidget } from "../../../types/widget";
import type { FilterDefinition } from "../../../types/filter";
import { loadDefinition } from "../loader";
import { getReportValidationErrors } from "../validator";

const presentation = {
    id: "database-report",
    title: "Database report",
    columns: [{ field: "Cust_Name", header: "Customer" }],
    filters: [],
};

const selectRequest = {
    action: "select",
    database: "test",
    source: { table: "Company" },
    fields: ["*"],
};

const dashboardLayout = {
    id: "database-dashboard",
    title: "Database dashboard",
    layout: { columns: 12 },
};

function dashboardWith(widget: Record<string, unknown>) {
    return { ...dashboardLayout, widgets: [{ id: "w", title: "Widget", width: 6, ...widget }] };
}

describe("logical database selection", () => {
    beforeEach(clearRequestCache);

    it("keeps the configured database on a structured SELECT with sort and filter logic", () => {
        const report = loadDefinition({
            ...presentation,
            request: { ...selectRequest, fields: ["Cust_Name"], groupBy: ["Cust_Name"] },
            sort: [{ field: "Cust_Name", direction: "ASC" }],
            filterLogic: "OR",
        });

        expect(report.request).toEqual({
            action: "select",
            database: "test",
            source: { table: "Company" },
            fields: ["Cust_Name"],
            groupBy: ["Cust_Name"],
            sort: [{ field: "Cust_Name", direction: "ASC" }],
            filterLogic: "OR",
        });
    });

    it("sends the configured database with an unchanged SQL Resource identifier", () => {
        const report = loadDefinition({
            ...presentation,
            queryDefinition: { format: "sql", database: "loyal-ibms", resource: "reports/customer" },
        });

        expect(report.request).toEqual({
            action: "sql",
            database: "loyal-ibms",
            resource: "reports/customer",
            execution: { columns: ["Cust_Name"] },
        });
    });

    it("omits database entirely when it is not configured", () => {
        const sql = loadDefinition({
            ...presentation,
            queryDefinition: { format: "sql", resource: "reports/customer" },
        });
        const select = loadDefinition({
            ...presentation,
            request: { action: "select", source: { table: "Company" }, fields: ["*"] },
        });

        expect(sql.request).toEqual({
            action: "sql",
            resource: "reports/customer",
            execution: { columns: ["Cust_Name"] },
        });
        expect("database" in sql.request).toBe(false);
        expect("database" in select.request).toBe(false);
    });

    it.each([
        ["an empty string", ""],
        ["surrounding whitespace", " loyal-ibms "],
        ["uppercase letters", "Loyal-IBMS"],
        ["a path", "../loyal-ibms"],
        ["a leading digit", "1db"],
        ["a non-string", 42],
        ["an over-long id", `a${"b".repeat(64)}`],
    ])("rejects %s as a database id", (_label, database) => {
        expect(getReportValidationErrors({ ...presentation, request: { ...selectRequest, database } }))
            .toEqual(expect.arrayContaining([expect.stringContaining("Report request database must be a logical database id")]));
        expect(getReportValidationErrors({
            ...presentation,
            queryDefinition: { format: "sql", resource: "reports/customer", database },
        })).toEqual(expect.arrayContaining([expect.stringContaining("Report queryDefinition database must be a logical database id")]));
    });

    it("rejects a database on nested SELECT bodies, as the backend does", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            request: {
                ...selectRequest,
                fields: ["Cust_Name"],
                filters: [{
                    field: "Cust_Code",
                    operator: "IN",
                    query: { database: "test", source: { table: "Orders" }, fields: ["Cust_Code"] },
                }],
            },
        });

        expect(errors.some(error => error.includes("does not support database"))).toBe(true);
    });

    it("validates database on dashboard widget requests and inline SQL definitions", () => {
        expect(validateDashboard(dashboardWith({ type: "stat", valueField: "Total", request: selectRequest })).errors)
            .toEqual([]);
        expect(validateDashboard(dashboardWith({
            type: "table",
            queryDefinition: { format: "sql", database: "loyal-ibms", resource: "widgets/total-sales" },
        })).errors).toEqual([]);

        expect(validateDashboard(dashboardWith({
            type: "stat",
            valueField: "Total",
            request: { ...selectRequest, database: "" },
        })).errors).toEqual(expect.arrayContaining([expect.stringContaining('stat widget "w" request database must be a logical database id')]));
        expect(validateDashboard(dashboardWith({
            type: "table",
            queryDefinition: { format: "sql", database: "Bad Id", resource: "widgets/total-sales" },
        })).errors).toEqual(expect.arrayContaining([expect.stringContaining("queryDefinition database must be a logical database id")]));
        expect(validateDashboard(dashboardWith({
            type: "stat",
            valueField: "Total",
            request: { ...selectRequest, databaseName: "test" },
        })).errors).toEqual(expect.arrayContaining([expect.stringContaining('unknown property "databaseName"')]));
    });

    it("keeps database when dashboard filters are merged into an inline SQL widget", () => {
        const sharedFilters: FilterDefinition[] = [
            { field: "Bill_Date", label: "Bill Date", type: "daterange", operator: "between" },
        ];
        const widget = {
            id: "sales",
            type: "table",
            title: "Sales",
            queryDefinition: { format: "sql", database: "tts32server", resource: "widgets/sales-month-wise" },
            columns: [{ field: "Month", header: "Month" }, { field: "Sales", header: "Sales" }],
            sort: [{ field: "Month", direction: "DESC" }],
        } as DashboardWidget;

        expect(resolveDashboardWidgetRequest(widget, sharedFilters)).toEqual({
            action: "sql",
            database: "tts32server",
            resource: "widgets/sales-month-wise",
            execution: { columns: ["Month", "Sales"], filters: { Bill_Date: { placement: "source" } } },
            sort: [{ field: "Month", direction: "DESC" }],
        });
        expect(buildFilters({ Bill_Date: ["2021-06-01", "2021-06-30"] }, sharedFilters, true)).toEqual([
            { field: "Bill_Date", type: "daterange", operator: "BETWEEN", value: ["2021-06-01", "2021-06-30"] },
        ]);
    });

    it("isolates cache keys by database and keeps omitted-database keys unchanged", () => {
        const base = { action: "sql", resource: "reports/customer", pagination: { page: 1, pageSize: 10 } };

        const loyal = createRequestCacheKey("report:customer", { ...base, database: "loyal-ibms" });
        const test = createRequestCacheKey("report:customer", { ...base, database: "test" });
        const omitted = createRequestCacheKey("report:customer", base);

        expect(loyal).not.toBe(test);
        expect(loyal).not.toBe(omitted);
        expect(createRequestCacheKey("report:customer", { database: "test", ...base })).toBe(test);
        expect(omitted).toBe(
            'report:customer:{"action":"sql","pagination":{"page":1,"pageSize":10},"resource":"reports/customer"}'
        );
    });

    it("keeps database on every export batch", async () => {
        const execute = vi.fn()
            .mockResolvedValueOnce({ success: true, message: "ok", data: [{ Id: 1 }, { Id: 2 }], meta: { page: 1, pageSize: 2, totalRows: 3, rowsReturned: 2, executionTime: 1 } })
            .mockResolvedValueOnce({ success: true, message: "ok", data: [{ Id: 3 }], meta: { page: 2, pageSize: 2, totalRows: 3, rowsReturned: 1, executionTime: 1 } });

        await fetchAllRowsForExport(
            { ...selectRequest, sort: [{ field: "Id", direction: "ASC" }], filters: [{ field: "Id", operator: ">", value: 0 }] },
            { batchSize: 2, execute }
        );

        expect(execute.mock.calls.map(([request]) => request)).toEqual([1, 2].map(page => ({
            ...selectRequest,
            sort: [{ field: "Id", direction: "ASC" }],
            filters: [{ field: "Id", operator: ">", value: 0 }],
            pagination: { page, pageSize: 2 },
        })));
    });

    it("keeps every production report and dashboard configuration valid", () => {
        getDashboardIds().forEach(id => {
            expect(getDashboard(id).status, id).toBe("valid");
        });
    });
});
