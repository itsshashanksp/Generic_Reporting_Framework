import { describe, expect, it } from "vitest";

import { applyChartTopN, mapChartData } from "../chartData";

describe("chart data presentation", () => {
    it("preserves missing values as gaps and signed numeric values", () => {
        expect(mapChartData([
            { Category: "Positive", Amount: "12.5" },
            { Category: "Negative", Amount: -4 },
            { Category: "Missing", Amount: null },
            { Category: "", Amount: "not-a-number" },
        ], "Category", "Amount")).toEqual([
            { name: "Positive", value: 12.5 },
            { name: "Negative", value: -4 },
            { name: "Missing", value: null },
            { name: "Uncategorized", value: null },
        ]);
    });

    it("ranks signed aggregates, groups duplicates, and aggregates Others without mutation", () => {
        const source = [
            { name: "A", value: 8 },
            { name: "B", value: -3 },
            { name: "A", value: 4 },
            { name: "C", value: 5 },
            { name: "D", value: -2 },
        ];
        const snapshot = structuredClone(source);
        expect(applyChartTopN(source, { topN: 2, showOthers: true, othersLabel: "Remaining" })).toEqual([
            { name: "A", value: 12 },
            { name: "C", value: 5 },
            { name: "Remaining", value: -5 },
        ]);
        expect(source).toEqual(snapshot);
    });

    it("resolves ties by first-seen order and preserves categories when Top-N is absent", () => {
        const source = [{ name: "Second", value: 10 }, { name: "First", value: 10 }];
        expect(applyChartTopN(source, { topN: 1 })).toEqual([{ name: "Second", value: 10 }]);
        expect(applyChartTopN(source)).toEqual(source);
        expect(applyChartTopN(source)).not.toBe(source);
    });
});
