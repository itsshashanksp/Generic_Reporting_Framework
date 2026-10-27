import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardProvider, useDashboard } from "../../../engine/DashboardContext";
import { getDashboard, resolveDashboardWidgetRequest } from "../../../engine/DashboardEngine";
import { FilterProvider, type FilterValue } from "../../../engine/FilterContext";
import { clearRequestCache } from "../../../engine/RequestCache";
import Dashboard from "../../../pages/Dashboard";
import type { DashboardWidget, WidgetRequest } from "../../../types/widget";
import StatWidget from "../StatWidget";
import TableWidget from "../TableWidget";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));

vi.mock("../../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../../api/request")>(),
    executeRequest: executeRequestMock,
}));

vi.mock("../../Grid/GenericGrid", () => ({
    default: () => <div data-testid="table-grid" />,
}));

const bill = getDashboard("bill-dashboard");
if (bill.status !== "valid") throw new Error("Expected a valid Bill dashboard");
const sharedFilters = bill.dashboard.filters ?? [];
const widget = (id: string) => bill.dashboard.widgets.find(item => item.id === id) as DashboardWidget;
const requestFor = (id: string) => resolveDashboardWidgetRequest(widget(id), sharedFilters) as WidgetRequest;

type SentRequest = { resource?: string; filters?: unknown[]; execution?: { filters?: object }; pagination?: unknown };
const sent = (resource: string) => executeRequestMock.mock.calls
    .map(call => call[0] as SentRequest)
    .filter(request => request.resource === resource);
const lastSent = (resource: string) => sent(resource).at(-1)!;

const recordApplied = vi.fn();
function ApplyRange({ value }: { value: FilterValue }) {
    const { applyFilters, appliedFilters } = useDashboard();
    useEffect(() => recordApplied(appliedFilters), [appliedFilters]);
    return <button type="button" onClick={() => applyFilters({ Bill_Date: value })}>Apply {JSON.stringify(value)}</button>;
}

async function renderBillWidgets(value: FilterValue) {
    render(
        <DashboardProvider>
            <ApplyRange value={value} />
            <TableWidget
                title="Purchases Month Wise"
                request={requestFor("purchases-month-wise")}
                filterDefinitions={sharedFilters}
                filterFields={widget("purchases-month-wise").filterFields}
                cacheScope="purchases"
                exportConfig={{ enabled: true, formats: ["csv"], exportAll: true, exportCurrentView: true, filename: "purchases" }}
            />
            <StatWidget
                title="Total Purchases"
                request={requestFor("total-purchases")}
                filterDefinitions={sharedFilters}
                filterFields={widget("total-purchases").filterFields}
                cacheScope="total-purchases"
            />
            <TableWidget
                title="Sales Month Wise"
                request={requestFor("sales-month-wise")}
                filterDefinitions={sharedFilters}
                filterFields={widget("sales-month-wise").filterFields}
                cacheScope="sales"
            />
        </DashboardProvider>
    );
    await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole("button", { name: `Apply ${JSON.stringify(value)}` }));
}

const PURCHASES = ["widgets/bill-purchases-month-wise", "widgets/bill-total-purchases"];
const SALES = "widgets/bill-sales-month-wise";

describe("dashboard filterFields requests", () => {
    beforeEach(() => {
        clearRequestCache();
        recordApplied.mockReset();
        executeRequestMock.mockReset().mockResolvedValue({
            success: true,
            message: "ok",
            data: [{ Month: "04", Purchases: 1, Sales: 2, TotalPurchases: 3 }],
            meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it("sends GIN_Date for purchases and Bill_Date for sales with a full range", async () => {
        const range = ["2021-04-01", "2022-03-31"];
        await renderBillWidgets(range);
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(6));

        for (const resource of PURCHASES) {
            expect(lastSent(resource).filters).toEqual([{ field: "GIN_Date", type: "daterange", operator: "BETWEEN", value: range }]);
            expect(lastSent(resource).execution?.filters).toEqual({ GIN_Date: { placement: "source" } });
            expect(JSON.stringify(lastSent(resource))).not.toContain("Bill_Date");
        }
        expect(lastSent(SALES).filters).toEqual([{ field: "Bill_Date", type: "daterange", operator: "BETWEEN", value: range }]);
        expect(lastSent(SALES).execution?.filters).toEqual({ Bill_Date: { placement: "source" } });
        expect(recordApplied).toHaveBeenLastCalledWith({ Bill_Date: range });
    });

    it("sends no runtime filter for an empty range but keeps the mapped declaration", async () => {
        await renderBillWidgets(["", ""]);
        // Applying an empty range changes no request, so nothing is re-sent.
        await new Promise(resolve => setTimeout(resolve, 50));

        for (const resource of PURCHASES) {
            expect(sent(resource).every(request => (request.filters ?? []).length === 0)).toBe(true);
            expect(lastSent(resource).execution?.filters).toEqual({ GIN_Date: { placement: "source" } });
        }
        expect(sent(SALES).every(request => (request.filters ?? []).length === 0)).toBe(true);
    });

    it("exports all rows with the same mapped GIN_Date filter as the screen", async () => {
        vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:purchases");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
        await renderBillWidgets(["2021-04-01", "2022-03-31"]);
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(6));
        const screenFilters = lastSent(PURCHASES[0]).filters;

        const exportMenu = screen.getAllByRole("button").filter(button => button.getAttribute("aria-haspopup") === "menu");
        fireEvent.click(exportMenu[0]);
        fireEvent.click(screen.getByRole("menuitem", { name: "All rows — CSV" }));

        await waitFor(() => expect(sent(PURCHASES[0]).length).toBe(3));
        const exported = lastSent(PURCHASES[0]);
        expect(exported.pagination).toMatchObject({ page: 1 });
        expect(exported.filters).toEqual(screenFilters);
        expect(exported.filters).toEqual([{ field: "GIN_Date", type: "daterange", operator: "BETWEEN", value: ["2021-04-01", "2022-03-31"] }]);
    });

    it("maps the Bill dashboard page's single date range per widget", async () => {
        render(<FilterProvider><Dashboard dashboardId="bill-dashboard" /></FilterProvider>);
        // The Bill date range is required, so nothing loads before Search.
        expect(executeRequestMock).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("Start Date start"), { target: { value: "2021-04-01" } });
        fireEvent.change(screen.getByLabelText("Start Date end"), { target: { value: "2022-03-31" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(7));

        const fieldByResource = Object.fromEntries(executeRequestMock.mock.calls.map(call => {
            const request = call[0] as SentRequest;
            return [request.resource, (request.filters as { field: string }[]).map(filter => filter.field)];
        }));
        expect(fieldByResource).toEqual({
            "widgets/bill-sales-month-wise": ["Bill_Date"],
            "widgets/bill-purchases-month-wise": ["GIN_Date"],
            "widgets/bill-top-10-categories": ["Bill_Date"],
            "widgets/sales-top-10-month-wise-category-wise": ["Bill_Date"],
            "widgets/bill-category-sales-month-wise": ["Bill_Date"],
            "widgets/bill-total-sales": ["Bill_Date"],
            "widgets/bill-total-purchases": ["GIN_Date"],
        });
    });
});
