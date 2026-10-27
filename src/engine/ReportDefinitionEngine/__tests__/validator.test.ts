import { describe, expect, it } from "vitest";

import { getReportValidationErrors, getReportValidationWarnings } from "../validator";
import { loadDefinition } from "../loader";

const presentation = {
    id: "capability-report",
    title: "Capability report",
    columns: [{ field: "CustomerName", header: "Customer" }, { field: "TotalAmount", header: "Total" }],
    filters: [],
};

describe("report request contract alignment", () => {
    it("accepts optional column alignment and rejects unsupported values", () => {
        const report = {
            ...presentation,
            queryDefinition: { format: "sql", resource: "reports/customer" },
            columns: [{ field: "CustomerName", header: "Customer", align: "left" }],
        };
        expect(getReportValidationErrors(report)).toEqual([]);
        expect(getReportValidationErrors({
            ...report,
            columns: [{ field: "CustomerName", header: "Customer", align: "justify" }],
        })).toContain("Report column at index 0 align must be left, center, or right.");
    });

    it("accepts CSV/Excel report exports and rejects chart or empty format lists", () => {
        const report = {
            ...presentation,
            queryDefinition: { format: "sql", resource: "reports/customer" },
        };
        expect(getReportValidationErrors({
            ...report,
            export: { enabled: true, formats: ["csv", "excel"] },
        })).toEqual([]);
        expect(getReportValidationErrors({
            ...report,
            export: { enabled: true, formats: ["png", "svg"] },
        })).toContain("Report export formats must be a non-empty array containing csv or excel.");
        expect(getReportValidationErrors({
            ...report,
            export: { enabled: true, formats: [] },
        })).toContain("Report export formats must be a non-empty array containing csv or excel.");
    });

    it("accepts and normalizes modern pagination presentation settings", () => {
        const report = loadDefinition({
            ...presentation,
            queryDefinition: { format: "sql", resource: "reports/customer" },
            grid: {
                pagination: {
                    enabled: true,
                    style: "modern",
                    pageSize: 25,
                    pageSizeOptions: [10, 25, 50, 100],
                    showTotalRecords: true,
                    showPageNumbers: true,
                    showFirstLast: false,
                },
                rowSelection: "single",
            },
        });
        expect(report.grid.pagination).toMatchObject({ pageSize: 25, showPageNumbers: true, showFirstLast: false });
    });

    it("rejects invalid modern pagination settings", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            queryDefinition: { format: "sql", resource: "reports/customer" },
            grid: { pagination: { style: "compact", pageSize: 0, pageSizeOptions: [10, 10], showPageNumbers: "yes" } },
        });
        expect(errors).toEqual(expect.arrayContaining([
            "Report grid pagination style must be modern.",
            "Report grid pagination pageSize must be a positive integer.",
            "Report grid pagination pageSizeOptions must not contain duplicates.",
            "Report grid pagination showPageNumbers must be a boolean.",
        ]));
    });

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
                filters: { Region: { placement: "source" } },
            },
            sort: [{ field: "Cust_Name", direction: "ASC" }],
            filterLogic: "OR",
        });
    });

    it("accepts backend-supported JSON joins, filters, grouping, and HAVING", () => {
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
                groupBy: ["C.CustomerName"],
                having: [{ function: "SUM", field: "O.Amount", operator: ">", value: 1000 }],
            },
            sort: [{ field: "TotalAmount", direction: "DESC" }],
            filterLogic: "AND",
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

    it("rejects authored pagination and filter logic inside a JSON Query request", () => {
        const errors = getReportValidationErrors({
            ...presentation,
            request: {
                action: "select",
                source: { table: "Orders" },
                fields: ["CustomerName"],
                pagination: { page: 1, pageSize: 10 },
                filterLogic: "OR",
            },
            filterLogic: "AND",
        });

        expect(errors).toEqual(expect.arrayContaining([
            "Report request pagination must be configured in frontend pagination settings.",
            "Report request filterLogic must be configured at top-level filterLogic.",
        ]));
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
                filters: { Supplier_Name: { placement: "source" } },
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

describe("runtime database selection", () => {
    const json = { ...presentation, request: { action: "select", database: "abc", source: { table: "Customers" }, fields: ["CustomerName", "TotalAmount"] } };
    const sql = { ...presentation, queryDefinition: { format: "sql", resource: "reports/customer", database: "abc" } };

    it.each([["JSON Query", json], ["SQL Resource", sql]])("accepts backend-owned discovery for a %s report", (_mode, report) => {
        expect(getReportValidationErrors({ ...report, databaseSelection: true })).toEqual([]);
        expect(loadDefinition({ ...report, databaseSelection: true }).request.database).toBe("abc");
    });

    it.each([false, {}, { databases: ["abc", "abc2"] }, ["abc", "abc2"]])("rejects frontend-owned database options: %j", databaseSelection => {
        expect(getReportValidationErrors({ ...json, databaseSelection })).toEqual(["Report databaseSelection must be true."]);
    });

    it("does not need a configured database, because the backend registry decides the initial one", () => {
        const request = { ...json.request, database: undefined };
        expect(getReportValidationErrors({ ...json, request, databaseSelection: true })).toEqual([]);
    });
});

describe("hidden required filters", () => {
    const report = {
        ...presentation,
        request: { action: "select", source: { table: "Customers" }, fields: ["CustomerName"] },
    };

    it("allows hidden optional filters", () => {
        expect(getReportValidationErrors({
            ...report,
            filters: [{ field: "Status", label: "Status", type: "text", visible: false }],
        })).toEqual([]);
    });

    it("rejects hidden required filters because the schema has no default values", () => {
        expect(getReportValidationErrors({
            ...report,
            filters: [{ field: "Status", label: "Status", type: "text", visible: false, required: true }],
        })).toContain("Report filter at index 0 cannot be both hidden and required because filter defaults are not supported.");
    });
});

describe("flat OR diagnostics", () => {
    it("keeps authored and runtime OR filters valid and warns that both are alternatives", () => {
        const report = {
            ...presentation,
            request: {
                action: "select", source: { table: "Customers" }, fields: ["CustomerName"],
                filters: [{ field: "Tenant", operator: "=", value: "A" }],
            },
            filters: [{ field: "Status", label: "Status", type: "text", operator: "equals" }],
            filterLogic: "OR",
        };
        expect(getReportValidationErrors(report)).toEqual([]);
        expect(getReportValidationWarnings(report)).toEqual([
            expect.stringContaining("flat OR"),
        ]);
    });
});
