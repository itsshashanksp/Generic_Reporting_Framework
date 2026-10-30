import { describe, expect, it } from "vitest";

import { unknownPropertyMessage } from "../configurationValidation";

describe("configuration validation messages", () => {
    it("suggests a close canonical property for likely typos", () => {
        expect(unknownPropertyMessage("Report grid grouping", "showSubTotal", ["showSubtotals", "showGrandTotal"]))
            .toBe('Report grid grouping contains unknown property "showSubTotal". Did you mean "showSubtotals"?');
    });

    it("does not guess when an unknown property is unrelated", () => {
        expect(unknownPropertyMessage("Report", "customExtension", ["id", "title"]))
            .toBe('Report contains unknown property "customExtension".');
    });
});
