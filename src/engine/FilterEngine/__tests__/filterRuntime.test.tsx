import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DateRangeFilter from "../../../components/Filters/Fields/DateRangeFilter";
import BooleanFilter from "../../../components/Filters/Fields/BooleanFilter";
import { FilterProvider, useFilters } from "../../FilterContext";
import { buildFilters } from "../../FilterQueryBuilder";
import { isEmptyFilterValue } from "../filterValue";
import type { FilterDefinition } from "../../../types/filter";

const definition: FilterDefinition = {
    field: "StDate",
    label: "Start Date",
    type: "daterange",
    operator: "between",
    required: true,
};

function StateProbe() {
    const { filters } = useFilters();
    return <output data-testid="state">{JSON.stringify(filters.StDate)}</output>;
}

function BooleanStateProbe() {
    const { filters } = useFilters();
    return <output data-testid="boolean-state">{String(filters.Active)}</output>;
}

describe("date-range runtime filtering", () => {
    it.each([
        [["2026-09-01", ""], false, [{ field: "StDate", operator: ">=", value: "2026-09-01" }]],
        [["", "2026-09-05"], false, [{ field: "StDate", operator: "<=", value: "2026-09-05" }]],
        [["2026-09-01", "2026-09-05"], false, [{ field: "StDate", operator: "BETWEEN", value: ["2026-09-01", "2026-09-05"] }]],
        [["", ""], true, []],
    ])("maps endpoints %j on the same StDate field", (value, empty, expected) => {
        expect(isEmptyFilterValue(value)).toBe(empty);
        expect(buildFilters({ StDate: value }, [definition])).toEqual(expected);
    });

    it("stores a partial range from the UI without requiring both endpoints", () => {
        render(
            <FilterProvider>
                <DateRangeFilter field="StDate" label="Start Date" required />
                <StateProbe />
            </FilterProvider>
        );

        const start = screen.getByLabelText("Start Date start");
        const end = screen.getByLabelText("Start Date end");
        expect(start.hasAttribute("required")).toBe(false);
        expect(end.hasAttribute("required")).toBe(false);
        fireEvent.change(start, { target: { value: "2026-09-01" } });
        expect(screen.getByTestId("state").textContent).toBe('["2026-09-01",""]');
    });

    it("preserves existing text filter conversion", () => {
        expect(buildFilters({ Name: "Acme" }, [{ field: "Name", label: "Name", type: "text", operator: "contains" }]))
            .toEqual([{ field: "Name", operator: "LIKE", value: "%Acme%" }]);
    });

    it("serializes NOT LIKE variants, numeric values, booleans, and null checks", () => {
        expect(buildFilters(
            { Name: "Acme", Amount: ["10", "20"], Active: false, DeletedAt: true },
            [
                { field: "Name", label: "Name", type: "text", operator: "notContains" },
                { field: "Amount", label: "Amount", type: "number", operator: "between" },
                { field: "Active", label: "Active", type: "boolean", operator: "equals" },
                { field: "DeletedAt", label: "Deleted", type: "date", operator: "isNull" },
            ]
        )).toEqual([
            { field: "Name", operator: "NOT LIKE", value: "%Acme%" },
            { field: "Amount", operator: "BETWEEN", value: [10, 20] },
            { field: "Active", operator: "=", value: false },
            { field: "DeletedAt", operator: "IS NULL" },
        ]);
    });

    it("does not send a non-finite numeric filter value", () => {
        expect(buildFilters(
            { Amount: "not-a-number" },
            [{ field: "Amount", label: "Amount", type: "number", operator: "greaterThan" }]
        )).toEqual([]);
    });

    it("keeps boolean filter values typed", () => {
        render(
            <FilterProvider>
                <BooleanFilter field="Active" label="Active" />
                <BooleanStateProbe />
            </FilterProvider>
        );

        fireEvent.change(screen.getByLabelText("Active"), { target: { value: "false" } });
        expect(screen.getByTestId("boolean-state").textContent).toBe("false");
    });
});
