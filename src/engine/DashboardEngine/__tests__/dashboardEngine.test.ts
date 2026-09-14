import { describe, expect, it } from "vitest";

import {
    getDashboard,
    getDashboardIds,
    resolveDashboardWidgetColumns,
    resolveDashboardWidgetRequest,
} from "..";
import { validateDashboard } from "../../DashboardValidator";

describe("DashboardEngine", () => {
    it("loads layout, filters and widgets in configured order", () => {
        expect(getDashboardIds()).toContain("item-dashboard");
        const result = getDashboard("item-dashboard");
        expect(result.status).toBe("valid");
        if (result.status !== "valid") return;

        expect(result.dashboard.layout).toMatchObject({ columns: 12, tabletColumns: 6, mobileColumns: 1 });
        expect(result.dashboard.filters?.map(filter => filter.field)).toEqual(["Item_Desc", "Std_Vat"]);
        expect(result.dashboard.widgets.map(widget => widget.id)).toEqual([
            "item-table", "total-Items", "minimum-sp-item", "maximum-sp-item", "stock-value",
        ]);
    });

    it("maps inline table and stat SQL resources", () => {
        const result = getDashboard("item-dashboard");
        if (result.status !== "valid") throw new Error("Expected valid production dashboard");
        const table = result.dashboard.widgets.find(widget => widget.type === "table")!;
        const stat = result.dashboard.widgets.find(widget => widget.type === "stat")!;

        expect(resolveDashboardWidgetRequest(table)).toMatchObject({
            action: "sql",
            resource: "widgets/item-dashboard-table",
            execution: {
                columns: expect.arrayContaining(["Item_Code", "cl_stock", "stock_value"]),
                defaultSort: [{ field: "Item_Code", direction: "ASC" }],
            },
        });
        expect(resolveDashboardWidgetColumns(table)?.[0]).toMatchObject({ field: "Item_Code", header: "Item Code" });
        expect(resolveDashboardWidgetRequest(stat)).toMatchObject({
            action: "sql",
            resource: "widgets/item-dashboard-stats",
            execution: {
                filters: {
                    Item_Desc: { expression: "Item_Desc", placement: "source" },
                    Std_Vat: { expression: "Std_Vat", placement: "source" },
                },
            },
        });
        expect(stat.valueField).toBe("TotalItems");
        expect("widgetId" in table).toBe(false);
    });

    it("resolves every inline Bill widget through the shared backend SQL resource mode", () => {
        const result = getDashboard("bill-dashboard");
        if (result.status !== "valid") throw new Error("Expected valid Bill dashboard");

        const resources = result.dashboard.widgets.map(widget => {
            expect("widgetId" in widget).toBe(false);
            expect(widget.queryDefinition?.format).toBe("sql");
            const request = resolveDashboardWidgetRequest(widget);
            expect(request?.action).toBe("sql");
            expect(JSON.stringify(request)).not.toContain("SELECT");
            return request && "resource" in request ? request.resource : undefined;
        });

        expect(resources).toEqual([
            "widgets/bill-sales-month-wise",
            "widgets/bill-purchases-month-wise",
            "widgets/bill-top-10-categories",
            "widgets/TOP-10-month-Wise-Category-wise",
            "widgets/bill-category-sales-month-wise",
            "widgets/bill-total-sales",
            "widgets/bill-total-purchases",
        ]);

        const salesTable = result.dashboard.widgets[0];
        expect(resolveDashboardWidgetColumns(salesTable)?.map(column => column.field))
            .toEqual(["Month", "Sales"]);
    });

    it("validates inline definitions and rejects ambiguous widget sources", () => {
        const baseWidget = {
            id: "inline-stat",
            type: "stat",
            title: "Inline statistic",
            queryDefinition: { format: "sql", resource: "widgets/inline-stat" },
            filters: [],
        };

        expect(validateDashboard({
            id: "inline-dashboard",
            title: "Inline dashboard",
            widgets: [baseWidget],
        }).valid).toBe(true);

        const ambiguous = validateDashboard({
            id: "ambiguous-dashboard",
            title: "Ambiguous dashboard",
            widgets: [{ ...baseWidget, widgetId: "item-dashboard-stats" }],
        });
        expect(ambiguous.valid).toBe(false);
        expect(ambiguous.errors).toContain(
            "stat widget \"inline-stat\" requires exactly one of queryDefinition, widgetId, reportId, or request."
        );
    });

    it("supports inline report widgets and keeps registry-backed widget definitions", () => {
        const inlineReport = {
            id: "inline-report",
            type: "report",
            title: "Inline report",
            request: {
                action: "select",
                source: { table: "items" },
                fields: ["name"],
            },
            columns: [{ field: "name", header: "Name" }],
            filters: [],
        };

        expect(validateDashboard({
            id: "inline-dashboard",
            title: "Inline dashboard",
            widgets: [inlineReport],
        }).valid).toBe(true);

        const reusable = getDashboard("item-dashboard");
        if (reusable.status !== "valid") throw new Error("Expected valid production dashboard");
        const stat = reusable.dashboard.widgets.find(widget => widget.widgetId === "item-dashboard-stats")!;
        expect(resolveDashboardWidgetRequest(stat)?.action).toBe("sql");
    });
});
