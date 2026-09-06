import { describe, expect, it } from "vitest";

import customer from "../reports/customer.json";
import customerSql from "../reports/customer.sql?raw";
import item from "../reports/item.json";
import itemSql from "../reports/item.sql?raw";
import dashboard from "../dashboards/customer.json";
import stats from "../widgets/item-dashboard-stats.json";
import statsSql from "../widgets/item-dashboard-stats.sql?raw";
import table from "../widgets/item-dashboard-table.json";
import tableSql from "../widgets/item-dashboard-table.sql?raw";

function expectNoEmbeddedQueryLogic(value: unknown) {
    const json = JSON.stringify(value);
    expect(json).not.toMatch(/"request"\s*:/);
    expect(json).not.toMatch(/"(?:aggregates|groupBy|having|joins)"\s*:/i);
    expect(json).not.toMatch(/\bSELECT\b|\bFROM\b|\.sql\s+(?:SELECT|FROM)/i);
}

describe("production SQL and JSON responsibility separation", () => {
    it("keeps report query logic in SQL and presentation in JSON", () => {
        expect(itemSql).toMatch(/SELECT[\s\S]+FROM ItemMasterTable/i);
        expect(customerSql).toMatch(/COUNT\([\s\S]+GROUP BY Cust_Name/i);
        expect(item.queryDefinition).toEqual({ format: "sql", resource: "item.sql" });
        expect(customer.queryDefinition).toEqual({ format: "sql", resource: "customer.sql" });
        expect(item.columns.length).toBeGreaterThan(0);
        expect(customer.columns.length).toBeGreaterThan(0);
        expectNoEmbeddedQueryLogic(item);
        expectNoEmbeddedQueryLogic(customer);
    });

    it("allows columnless stats while retaining table presentation columns", () => {
        expect(statsSql).toMatch(/COUNT\(Item_Code\)[\s\S]+SUM\(Sale_Rate\)/i);
        expect(tableSql).toMatch(/SELECT[\s\S]+Item_Code[\s\S]+FROM ItemMasterTable/i);
        expect("columns" in stats).toBe(false);
        expect(table.columns.map(column => column.field)).toEqual([
            "Item_Code", "Item_Desc", "Sale_Rate", "Item_MRP", "Std_Vat",
        ]);
    });

    it("keeps dashboards as widget-based presentation configuration", () => {
        expect(dashboard.widgets.length).toBeGreaterThan(0);
        expect(dashboard.widgets.every(widget => "widgetId" in widget)).toBe(true);
        expect(dashboard.widgets.some(widget => widget.type === "stat" && "valueField" in widget)).toBe(true);
        expectNoEmbeddedQueryLogic(dashboard);
    });
});
