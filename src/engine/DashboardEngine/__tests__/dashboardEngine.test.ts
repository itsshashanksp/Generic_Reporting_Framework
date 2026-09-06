import { describe, expect, it } from "vitest";

import {
    getDashboard,
    getDashboardIds,
    resolveDashboardWidgetColumns,
    resolveDashboardWidgetRequest,
} from "..";

describe("DashboardEngine", () => {
    it("loads layout, filters and widgets in configured order", () => {
        expect(getDashboardIds()).toContain("customer-dashboard");
        const result = getDashboard("customer-dashboard");
        expect(result.status).toBe("valid");
        if (result.status !== "valid") return;

        expect(result.dashboard.layout).toMatchObject({ columns: 12, tabletColumns: 6, mobileColumns: 1 });
        expect(result.dashboard.filters?.map(filter => filter.field)).toEqual(["Item_Desc", "Std_Vat"]);
        expect(result.dashboard.widgets.map(widget => widget.id)).toEqual([
            "item-table", "total-Items", "minimum-sp-item", "maximum-sp-item", "total-value",
        ]);
    });

    it("maps table and stat widget IDs without embedded dashboard requests", () => {
        const result = getDashboard("customer-dashboard");
        if (result.status !== "valid") throw new Error("Expected valid production dashboard");
        const table = result.dashboard.widgets.find(widget => widget.type === "table")!;
        const stat = result.dashboard.widgets.find(widget => widget.type === "stat")!;

        expect(resolveDashboardWidgetRequest(table)?.source).toEqual({ table: "ItemMasterTable" });
        expect(resolveDashboardWidgetColumns(table)?.[0]).toMatchObject({ field: "Item_Code", header: "Item Code" });
        expect(resolveDashboardWidgetRequest(stat)?.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ function: "COUNT", alias: "TotalItems" }),
        ]));
        expect(stat.valueField).toBe("TotalItems");
        expect("request" in table).toBe(false);
    });
});
