import { describe, expect, it } from "vitest";

import { buildWidgetRegistry, getWidgetDefinitionIds } from "..";
import { getReportValidationErrors } from "../../ReportDefinitionEngine/validator";

describe("WidgetEngine", () => {
    const registry = buildWidgetRegistry({
        "stats.json": {
            id: "item-dashboard-stats",
            title: "Item statistics",
            queryDefinition: { format: "sql", resource: "widgets/item-dashboard-stats" },
            filters: [],
        },
        "table.json": {
            id: "item-dashboard-table",
            title: "Items",
            queryDefinition: {
                format: "sql",
                resource: "widgets/item-dashboard-table",
                execution: {
                    columns: ["Item_Code"],
                    defaultSort: [{ field: "Item_Code", direction: "ASC" }],
                },
            },
            columns: [{ field: "Item_Code", header: "Item Code" }],
            filters: [],
        },
    });

    it("discovers the shared production Item statistics definition", () => {
        expect(getWidgetDefinitionIds()).toEqual(["item-dashboard-stats"]);
    });

    it("loads reusable backend SQL resource definitions without parsing SQL", () => {
        expect(registry["item-dashboard-stats"].request).toMatchObject({
            action: "sql",
            resource: "widgets/item-dashboard-stats",
        });
        expect(registry["item-dashboard-table"].request).toMatchObject({
            execution: {
                columns: ["Item_Code"],
                defaultSort: [{ field: "Item_Code", direction: "ASC" }],
            },
        });
    });

    it("supports columnless stat definitions and table definitions with columns", () => {
        expect(registry["item-dashboard-stats"].columns).toEqual([]);
        expect(registry["item-dashboard-table"].columns.map(column => column.field))
            .toEqual(["Item_Code"]);
    });

    it("keeps columns mandatory for standalone report validation", () => {
        const base = {
            id: "sample",
            title: "Sample",
            queryDefinition: { format: "sql", resource: "reports/sample" },
            filters: [],
            toolbar: { export: false, refresh: false },
            grid: { pagination: { enabled: true, pageSize: 25 }, rowSelection: "single" },
        };
        expect(getReportValidationErrors(base).some(error => error.includes("columns"))).toBe(true);
        expect(getReportValidationErrors(base, { columnsRequired: false }).some(error => error.includes("columns"))).toBe(false);
    });
});
