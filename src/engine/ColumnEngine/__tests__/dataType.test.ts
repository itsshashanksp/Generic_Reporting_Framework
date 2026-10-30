import { describe, expect, it } from "vitest";

import { inferColumnDataType } from "../dataType";

describe("semantic column inference", () => {
    it.each([
        "Sale_Rate", "Item_MRP", "StockValue", "stock_value", "SalesAmount",
        "PurchaseAmount", "TotalAmount", "MinimumSP", "MaximumSP",
    ])("infers unambiguous monetary field %s", field => {
        expect(inferColumnDataType(field)).toBe("currency");
    });

    it.each(["GSTPercentage", "Tax_Percent", "DiscountPct"])("infers percentage field %s", field => {
        expect(inferColumnDataType(field)).toBe("percentage");
    });

    it.each(["Item_Code", "TotalItems", "Quantity", "ClosingStock", "Std_Vat", "InterestRate", "TrackingNumber"])("does not guess ambiguous field %s", field => {
        expect(inferColumnDataType(field)).toBeUndefined();
    });
});
