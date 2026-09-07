import { describe, expect, it } from "vitest";

import { buildWidgetRegistry, getWidgetDefinitionIds } from "..";
import { getReportValidationErrors } from "../../ReportDefinitionEngine/validator";

describe("WidgetEngine", () => {
    const registry = buildWidgetRegistry({
        "stats.json": {
            id: "item-dashboard-stats",
            title: "Item statistics",
            queryDefinition: { format: "sql", resource: "item-dashboard-stats" },
            filters: [],
        },
        "table.json": {
            id: "item-dashboard-table",
            title: "Items",
            queryDefinition: { format: "sql", resource: "item-dashboard-table" },
            columns: [{ field: "Item_Code", header: "Item Code" }],
            filters: [],
        },
    });

    it("supports an empty production registry after widgets moved inline", () => {
        expect(getWidgetDefinitionIds()).toEqual([]);
    });

    it("loads reusable backend SQL resource definitions without parsing SQL", () => {
        expect(registry["item-dashboard-stats"].request).toMatchObject({
            action: "sql",
            resource: "item-dashboard-stats",
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
            queryDefinition: { format: "sql", resource: "sample" },
            filters: [],
            toolbar: { export: false, refresh: false, settings: false },
            grid: { pagination: { enabled: true, pageSize: 25 }, rowSelection: "single" },
        };
        expect(getReportValidationErrors(base).some(error => error.includes("columns"))).toBe(true);
        expect(getReportValidationErrors(base, { columnsRequired: false }).some(error => error.includes("columns"))).toBe(false);
    });
});
