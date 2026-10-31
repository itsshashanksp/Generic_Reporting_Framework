import { describe, expect, it } from "vitest";

import { applyChartTopN, buildChartPresentation, describeChartData, formatChartCategoryLabel, formatChartLabel, formatChartNumber, formatChartPercentage, formatChartTooltipValue, getChartOverflowLayout, getChartValueDomain, getHorizontalBarChartHeight, getHorizontalCategoryAxisWidth, getVisiblePieLabelIndexes, mapChartData, resolveChartLabelVisibility } from "../chartData";

describe("chart data presentation", () => {
    it("formats chart values without changing their numeric precision", () => {
        expect(formatChartNumber(12908199.939999992)).toBe("1.29 Cr");
        expect(formatChartNumber(4235826.41)).toBe("42.36 L");
        expect(formatChartNumber(2500000)).toBe("25 L");
        expect(formatChartNumber(12500)).toBe("12.5 K");
        expect(formatChartNumber(950)).toBe("950");
        expect(formatChartNumber(-12500)).toBe("-12.5 K");
        expect(formatChartNumber(0)).toBe("0");
        expect(formatChartNumber(0.1254)).toBe("0.1254");
        expect(formatChartNumber(null)).toBe("—");
        expect(formatChartTooltipValue(12908199.939999992)).toBe("1,29,08,199.94");
        expect(formatChartNumber(42010000, { numberFormat: "compact-indian" })).toBe("4.2 Cr");
        expect(formatChartNumber(6020000, { numberFormat: "compact-indian" })).toBe("60.2 L");
        expect(formatChartNumber(12910000, { numberFormat: "full" })).toBe("1,29,10,000");
        expect(formatChartTooltipValue(12910000, { valueFormat: "currency" })).toBe("₹1,29,10,000.00");
        expect(formatChartLabel(6024000, { valueFormat: "currency" })).toBe("₹60.24\u00a0L");
        expect(formatChartLabel(12900000, { valueFormat: "currency" })).toBe("₹1.29\u00a0Cr");
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

    it("describes proportional values with full values and safe percentages", () => {
        const data = [{ name: "A", value: 7 }, { name: "B", value: 3 }];
        expect(formatChartPercentage(7, 10)).toBe("70%");
        expect(formatChartPercentage(-1, 10)).toBeNull();
        expect(formatChartPercentage(0, 0)).toBeNull();
        expect(describeChartData(data, undefined, true)).toBe("A: 7 (70%); B: 3 (30%)");
        expect(buildChartPresentation(data, undefined, true)).toEqual([
            { category: "A", originalValue: 7, formattedValue: "7", percentage: "70%" },
            { category: "B", originalValue: 3, formattedValue: "3", percentage: "30%" },
        ]);
    });

    it("resolves universal label defaults without overriding explicit authored flags", () => {
        expect(resolveChartLabelVisibility("bar", 50)).toBe(true);
        expect(resolveChartLabelVisibility("line", 8)).toBe(true);
        expect(resolveChartLabelVisibility("line", 9)).toBe(false);
        expect(resolveChartLabelVisibility("pie", 20)).toBe(true);
        expect(resolveChartLabelVisibility("bar", 5, { showLabels: false })).toBe(false);
        expect(resolveChartLabelVisibility("bar", 5, { showDataLabels: false }, true)).toBe(false);
        expect(resolveChartLabelVisibility("bar", 5, undefined, false)).toBe(false);
    });

    it("reserves bounded numeric-domain headroom for positive, signed, negative, and zero values", () => {
        expect(getChartValueDomain([{ name: "High", value: 100 }], true)).toEqual([0, 112]);
        expect(getChartValueDomain([{ name: "Loss", value: -100 }], true)).toEqual([-112, 0]);
        expect(getChartValueDomain([{ name: "Loss", value: -50 }, { name: "Gain", value: 100 }], true)).toEqual([-68, 118]);
        expect(getChartValueDomain([{ name: "Zero", value: 0 }], true)).toEqual([0, 1]);
        expect(getChartValueDomain([{ name: "High", value: 100 }], false)).toEqual([0, 100]);
    });

    it("allocates readable horizontal bar space for category count and long names", () => {
        expect(getHorizontalBarChartHeight(2)).toBe(260);
        expect(getHorizontalBarChartHeight(12)).toBe(508);
        expect(getHorizontalCategoryAxisWidth([{ name: "Short", value: 1 }])).toBe(110);
        expect(getHorizontalCategoryAxisWidth([{ name: "A very long category name that needs room", value: 1 }])).toBe(190);
    });

    it("selects bounded overflow only when cartesian categories need it", () => {
        const few = Array.from({ length: 5 }, (_, index) => ({ name: `Category ${index}`, value: index }));
        const many = Array.from({ length: 12 }, (_, index) => ({ name: `Long enterprise category ${index}`, value: index }));

        expect(getChartOverflowLayout("bar", "vertical", few)).toEqual({ axis: "none" });
        expect(getChartOverflowLayout("bar", "vertical", many)).toMatchObject({ axis: "horizontal" });
        expect(getChartOverflowLayout("line", "vertical", many).minimumWidth).toBeGreaterThan(600);
        expect(getChartOverflowLayout("bar", "horizontal", many)).toEqual({ axis: "vertical", minimumHeight: 508 });
        expect(getChartOverflowLayout("pie", "vertical", many)).toEqual({ axis: "none" });
        expect(formatChartCategoryLabel("A deliberately long category", 12)).toBe("A deliberat…");
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
