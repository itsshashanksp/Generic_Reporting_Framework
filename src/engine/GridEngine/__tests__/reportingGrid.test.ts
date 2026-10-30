import { describe, expect, it } from "vitest";

import { aggregateRows, buildReportingExportRows, buildReportingGridModel } from "../reportingGrid";
import type { GroupingConfig } from "../../../types/grouping";

const columns = [
    { field: "Year", header: "Year", dataType: "number" as const },
    { field: "Month", header: "Month" },
    { field: "Sales", header: "Sales", dataType: "currency" as const },
    { field: "Quantity", header: "Quantity", dataType: "number" as const },
];
const grouping: GroupingConfig = {
    enabled: true,
    groups: [{ field: "Year" }, { field: "Month" }],
    aggregates: [
        { field: "Sales", function: "SUM" },
        { field: "Quantity", function: "COUNT" },
    ],
    showSubtotals: true,
    showGrandTotal: true,
};

describe("reporting grid engine", () => {
    it("builds stable nested groups, subtotals, and grand totals from raw values", () => {
        const rows = [
            { Year: 2026, Month: "April", Sales: 12, Quantity: 1 },
            { Year: 2025, Month: "April", Sales: 15, Quantity: 2 },
            { Year: 2025, Month: "August", Sales: "20", Quantity: null },
            { Year: 2025, Month: "April", Sales: 25, Quantity: 3 },
        ];
        const model = buildReportingGridModel(rows, grouping, columns);
        expect(model.groups.map(group => group.value)).toEqual([2025, 2026]);
        expect(model.groups[0].children.map(group => group.label)).toEqual(["April", "August"]);
        expect(model.groups[0].children[0].aggregates).toEqual({ Sales: 40, Quantity: 2 });
        expect(model.groups[0].aggregates).toEqual({ Sales: 60, Quantity: 2 });
        expect(model.grandTotal).toEqual({ Sales: 72, Quantity: 3 });
        expect(model.groups[0].id).toContain("number%3A2025");
    });

    it("keeps null, empty, numeric, and string group values distinct", () => {
        const model = buildReportingGridModel([
            { Year: null, Sales: 1 }, { Year: "", Sales: 2 }, { Year: 1, Sales: 3 }, { Year: "1", Sales: 4 },
        ], { ...grouping, groups: [{ field: "Year" }] }, columns);
        expect(model.groups).toHaveLength(4);
        expect(model.groups.filter(group => group.label === "(Blank)")).toHaveLength(2);
        expect(new Set(model.groups.map(group => group.id)).size).toBe(4);
    });

    it("orders group fields deterministically and honors descending group sorting", () => {
        const rows = [
            { Year: 2025, Month: "April", Sales: 1 },
            { Year: 2026, Month: "August", Sales: 2 },
        ];
        const model = buildReportingGridModel(rows, grouping, columns, [{ field: "Year", direction: "DESC" }]);
        expect(model.groups.map(group => group.value)).toEqual([2026, 2025]);
    });

    it("supports SUM, COUNT, AVG, MIN, and MAX while ignoring invalid numeric values", () => {
        const rows = [
            { Sales: 0.1 }, { Sales: 0.2 }, { Sales: "2.5" }, { Sales: "invalid" }, { Sales: null }, {},
        ];
        const values = aggregateRows(rows, [
            { field: "Sales", function: "SUM", alias: "sum" },
            { field: "Sales", function: "COUNT", alias: "count" },
            { field: "Sales", function: "AVG", alias: "avg" },
            { field: "Sales", function: "MIN", alias: "min" },
            { field: "Sales", function: "MAX", alias: "max" },
        ]);
        expect(values.Sales).toBe(2.5);
        expect(aggregateRows(rows, [{ field: "Sales", function: "SUM" }]).Sales).toBe(2.8);
        expect(aggregateRows(rows, [{ field: "Sales", function: "COUNT" }]).Sales).toBe(4);
        expect(aggregateRows(rows, [{ field: "Sales", function: "AVG" }]).Sales).toBeCloseTo(2.8 / 3);
        expect(aggregateRows(rows, [{ field: "Sales", function: "MIN" }]).Sales).toBe(0.1);
        expect(aggregateRows(rows, [{ field: "Sales", function: "MAX" }]).Sales).toBe(2.5);
    });

    it("calculates a 904-record grand total independently of a ten-row page", () => {
        const rows = Array.from({ length: 904 }, (_, index) => ({ Year: 2025, Month: index < 150 ? "April" : "August", Sales: 1, Quantity: 1 }));
        const model = buildReportingGridModel(rows, grouping, columns);
        expect(model.groups[0].children[0].aggregates.Sales).toBe(150);
        expect(model.grandTotal.Sales).toBe(904);
    });

    it("creates grouped export rows without mutating ordinary source rows", () => {
        const rows = [{ Year: 2025, Month: "April", Sales: 10, Quantity: 1 }];
        const exported = buildReportingExportRows(rows, { ...grouping, exportMode: "grouped" }, columns);
        const exportedWithHeaderTotals = buildReportingExportRows(rows, { ...grouping, exportMode: "grouped", showGroupTotalsInHeader: true }, columns);
        expect(exported.some(row => row.Year === "Grand Total" && row.Sales === 10)).toBe(true);
        expect(exportedWithHeaderTotals).toEqual(exported);
        expect(rows).toEqual([{ Year: 2025, Month: "April", Sales: 10, Quantity: 1 }]);
    });
});
