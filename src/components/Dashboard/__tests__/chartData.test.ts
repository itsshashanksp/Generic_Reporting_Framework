import { describe, expect, it } from "vitest";

import { applyChartTopN, formatChartNumber, formatChartTooltipValue, getVisiblePieLabelIndexes, mapChartData } from "../chartData";

describe("chart data presentation", () => {
    it("formats chart values without changing their numeric precision", () => {
        expect(formatChartNumber(12908199.939999992)).toBe("12.91M");
        expect(formatChartNumber(4235826.41)).toBe("4.24M");
        expect(formatChartNumber(2500000)).toBe("2.5M");
        expect(formatChartNumber(12500)).toBe("12.5K");
        expect(formatChartNumber(950)).toBe("950");
        expect(formatChartNumber(-12500)).toBe("-12.5K");
        expect(formatChartNumber(0)).toBe("0");
        expect(formatChartNumber(0.1254)).toBe("0.13");
        expect(formatChartNumber(null)).toBe("—");
        expect(formatChartTooltipValue(12908199.939999992)).toBe("12,908,199.94");
    });

    it("suppresses colliding and tiny pie labels as the available radius shrinks", () => {
        const crowded = Array.from({ length: 12 }, (_, index) => ({ name: String(index), value: index === 0 ? 80 : 1 }));
        const narrow = getVisiblePieLabelIndexes(crowded, 60);
        const wide = getVisiblePieLabelIndexes(crowded, 180);

        expect(narrow.has(0)).toBe(true);
        expect(narrow.size).toBeLessThan(crowded.length);
        expect(wide.size).toBeGreaterThanOrEqual(narrow.size);
        expect(getVisiblePieLabelIndexes([{ name: "Zero", value: 0 }], 100).size).toBe(0);
    });

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
