import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FilterProvider, useFilters } from "../../../engine/FilterContext";
import { clearRequestCache } from "../../../engine/RequestCache";
import type { DynamicFilterOptions } from "../../../types/filter";
import SelectFilter from "../Fields/SelectFilter";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));

vi.mock("../../../api/request", () => ({
    executeRequest: executeRequestMock,
    getRequestErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Request failed",
    isRequestAbort: (error: unknown) => error instanceof Error && error.name === "AbortError",
}));

const dynamicOptions: DynamicFilterOptions = {
    request: {
        action: "select",
        source: { table: "Inventory" },
        fields: [
            "Category",
            { function: "COUNT", field: "*", alias: "Frequency" },
        ],
        groupBy: ["Category"],
        sort: [{ field: "Frequency", direction: "DESC" }],
        limit: 100,
    },
    valueField: "Category",
    countField: "Frequency",
    searchable: true,
};

function StateProbe() {
    const { filters } = useFilters();
    return <output data-testid="filter-state">{String(filters.Category ?? "")}</output>;
}

describe("dynamic select filters", () => {
    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset();
    });

    it("loads frequency-sorted values, searches them, and uses existing filter state", async () => {
        executeRequestMock.mockResolvedValue({
            success: true,
            message: "ok",
            data: [
                { Category: "Rare", Frequency: 2 },
                { Category: "Common", Frequency: 1200 },
                { Category: "Regular", Frequency: 40 },
            ],
            meta: { page: null, pageSize: null, totalRows: 3, rowsReturned: 3, executionTime: 1 },
        });

        render(
            <FilterProvider>
                <SelectFilter field="Category" label="Category" dynamicOptions={dynamicOptions} />
                <StateProbe />
            </FilterProvider>
        );

        await waitFor(() => expect(screen.getByRole("option", { name: "Common (1,200)" })).toBeTruthy());
        const options = screen.getAllByRole("option").map(option => option.textContent);
        expect(options).toEqual(["Select", "Common (1,200)", "Regular (40)", "Rare (2)"]);
        expect(executeRequestMock).toHaveBeenCalledWith(dynamicOptions.request, expect.objectContaining({ signal: expect.any(AbortSignal) }));

        fireEvent.change(screen.getByRole("searchbox", { name: "Search Category" }), { target: { value: "reg" } });
        expect(screen.queryByRole("option", { name: "Common (1,200)" })).toBeNull();
        fireEvent.change(screen.getByLabelText("Category"), { target: { value: "string:Regular" } });
        expect(screen.getByTestId("filter-state").textContent).toBe("Regular");
    });

    it("reuses the request cache across filter instances", async () => {
        executeRequestMock.mockResolvedValue({ success: true, message: "ok", data: [{ Category: "A", Frequency: 1 }] });
        const first = render(<FilterProvider><SelectFilter field="Category" label="Category" dynamicOptions={dynamicOptions} /></FilterProvider>);
        await screen.findByRole("option", { name: "A (1)" });
        first.unmount();
        render(<FilterProvider><SelectFilter field="Category" label="Category" dynamicOptions={dynamicOptions} /></FilterProvider>);
        await screen.findByRole("option", { name: "A (1)" });
        expect(executeRequestMock).toHaveBeenCalledTimes(1);
    });
});
