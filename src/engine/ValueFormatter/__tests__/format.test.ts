import { describe, expect, it } from "vitest";

import { formatCurrencyForDisplay, formatNumberForDisplay, formatValueForDisplay } from "..";

describe("formatNumberForDisplay", () => {
    it.each([
        [0, "0"],
        [42, "42"],
        [-12.5, "-12.5"],
        [0.3, "0.3"],
        [0.30000000000000004, "0.3"],
        [12.199999999999998, "12.2"],
        [18.000000000000004, "18"],
        [1234567890, "1,23,45,67,890"],
    ])("formats %s as %s", (value, expected) => {
        expect(formatNumberForDisplay(value)).toBe(expected);
    });

    it("keeps non-finite values representable", () => {
        expect(formatNumberForDisplay(Number.NaN)).toBe("NaN");
        expect(formatNumberForDisplay(Number.POSITIVE_INFINITY)).toBe("Infinity");
    });
});

describe("formatValueForDisplay", () => {
    it("renders only null as an em dash", () => {
        expect(formatValueForDisplay(null)).toBe("—");
        expect(formatValueForDisplay(0)).toBe("0");
        expect(formatValueForDisplay(false)).toBe("false");
        expect(formatValueForDisplay("")).toBe("");
        expect(formatValueForDisplay("ABC")).toBe("ABC");
    });

    it.each([
        ["12509.549999999999", "12,509.55"],
        ["4208.449999999998", "4,208.45"],
        ["7813.800000000002", "7,813.8"],
    ])("formats configured numeric string %s as %s", (value, expected) => {
        expect(formatValueForDisplay(value, "number")).toBe(expected);
    });

    it.each([
        [190, "₹190.00"],
        [2850, "₹2,850.00"],
        [95.5, "₹95.50"],
        [1234.567, "₹1,234.57"],
        [-1520, "-₹1,520.00"],
        ["1200", "₹1,200.00"],
        [0, "₹0.00"],
    ])("formats currency value %s with exactly two decimals", (value, expected) => {
        expect(formatValueForDisplay(value, "currency")).toBe(expected);
    });

    it("uses Indian lakh and crore notation without changing the numeric value", () => {
        expect(formatCurrencyForDisplay(125000)).toBe("₹1.25 L");
        expect(formatCurrencyForDisplay(12500000)).toBe("₹1.25 Cr");
        expect(formatCurrencyForDisplay(-125000)).toBe("-₹1.25 L");
        expect(formatCurrencyForDisplay(125000, "standard")).toBe("₹1,25,000.00");
        expect(formatCurrencyForDisplay(2500, "compact-indian", "USD")).toBe("$2,500.00");
        expect(formatValueForDisplay(2500, "currency", "EUR")).toBe("€2,500.00");
    });

    it("formats percentage numbers and numeric SQL strings", () => {
        expect(formatValueForDisplay(18, "percentage")).toBe("18.00%");
        expect(formatValueForDisplay("12.5", "percentage")).toBe("12.50%");
    });

    it("handles empty and invalid currency values without NaN or Infinity formatting", () => {
        expect(formatValueForDisplay(null, "currency")).toBe("—");
        expect(formatValueForDisplay(undefined, "currency")).toBe("");
        expect(formatValueForDisplay("", "currency")).toBe("");
        expect(formatValueForDisplay("not-a-number", "currency")).toBe("not-a-number");
    });

    it.each(["7019901585", "7259381613", "ABC123"])(
        "preserves untyped/text value %s",
        value => {
            expect(formatValueForDisplay(value)).toBe(value);
            expect(formatValueForDisplay(value, "text")).toBe(value);
        }
    );

    it.each([
        ["2021-04-01", "date", "01 Apr 2021"],
        ["2021-04-01T14:30:45", "datetime", "01 Apr 2021, 14:30:45"],
        ["2021-04-01T23:30:00Z", "datetime", "01 Apr 2021, 23:30:00"],
        ["2021-04-01T23:30:00+05:30", "datetime", "01 Apr 2021, 23:30:00"],
        ["2021-04-01", "datetime", "01 Apr 2021"],
    ] as const)("formats configured %s %s values without timezone conversion", (value, dataType, expected) => {
        expect(formatValueForDisplay(value, dataType)).toBe(expected);
    });

    it("preserves invalid or non-ISO date text and null presentation", () => {
        expect(formatValueForDisplay("not-a-date", "date")).toBe("not-a-date");
        expect(formatValueForDisplay("2021-02-30", "date")).toBe("2021-02-30");
        expect(formatValueForDisplay(null, "datetime")).toBe("—");
    });
});
