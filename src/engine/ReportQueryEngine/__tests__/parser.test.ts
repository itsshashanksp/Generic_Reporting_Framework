import { describe, expect, it } from "vitest";

import { parseReportSql, ReportSqlParserError } from "../parser";

describe("report SQL parser supported contract", () => {
    it("parses selection, modifiers, aliases and qualified fields", () => {
        expect(parseReportSql("SELECT * FROM Items").fields).toEqual(["*"]);
        expect(parseReportSql("SELECT DISTINCT TOP 5 i.Code AS ItemCode FROM Items AS i")).toMatchObject({
            source: { table: "Items", alias: "i" },
            fields: [{ field: "i.Code", alias: "ItemCode" }],
            distinct: true,
            limit: 5,
        });
    });

    it("parses aggregates, grouping and HAVING", () => {
        const query = parseReportSql(`
            SELECT Category, COUNT(*) AS CountRows, SUM(Amount) AS Total,
                AVG(Amount) AS Average, MIN(Amount) AS Minimum, MAX(Amount) AS Maximum
            FROM Sales GROUP BY Category HAVING SUM(Amount) >= 100
        `);
        expect(query.fields).toHaveLength(6);
        expect(query.groupBy).toEqual(["Category"]);
        expect(query.having).toEqual([{ function: "SUM", field: "Amount", operator: ">=", value: 100 }]);
    });

    it.each([
        ["=", 1], ["!=", 1], ["<>", 1], [">", 1], ["<", 1], [">=", 1], ["<=", 1],
        ["LIKE", "A%"], ["NOT LIKE", "A%"],
    ])("parses WHERE %s", (operator, value) => {
        const literal = typeof value === "string" ? `'${value}'` : value;
        expect(parseReportSql(`SELECT Id FROM Items WHERE Value ${operator} ${literal}`).baseFilters?.[0])
            .toEqual({ field: "Value", operator, value });
    });

    it.each([
        ["IN (1, 2)", "IN", [1, 2]],
        ["NOT IN ('A', 'B')", "NOT IN", ["A", "B"]],
        ["BETWEEN 1 AND 5", "BETWEEN", [1, 5]],
        ["NOT BETWEEN 1 AND 5", "NOT BETWEEN", [1, 5]],
        ["IS NULL", "IS NULL", undefined],
        ["IS NOT NULL", "IS NOT NULL", undefined],
    ])("parses WHERE %s", (predicate, operator, value) => {
        const condition = parseReportSql(`SELECT Id FROM Items WHERE Value ${predicate}`).baseFilters?.[0];
        expect(condition).toEqual(value === undefined
            ? { field: "Value", operator }
            : { field: "Value", operator, value });
    });

    it("parses arithmetic, CASE, scalar/date/math functions and STRING_AGG", () => {
        const query = parseReportSql(`
            SELECT Price * Quantity AS Total,
                CASE WHEN Amount >= 100 THEN 'High' ELSE 'Low' END AS Band,
                UPPER(Name) AS UpperName, YEAR(CreatedAt) AS CreatedYear,
                ABS(Balance) AS AbsoluteBalance, ROUND(Amount, 2) AS Rounded,
                STRING_AGG(Name, ',') AS Names
            FROM Sales
        `);
        expect(query.fields).toHaveLength(7);
        expect(query.fields).toEqual(expect.arrayContaining([
            expect.objectContaining({ alias: "Total" }),
            expect.objectContaining({ function: "UPPER", field: "Name" }),
            expect.objectContaining({ function: "YEAR", field: "CreatedAt" }),
            expect.objectContaining({ function: "STRING_AGG", separator: "," }),
        ]));
    });

    it("parses supported joins and static sorting", () => {
        const query = parseReportSql(`
            SELECT i.Id, c.Name, r.Region
            FROM Items AS i
            INNER JOIN Customers AS c ON i.CustomerId = c.Id
            LEFT JOIN Regions AS r ON c.RegionId = r.Id
            RIGHT JOIN Territories AS t ON r.TerritoryId = t.Id
            ORDER BY c.Name ASC, i.Id DESC
        `);
        expect(query.joins?.map(join => join.type)).toEqual(["INNER", "LEFT", "RIGHT"]);
        expect(query.baseSort).toEqual([
            { field: "c.Name", direction: "ASC" },
            { field: "i.Id", direction: "DESC" },
        ]);
    });

    it.each(["ROW_NUMBER", "RANK", "DENSE_RANK"])('parses %s windows', functionName => {
        const field = parseReportSql(`SELECT ${functionName}() OVER (ORDER BY Id) AS Position FROM Items`).fields[0];
        expect(field).toMatchObject({ function: functionName, alias: "Position" });
    });

    it.each([
        ["NTILE(4)", { buckets: 4 }],
        ["LAG(Amount, 1, 0)", { field: "Amount", offset: 1, default: 0 }],
        ["LEAD(Amount)", { field: "Amount" }],
        ["FIRST_VALUE(Amount)", { field: "Amount" }],
        ["LAST_VALUE(Amount)", { field: "Amount" }],
    ])("parses %s windows", (expression, expected) => {
        expect(parseReportSql(`SELECT ${expression} OVER (ORDER BY Id DESC) AS WindowValue FROM Items`).fields[0])
            .toMatchObject(expected);
    });
});

describe("report SQL parser validation", () => {
    it.each([
        ["SELECT i.Id FROM Items AS i FULL JOIN Other AS o ON i.Id = o.Id", "UNSUPPORTED_JOIN_TYPE"],
        ["SELECT i.Id FROM Items AS i CROSS JOIN Other AS o", "UNSUPPORTED_JOIN_TYPE"],
        ["SELECT i.Id FROM Items AS i NATURAL JOIN Other AS o", "UNSUPPORTED_JOIN_TYPE"],
        ["SELECT i.Id FROM Items AS i JOIN Other AS o USING (Id)", "INVALID_JOIN"],
        ["SELECT i.Id FROM Items AS i JOIN Other AS o ON i.Id > o.Id", "INVALID_JOIN"],
        ["SELECT Id FROM Items WHERE A = 1 OR B = 2", "UNSUPPORTED_SQL_FEATURE"],
        ["WITH q AS (SELECT Id FROM Items) SELECT Id FROM q", "UNSUPPORTED_SQL_FEATURE"],
        ["SELECT Id FROM Items UNION SELECT Id FROM Other", "UNSUPPORTED_SQL_FEATURE"],
        ["SELECT (SELECT Id FROM Other) AS Value FROM Items", "UNSUPPORTED_SQL_FEATURE"],
        ["SELECT bad-name FROM Items", "INVALID_IDENTIFIER"],
        ["SELECT Amount + 1 FROM Items", "INVALID_SELECT_EXPRESSION"],
        ["SELECT Id FROM", "INVALID_FROM_CLAUSE"],
        ["SELECT Id FROM Items WHERE Value = nope", "INVALID_LITERAL"],
        ["SELECT Id FROM Items WHERE bad-name = 1", "INVALID_IDENTIFIER"],
        ["SELECT Id FROM Items WHERE (Value = 1)", "INVALID_IDENTIFIER"],
        ["SELECT ROW_NUMBER() OVER (PARTITION BY GroupId ORDER BY Id) AS RowNo FROM Items", "UNSUPPORTED_SQL_FEATURE"],
    ])("rejects unsupported SQL with a typed error: %s", (sql, code) => {
        try {
            parseReportSql(sql);
            throw new Error("Expected parsing to fail");
        } catch (error) {
            expect(error).toBeInstanceOf(ReportSqlParserError);
            expect((error as ReportSqlParserError).code).toBe(code);
        }
    });
});
