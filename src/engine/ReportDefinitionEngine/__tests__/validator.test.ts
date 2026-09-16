import { describe, expect, it } from "vitest";

import { getReportValidationErrors } from "../validator";
import { loadDefinition } from "../loader";

const presentation = {
    id: "capability-report",
    title: "Capability report",
    columns: [{ field: "CustomerName", header: "Customer" }, { field: "TotalAmount", header: "Total" }],
    filters: [],
};

describe("report request contract alignment", () => {
    it("derives the SQL API envelope from normalized presentation configuration", () => {
        const report = loadDefinition({
            ...presentation,
            columns: [{ field: "Cust_Name", header: "Customer" }],
            queryDefinition: {
                format: "sql",
                resource: "reports/customer",
            },
            filters: [{ field: "Region", label: "Region", type: "text" }],
            sort: [{ field: "Cust_Name", direction: "ASC" }],
            filterLogic: "OR",
        });

        expect(report.request).toEqual({
            action: "sql",
            resource: "reports/customer",
            execution: {
                columns: ["Cust_Name"],
                filters: { Region: { expression: "Region", placement: "source" } },
            },
            sort: [{ field: "Cust_Name", direction: "ASC" }],
            filterLogic: "OR",
        });
    });

    it("accepts backend-supported JSON joins, filters, grouping, HAVING, sorting, and pagination", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            request: {
                action: "select",
                source: { table: "Orders", alias: "O" },
                fields: [
                    { field: "C.CustomerName", alias: "CustomerName" },
                    { function: "SUM", field: "O.Amount", alias: "TotalAmount" },
                ],
                joins: [{ type: "INNER", source: { table: "Customers", alias: "C" }, on: { left: "O.CustomerId", operator: "=", right: "C.CustomerId" } }],
                filters: [{ field: "O.Status", operator: "IN", value: ["Open", "Pending"] }],
                filterLogic: "AND",
                groupBy: ["C.CustomerName"],
                having: [{ function: "SUM", field: "O.Amount", operator: ">", value: 1000 }],
                pagination: { page: 1, pageSize: 10 },
            },
            sort: [{ field: "TotalAmount", direction: "DESC" }],
        });

        expect(errors).toEqual([]);
    });

    it("rejects duplicated default sorting inside a JSON Query request", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            request: {
                action: "select",
                source: { table: "Orders" },
                fields: ["CustomerName"],
                sort: [{ field: "CustomerName", direction: "ASC" }],
            },
        });

        expect(errors).toContain("Report request sort must be configured at top-level sort.");
    });

    it("accepts a backend SQL resource identifier and rejects SQL text or paths", () => {
        expect(getReportValidationErrors({
            ...presentation,
            queryDefinition: { format: "sql", resource: "reports/customer" },
            sort: [{ field: "CustomerName", direction: "ASC" }],
            filterLogic: "OR",
        })).toEqual([]);
        expect(getReportValidationErrors({
            ...presentation,
            queryDefinition: { format: "sql", resource: "../customer.sql", sql: "SELECT 1" },
        })).toEqual(expect.arrayContaining([
            expect.stringContaining("unknown property"),
            expect.stringContaining("safe backend resource identifier"),
        ]));
    });

    it("allows a dynamic filter-only field outside the displayed columns", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            columns: [{ field: "Item_Desc", header: "Description" }],
            queryDefinition: {
                format: "sql",
                resource: "reports/items",
            },
            filters: [{
                field: "Supplier_Name",
                label: "Supplier",
                type: "select",
                dynamicOptions: {
                    request: {
                        action: "select",
                        source: { table: "Suppliers" },
                        fields: ["Supplier_Name", { function: "COUNT", field: "*", alias: "Frequency" }],
                        groupBy: ["Supplier_Name"],
                    },
                    valueField: "Supplier_Name",
                    countField: "Frequency",
                },
            }],
        });

        expect(errors).toEqual([]);
        const report = loadDefinition({
            ...presentation,
            columns: [{ field: "Item_Desc", header: "Description" }],
            queryDefinition: { format: "sql", resource: "reports/items" },
            filters: [{ field: "Supplier_Name", label: "Supplier", type: "text" }],
        });
        expect(report.request).toMatchObject({
            execution: {
                columns: ["Item_Desc"],
                filters: { Supplier_Name: { expression: "Supplier_Name", placement: "source" } },
            },
        });
    });

    it("enforces SQL Resource logical field identifiers", () => {
        expect(getReportValidationErrors({
            ...presentation,
            queryDefinition: { format: "sql", resource: "reports/customer" },
            filters: [{ field: "C.Cust_Name", label: "Customer", type: "text" }],
        })).toEqual(expect.arrayContaining([
            expect.stringContaining("SQL Resource logical field"),
        ]));
    });

    it("rejects legacy duplicated SQL execution metadata", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            queryDefinition: {
                format: "sql",
                resource: "reports/customer",
                execution: {
                    columns: ["Cust_Name"],
                    filters: {
                        Unsafe: { expression: "Cust_Name OR 1=1", placement: "source" },
                        BadAggregate: { expression: "STRING_AGG(Name, ',')", placement: "having" },
                    },
                    defaultSort: [{ field: "Missing", direction: "ASC" }],
                },
            },
        });

        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining('unknown property "execution"'),
        ]));
    });

    it("validates backend function-specific expression shapes", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            request: {
                action: "select",
                source: { table: "Orders" },
                fields: [
                    { function: "DATEDIFF", datepart: "INVALID", start: { field: "CreatedAt" }, end: { function: "NOW" } },
                    { function: "IIF", condition: { left: "Amount", operator: "DROP", right: 0 }, true: "Yes", false: "No" },
                ],
            },
        });

        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining("DATEDIFF requires a supported datepart"),
            expect.stringContaining("IIF requires a valid condition"),
        ]));
    });

    it("enforces backend filter shapes and flat filter logic", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            request: {
                action: "select",
                source: { table: "Customers" },
                fields: ["CustomerName"],
                filters: [{ operator: "EXISTS", value: true }],
                filterLogic: "XOR",
            },
        });

        expect(errors).toEqual(expect.arrayContaining([
            expect.stringContaining("requires query"),
            expect.stringContaining("EXISTS must omit field and value"),
            expect.stringContaining("filterLogic must be AND or OR"),
        ]));
    });
});
