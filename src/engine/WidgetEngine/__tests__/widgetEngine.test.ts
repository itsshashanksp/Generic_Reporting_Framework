import { describe, expect, it } from "vitest";

import { getWidgetDefinition, getWidgetDefinitionIds } from "..";
import { getReportValidationErrors } from "../../ReportDefinitionEngine/validator";

describe("WidgetEngine", () => {
    it("loads and resolves production widget IDs and SQL-derived requests", () => {
        expect(getWidgetDefinitionIds()).toEqual(expect.arrayContaining([
            "item-dashboard-stats",
            "item-dashboard-table",
        ]));
        expect(getWidgetDefinition("item-dashboard-stats")?.request).toMatchObject({
            action: "select",
            source: { table: "ItemMasterTable" },
        });
    });

    it("supports columnless stat definitions and table definitions with columns", () => {
        expect(getWidgetDefinition("item-dashboard-stats")?.columns).toEqual([]);
        expect(getWidgetDefinition("item-dashboard-table")?.columns.map(column => column.field))
            .toEqual(["Item_Code", "Item_Desc", "Sale_Rate", "Item_MRP", "Std_Vat"]);
    });

    it("keeps columns mandatory for standalone report validation", () => {
        const base = {
            id: "sample",
            title: "Sample",
            queryDefinition: { format: "sql", resource: "sample.sql" },
            filters: [],
            toolbar: { export: false, refresh: false, settings: false },
            grid: { pagination: { enabled: true, pageSize: 25 }, rowSelection: "single" },
        };
        expect(getReportValidationErrors(base).some(error => error.includes("columns"))).toBe(true);
        expect(getReportValidationErrors(base, { columnsRequired: false }).some(error => error.includes("columns"))).toBe(false);
    });
});
