import { describe, expect, it } from "vitest";

import { formatNumberForDisplay } from "..";

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
