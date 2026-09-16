import { describe, expect, it } from "vitest";

import customer from "../reports/customer.json";
import item from "../reports/item.json";
import itemDashboard from "../dashboards/item.json";
import billDashboard from "../dashboards/bill.json";
import { loadDefinition } from "../../engine/ReportDefinitionEngine";

const frontendReportSql = import.meta.glob("../reports/*.sql");
const frontendWidgetSql = import.meta.glob("../widgets/*.sql");

function expectNoEmbeddedQueryLogic(value: unknown) {
    const json = JSON.stringify(value);
    expect(json).not.toMatch(/\bSELECT\s+.+\bFROM\b|\.sql\s+(?:SELECT|FROM)/i);
}

describe("production SQL and JSON responsibility separation", () => {
    it("supports JSON and backend SQL modes side by side", () => {
        expect(item.request).toMatchObject({ action: "select", source: { table: "ItemMasterTable" } });
        expect(customer.request).toMatchObject({ action: "select", source: { table: "CustomerTable" } });
        expect(loadDefinition({
            id: "json-mode",
            title: "JSON mode",
            request: { action: "select", source: { table: "CustomerTable" }, fields: ["Cust_Name"] },
            columns: [{ field: "Cust_Name", header: "Customer" }],
            filters: [],
        }).request).toMatchObject({ action: "select", source: { table: "CustomerTable" } });
        expect(item.columns.length).toBeGreaterThan(0);
        expect(customer.columns.length).toBeGreaterThan(0);
        expectNoEmbeddedQueryLogic(item);
        expect(JSON.stringify(customer)).not.toMatch(/\bSELECT\s+.+\bFROM\b/i);
    });

    it("keeps SQL resources out of the frontend bundle", () => {
        expect(Object.keys(frontendReportSql)).toEqual([]);
        expect(Object.keys(frontendWidgetSql)).toEqual([]);
        const table = itemDashboard.widgets.find(widget => widget.id === "item-table")!;
        expect(table.queryDefinition).toEqual({ format: "sql", resource: "widgets/item-dashboard-table" });
        expect(table.columns?.map(column => column.field)).toEqual([
            "Item_Code", "Item_Desc", "Sale_Rate", "Item_MRP", "Std_Vat", "cl_stock", "stock_value",
        ]);
    });

    it("keeps dashboards as widget-based presentation configuration", () => {
        expect(itemDashboard.widgets.length).toBeGreaterThan(0);
        expect(itemDashboard.widgets.filter(widget => widget.type === "stat")
            .every(widget => widget.queryDefinition?.resource === "widgets/item-dashboard-stats")).toBe(true);
        expect(itemDashboard.widgets.some(widget => widget.type === "stat" && "valueField" in widget)).toBe(true);
        expect(billDashboard.widgets.length).toBeGreaterThan(0);
        expectNoEmbeddedQueryLogic(itemDashboard);
        expectNoEmbeddedQueryLogic(billDashboard);
        for (const widget of billDashboard.widgets.filter(widget => widget.type === "table")) {
            expect(widget.queryDefinition).toEqual({
                format: "sql",
                resource: expect.stringContaining("widgets/"),
            });
            expect(widget.sort).toEqual(expect.any(Array));
        }
    });

    it("contains no duplicated SQL execution metadata", () => {
        const configuration = JSON.stringify([item, customer, itemDashboard, billDashboard]);
        expect(configuration).not.toContain('"execution"');
        expect(configuration).not.toContain('"defaultSort"');
    });
});
