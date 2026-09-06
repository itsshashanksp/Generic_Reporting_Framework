import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DateRangeFilter from "../../../components/Filters/Fields/DateRangeFilter";
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
});
