import { describe, expect, it } from "vitest";

import { compareGridValues } from "../sorting";

const ascendingNumber = (left: unknown, right: unknown) => compareGridValues(left, right, "number");
const descendingNumber = (left: unknown, right: unknown) => -compareGridValues(left, right, "number");

describe("compareGridValues", () => {
    it("sorts numeric values and numeric strings numerically", () => {
        expect([10, 2, 1, 3].sort(ascendingNumber)).toEqual([1, 2, 3, 10]);
        expect(["10", "2", "1"].sort(ascendingNumber)).toEqual(["1", "2", "10"]);
        expect(["1", "2", "3", "10"].sort(descendingNumber)).toEqual(["10", "3", "2", "1"]);
    });

    it("sorts decimal and negative numeric values numerically", () => {
        expect([10.5, 1.5, 1.25].sort(ascendingNumber)).toEqual([1.25, 1.5, 10.5]);
        expect([0, -2, 5, -10].sort(ascendingNumber)).toEqual([-10, -2, 0, 5]);
    });

    it("places null and empty numeric values after populated values", () => {
        expect([null, "", "10", "2"].sort(ascendingNumber)).toEqual(["2", "10", null, ""]);
    });

    it("keeps text columns lexicographic even when their values contain digits", () => {
        expect(["2", "10", "1"].sort((left, right) => compareGridValues(left, right, "text")))
            .toEqual(["1", "10", "2"]);
    });

    it("preserves ISO date ordering", () => {
        expect(["2024-10-01", "2024-01-15", "2024-03-01"].sort(
            (left, right) => compareGridValues(left, right, "date"),
        )).toEqual(["2024-01-15", "2024-03-01", "2024-10-01"]);
    });
});
