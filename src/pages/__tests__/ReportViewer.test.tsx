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
    default: ({ columns, onSortChange }: {
        columns: Array<{ field: string }>;
        onSortChange?: (sort: Array<{ field: string; direction: "ASC" | "DESC" }>) => void;
    }) => <div data-testid="report-grid" data-columns={columns.map(column => column.field).join(",")}>
        <button type="button" onClick={() => onSortChange?.([{ field: "Item_Desc", direction: "DESC" }])}>
            Sort test grid
        </button>
    </div>,
}));

function renderReport(reportId = "item") {
    return render(
        <MemoryRouter initialEntries={[`/reports/${reportId}`]}>
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
    const getReportRequests = () => executeRequestMock.mock.calls
        .map(([request]) => request)
        .filter(request => request.pagination?.pageSize === 10);

    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset().mockResolvedValue({
            success: true,
            message: "ok",
            data: [{ Item_Code: "A1", Item_Desc: "Alpha", Item_MRP: 100 }],
            meta: { page: 1, pageSize: 25, totalRows: 1, rowsReturned: 1, executionTime: 2 },
        });
    });

    it("sends the normalized JSON Query request with the existing runtime state", async () => {
        renderReport();
        await screen.findByTestId("report-grid");
        const toolbar = screen.getByRole("toolbar", { name: "Report actions" });
        expect(toolbar.closest("section")?.getAttribute("aria-label")).toBe("Report results");

        fireEvent.change(screen.getByLabelText("Item Code"), { target: { value: "A1" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(getReportRequests()).toHaveLength(2));
        const request = getReportRequests().at(-1);
        expect(request).toMatchObject({
            action: "select",
            source: { table: "ItemMasterTable" },
            fields: ["Item_Code", "Item_Desc", "Item_MRP"],
            sort: [{ field: "Item_Code", direction: "ASC" }],
            pagination: { page: 1, pageSize: 10 },
        });
        expect(request.filters).toContainEqual({ field: "Item_Code", operator: "LIKE", value: "%A1%" });
        expect(JSON.stringify(request)).not.toContain("SELECT");

        fireEvent.click(screen.getByRole("button", { name: "Sort test grid" }));
        await waitFor(() => expect(getReportRequests()).toHaveLength(3));
        expect(getReportRequests().at(-1)?.sort).toEqual([
            { field: "Item_Desc", direction: "DESC" },
        ]);
        expect(screen.getByTestId("report-grid").getAttribute("data-columns"))
            .toBe("Item_Code,Item_Desc,Item_MRP");
    });

    it("loads the customer report through its configured JSON Query request", async () => {
        renderReport("customer");
        await screen.findByTestId("report-grid");
        await waitFor(() => expect(getReportRequests()).toHaveLength(1));

        expect(getReportRequests()[0]).toMatchObject({
            action: "select",
            source: { table: "CustomerTable" },
            groupBy: ["Cust_Name"],
            sort: [{ field: "Cust_Name", direction: "ASC" }],
            pagination: { page: 1, pageSize: 10 },
        });
    });

    it("renders a cached report immediately without another request", async () => {
        const first = renderReport();
        await screen.findByTestId("report-grid");
        await waitFor(() => expect(getReportRequests()).toHaveLength(1));
        first.unmount();

        renderReport();
        expect(screen.getByTestId("report-grid")).toBeTruthy();
        expect(screen.queryByText("Loading report data…")).toBeNull();
        await waitFor(() => expect(getReportRequests()).toHaveLength(1));
    });
});
