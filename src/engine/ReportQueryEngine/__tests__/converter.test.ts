import { describe, expect, it } from "vitest";

import { parseReportSql, toUniversalQueryRequest, UnsupportedRuntimeFilterGroupingError } from "..";

describe("SQL to Universal JSON conversion", () => {
    it("converts authored and runtime query state without exposing SQL", () => {
        const definition = parseReportSql(`
            SELECT DISTINCT TOP 20 c.Name AS Customer, COUNT(*) AS Orders
            FROM Customers AS c
            LEFT JOIN Orders AS o ON c.Id = o.CustomerId
            WHERE c.Active = TRUE
            GROUP BY c.Name
            HAVING COUNT(*) > 1
            ORDER BY c.Name ASC
        `);
        const request = toUniversalQueryRequest(definition, {
            filters: [{ field: "c.Name", operator: "LIKE", value: "%Acme%" }],
            sort: [{ field: "Orders", direction: "DESC" }],
            pagination: { page: 3, pageSize: 25 },
        });

        expect(request).toMatchObject({
            action: "select",
            source: { table: "Customers", alias: "c" },
            distinct: true,
            limit: 20,
            groupBy: ["c.Name"],
            pagination: { page: 3, pageSize: 25 },
            sort: [{ field: "Orders", direction: "DESC" }],
        });
        expect(request.filters).toHaveLength(2);
        expect(request.joins).toHaveLength(1);
        expect(request.having).toHaveLength(1);
        expect(JSON.stringify(request)).not.toContain("SELECT");
        expect(JSON.stringify(request)).not.toContain(".sql");
    });

    it("uses base sorting when runtime sorting is absent", () => {
        const request = toUniversalQueryRequest(parseReportSql("SELECT Id FROM Items ORDER BY Id DESC"));
        expect(request.sort).toEqual([{ field: "Id", direction: "DESC" }]);
    });

    it("rejects an unrepresentable base-AND-runtime-OR grouping", () => {
        const definition = parseReportSql("SELECT Id FROM Items WHERE Active = TRUE");
        expect(() => toUniversalQueryRequest(definition, {
            filters: [
                { field: "Name", operator: "=", value: "A" },
                { field: "Name", operator: "=", value: "B" },
            ],
            filterLogic: "OR",
        })).toThrow(UnsupportedRuntimeFilterGroupingError);
    });
});
