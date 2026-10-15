import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import itemDashboard from "../../config/dashboards/item.json";
import purchaseDashboard from "../../config/dashboards/purchases.json";
import { FilterProvider } from "../../engine/FilterContext";
import { clearRequestCache } from "../../engine/RequestCache";
import Dashboard from "../Dashboard";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    executeRequest: executeRequestMock,
}));

vi.mock("../../components/Grid/GenericGrid", () => ({
    default: () => <div data-testid="table-grid" />,
}));

const GATE = "Enter Start Date (start and end dates) and choose Search to load this dashboard.";
const INCOMPLETE = "Complete the required filter: Start Date (start and end dates).";

type SentRequest = { resource: string; filters: { field: string; operator: string; value: unknown }[] };
const sentRequests = () => executeRequestMock.mock.calls.map(call => call[0] as SentRequest);
const exportMenus = () => screen.queryAllByRole("button").filter(button => button.getAttribute("aria-haspopup") === "menu");

function renderBill() {
    render(<FilterProvider><Dashboard dashboardId="bill-dashboard" /></FilterProvider>);
}

function search(start: string, end: string) {
    fireEvent.change(screen.getByLabelText("Start Date start"), { target: { value: start } });
    fireEvent.change(screen.getByLabelText("Start Date end"), { target: { value: end } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
}

async function loadFullRange(start = "2021-04-01", end = "2022-03-31") {
    search(start, end);
    await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(7));
    await waitFor(() => expect(screen.getAllByTestId("table-grid")).toHaveLength(5));
}

describe("Bill dashboard required date range", () => {
    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset().mockResolvedValue({
            success: true,
            message: "ok",
            data: [{ Month: "04", Category: "A", Sales: 2, Purchases: 1, TotalSales: 3, TotalPurchases: 4 }],
            meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
        });
    });

    it("sends no report request, refresh or export before a range is searched", () => {
        renderBill();

        expect(screen.getByRole("status").textContent).toBe(GATE);
        expect(screen.queryByTestId("table-grid")).toBeNull();
        expect(exportMenus()).toHaveLength(0);
        expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(true);
        expect(executeRequestMock).not.toHaveBeenCalled();
    });

    it.each([
        ["no dates", "", ""],
        ["only a start date", "2021-04-01", ""],
        ["only an end date", "", "2022-03-31"],
    ])("refuses %s with an accessible message and keeps the form editable", (_name, start, end) => {
        renderBill();
        search(start, end);

        expect(screen.getByRole("alert").textContent).toBe(INCOMPLETE);
        expect(screen.getByRole("status").textContent).toBe(GATE);
        expect(executeRequestMock).not.toHaveBeenCalled();
        expect((screen.getByLabelText("Start Date start") as HTMLInputElement).value).toBe(start);
        expect((screen.getByLabelText("Start Date end") as HTMLInputElement).value).toBe(end);
        expect((screen.getByLabelText("Start Date start") as HTMLInputElement).disabled).toBe(false);
    });

    it("loads all seven widgets with the mapped field and the full range", async () => {
        renderBill();
        await loadFullRange();

        expect(screen.queryByRole("alert")).toBeNull();
        expect(Object.fromEntries(sentRequests().map(request => [request.resource, request.filters]))).toEqual(
            Object.fromEntries([
                ["widgets/bill-sales-month-wise", "Bill_Date"],
                ["widgets/bill-purchases-month-wise", "GIN_Date"],
                ["widgets/bill-top-10-categories", "Bill_Date"],
                ["widgets/bill-top-10-month-wise-category-wise", "Bill_Date"],
                ["widgets/bill-category-sales-month-wise", "Bill_Date"],
                ["widgets/bill-total-sales", "Bill_Date"],
                ["widgets/bill-total-purchases", "GIN_Date"],
            ].map(([resource, field]) => [resource, [{ field, type: "daterange", operator: "BETWEEN", value: ["2021-04-01", "2022-03-31"] }]]))
        );
    });

    it.each([
        ["a start date only", "2022-04-01", ""],
        ["an end date only", "", "2023-03-31"],
    ])("removes earlier results and export when the range changes to %s", async (_name, start, end) => {
        renderBill();
        await loadFullRange();
        expect(exportMenus().length).toBeGreaterThan(0);

        search(start, end);

        expect(screen.getByRole("alert").textContent).toBe(INCOMPLETE);
        expect(screen.getByRole("status").textContent).toBe(GATE);
        expect(screen.queryByTestId("table-grid")).toBeNull();
        expect(exportMenus()).toHaveLength(0);
        expect(executeRequestMock).toHaveBeenCalledTimes(7);
    });

    it("removes results when the filters are cleared and loads again for a new full range", async () => {
        renderBill();
        await loadFullRange();

        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
        expect(screen.getByRole("status").textContent).toBe(GATE);
        expect(screen.queryByTestId("table-grid")).toBeNull();
        expect(executeRequestMock).toHaveBeenCalledTimes(7);

        search("2022-04-01", "2023-03-31");
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(14));
        expect(sentRequests().slice(7).every(request =>
            JSON.stringify(request.filters[0].value) === JSON.stringify(["2022-04-01", "2023-03-31"]))).toBe(true);
    });

    it("loads an optional date-filter dashboard immediately without a date filter", async () => {
        expect(purchaseDashboard.dateFilterBehavior).toBe("optional");
        expect(purchaseDashboard.filters.some(filter => filter.type === "daterange" && !("required" in filter))).toBe(true);
        render(<FilterProvider><Dashboard dashboardId="purchase-dashboard" /></FilterProvider>);

        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(purchaseDashboard.widgets.length));
        expect(screen.queryByText(/choose Search to load this dashboard/)).toBeNull();
        expect(sentRequests().every(request => request.filters.length === 0)).toBe(true);
    });

    it("keeps loading a dashboard that omits dateFilterBehavior and has no required filter", async () => {
        expect("dateFilterBehavior" in itemDashboard).toBe(false);
        expect(itemDashboard.filters.some(filter => "required" in filter)).toBe(false);
        render(<FilterProvider><Dashboard dashboardId="item-dashboard" /></FilterProvider>);

        // Widget data requests only; the filter panel also loads select options.
        const widgetResources = new Set(itemDashboard.widgets.map(widget => widget.queryDefinition.resource));
        const widgetRequests = () => sentRequests().filter(request => widgetResources.has(request.resource));
        await waitFor(() => expect(new Set(widgetRequests().map(request => request.resource))).toEqual(widgetResources));
        expect(screen.queryByText(/choose Search to load this dashboard/)).toBeNull();
        expect(document.querySelector(".dashboard-applied-range")).toBeNull();
        expect(widgetRequests().every(request => request.filters.length === 0)).toBe(true);
    });
});
