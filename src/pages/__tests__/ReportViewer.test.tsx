import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { FilterProvider } from "../../engine/FilterContext";
import { GridProvider } from "../../engine/GridContext";
import { clearRequestCache } from "../../engine/RequestCache";
import ReportViewer from "../ReportViewer";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));

vi.mock("../../api/request", () => ({
    executeRequest: executeRequestMock,
    getRequestErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Request failed",
    isRequestAbort: () => false,
}));

vi.mock("../../components/Grid/GenericGrid", () => ({
    default: () => <div data-testid="report-grid" />,
}));

function renderReport() {
    return render(
        <MemoryRouter initialEntries={["/reports/item"]}>
            <GridProvider>
                <FilterProvider>
                    <Routes>
                        <Route path="/reports/:reportId" element={<ReportViewer />} />
                    </Routes>
                </FilterProvider>
            </GridProvider>
        </MemoryRouter>
    );
}

describe("ReportViewer runtime", () => {
    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset().mockResolvedValue({
            success: true,
            message: "ok",
            data: [{ Item_Code: "A1", Item_Desc: "Alpha", Item_MRP: 100 }],
            meta: { page: 1, pageSize: 25, totalRows: 1, rowsReturned: 1, executionTime: 2 },
        });
    });

    it("keeps the toolbar inside the report card and builds runtime filters", async () => {
        renderReport();
        await screen.findByTestId("report-grid");
        const toolbar = screen.getByRole("toolbar", { name: "Report actions" });
        expect(toolbar.closest("section")?.getAttribute("aria-label")).toBe("Report results");

        fireEvent.change(screen.getByLabelText("Item Code"), { target: { value: "A1" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(2));
        const request = executeRequestMock.mock.calls.at(-1)?.[0];
        expect(request).toMatchObject({
            action: "select",
            source: { table: "ItemMasterTable" },
            pagination: { page: 1, pageSize: 25 },
        });
        expect(request.filters).toContainEqual({ field: "Item_Code", operator: "LIKE", value: "%A1%" });
        expect(JSON.stringify(request)).not.toContain("SELECT");
    });

    it("renders a cached report immediately without another request", async () => {
        const first = renderReport();
        await screen.findByTestId("report-grid");
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(1));
        first.unmount();

        renderReport();
        expect(screen.getByTestId("report-grid")).toBeTruthy();
        expect(screen.queryByText("Loading report data…")).toBeNull();
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(1));
    });
});
