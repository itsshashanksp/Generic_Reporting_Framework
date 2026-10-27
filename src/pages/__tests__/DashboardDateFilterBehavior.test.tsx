import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../api/client";
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

// Test-only copies of the Bill dashboard, loaded through the real loader, so
// no production dashboard changes. Their date filter has no own `required`.
vi.mock("../../engine/DashboardEngine", async importOriginal => {
    const actual = await importOriginal<typeof import("../../engine/DashboardEngine")>();
    const bill = (await import("../../../tests/fixtures/runtime-config/dashboards/bill.json")).default;
    const unflagged = bill.filters.map(filter => Object.fromEntries(Object.entries(filter).filter(([key]) => key !== "required")));
    const fixtures: Record<string, unknown> = {
        "optional-bill-test": { ...bill, id: "optional-bill-test", dateFilterBehavior: "optional", filters: unflagged },
        "required-bill-test": { ...bill, id: "required-bill-test", dateFilterBehavior: "required", filters: unflagged },
    };
    return {
        ...actual,
        getDashboard: (id: string) => id in fixtures
            ? actual.loadDashboardConfiguration(fixtures[id], id)
            : actual.getDashboard(id),
    };
});

type SentRequest = { resource: string; filters: { field: string; type?: string; operator: string; value: unknown }[] };
const sent = () => executeRequestMock.mock.calls.map(call => call[0] as SentRequest);
const exportMenus = () => screen.queryAllByRole("button").filter(button => button.getAttribute("aria-haspopup") === "menu");
const appliedRange = () => document.querySelector(".dashboard-applied-range")?.textContent;

const RANGE = ["2021-04-01", "2022-03-31"];
const MAPPED_FIELDS: Record<string, string> = {
    "widgets/bill-sales-month-wise": "Bill_Date",
    "widgets/bill-purchases-month-wise": "GIN_Date",
    "widgets/bill-top-10-categories": "Bill_Date",
    "widgets/sales-top-10-month-wise-category-wise": "Bill_Date",
    "widgets/bill-category-sales-month-wise": "Bill_Date",
    "widgets/bill-total-sales": "Bill_Date",
    "widgets/bill-total-purchases": "GIN_Date",
};
const mappedRangeFilters = (range: unknown[]) => Object.fromEntries(Object.entries(MAPPED_FIELDS)
    .map(([resource, field]) => [resource, [{ field, type: "daterange", operator: "BETWEEN", value: range }]]));
const filtersByResource = (requests: SentRequest[]) => Object.fromEntries(requests.map(request => [request.resource, request.filters]));

function renderDashboard(dashboardId: string) {
    render(<FilterProvider><Dashboard dashboardId={dashboardId} /></FilterProvider>);
}

function enterDates(start: string, end: string) {
    fireEvent.change(screen.getByLabelText("Start Date start"), { target: { value: start } });
    fireEvent.change(screen.getByLabelText("Start Date end"), { target: { value: end } });
}

const search = () => fireEvent.click(screen.getByRole("button", { name: "Search" }));
const settle = () => new Promise(resolve => setTimeout(resolve, 50));

beforeEach(() => {
    clearRequestCache();
    executeRequestMock.mockReset().mockResolvedValue({
        success: true,
        message: "ok",
        data: [{ Month: "04", Category: "A", Sales: 2, Purchases: 1, TotalSales: 3, TotalPurchases: 4 }],
        meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
    });
});

afterEach(() => vi.restoreAllMocks());

describe('dateFilterBehavior "required"', () => {
    it("holds back a dashboard by its configured behavior alone", async () => {
        renderDashboard("required-bill-test");
        expect(screen.getByRole("status").textContent).toBe("Enter Start Date (start and end dates) and choose Search to load this dashboard.");
        await settle();
        expect(executeRequestMock).not.toHaveBeenCalled();

        enterDates("2021-04-01", "");
        search();
        expect(screen.getByRole("alert").textContent).toBe("Start Date requires both a lower and an upper value.");
        await settle();
        expect(executeRequestMock).not.toHaveBeenCalled();

        enterDates(RANGE[0], RANGE[1]);
        search();
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(7));
        expect(filtersByResource(sent())).toEqual(mappedRangeFilters(RANGE));
    });

    it("keeps the applied range while the dates are edited, and sends each search once", async () => {
        renderDashboard("bill-dashboard");
        enterDates(RANGE[0], RANGE[1]);
        search();
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(7));
        expect(appliedRange()).toBe("Showing results for Start Date 2021-04-01 to 2022-03-31.");

        enterDates("2023-04-01", "2024-03-31");
        await settle();
        expect(executeRequestMock).toHaveBeenCalledTimes(7);
        expect(appliedRange()).toBe("Showing results for Start Date 2021-04-01 to 2022-03-31.");

        search();
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(14));
        await settle();
        expect(executeRequestMock).toHaveBeenCalledTimes(14);
        expect(filtersByResource(sent().slice(7))).toEqual(mappedRangeFilters(["2023-04-01", "2024-03-31"]));
        expect(appliedRange()).toBe("Showing results for Start Date 2023-04-01 to 2024-03-31.");
    });
});

describe('dateFilterBehavior "optional"', () => {
    async function loadInitial() {
        renderDashboard("optional-bill-test");
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(7));
        await waitFor(() => expect(screen.getAllByTestId("table-grid")).toHaveLength(5));
    }

    async function searchRange(range = RANGE, expectedCalls = 14) {
        enterDates(range[0], range[1]);
        search();
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(expectedCalls));
    }

    it("loads every widget without a date runtime filter", async () => {
        await loadInitial();
        expect(Object.keys(filtersByResource(sent())).sort()).toEqual(Object.keys(MAPPED_FIELDS).sort());
        expect(sent().every(request => request.filters.length === 0)).toBe(true);
        expect(appliedRange()).toBe("Showing results without a Start Date range.");
        expect(screen.queryByText(/choose Search to load this dashboard/)).toBeNull();
        expect(screen.getByLabelText("Start Date start")).toBeTruthy();
        expect(screen.getByLabelText("Start Date end")).toBeTruthy();
    });

    it("sends nothing while dates are selected, then applies both dates once on Search", async () => {
        await loadInitial();
        enterDates(RANGE[0], RANGE[1]);
        await settle();
        expect(executeRequestMock).toHaveBeenCalledTimes(7);

        search();
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(14));
        await settle();
        expect(executeRequestMock).toHaveBeenCalledTimes(14);
        expect(filtersByResource(sent().slice(7))).toEqual(mappedRangeFilters(RANGE));
        expect(appliedRange()).toBe("Showing results for Start Date 2021-04-01 to 2022-03-31.");
    });

    it.each([
        ["only a start date", "2023-04-01", ""],
        ["only an end date", "", "2024-03-31"],
    ])("rejects %s and keeps the applied range and its results", async (_name, start, end) => {
        await loadInitial();
        await searchRange();

        enterDates(start, end);
        search();
        await settle();

        expect(screen.getByRole("alert").textContent).toBe("Start Date requires both a lower and an upper value.");
        expect(executeRequestMock).toHaveBeenCalledTimes(14);
        expect(appliedRange()).toBe("Showing results for Start Date 2021-04-01 to 2022-03-31.");
        expect(screen.getAllByTestId("table-grid")).toHaveLength(5);
        expect((screen.getByLabelText("Start Date start") as HTMLInputElement).value).toBe(start);
        expect((screen.getByLabelText("Start Date end") as HTMLInputElement).disabled).toBe(false);
    });

    // Requests without a date range repeat the initial ones, so the in-memory
    // request cache may answer them; Refresh asks the API again.
    async function expectUndatedResults() {
        await waitFor(() => expect(appliedRange()).toBe("Showing results without a Start Date range."));
        await settle();
        expect(sent().slice(14).every(request => request.filters.length === 0)).toBe(true);
        expect(screen.getAllByTestId("table-grid")).toHaveLength(5);
        const before = executeRequestMock.mock.calls.length;
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
        await waitFor(() => expect(executeRequestMock.mock.calls.length).toBe(before + 7));
        expect(sent().slice(before).every(request => request.filters.length === 0)).toBe(true);
    }

    it("searching with both dates empty applies no date range", async () => {
        await loadInitial();
        await searchRange();
        enterDates("", "");
        search();
        expect(screen.queryByRole("alert")).toBeNull();
        await expectUndatedResults();
    });

    it("Clear filters removes the applied range from later requests", async () => {
        await loadInitial();
        await searchRange();

        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
        expect((screen.getByLabelText("Start Date start") as HTMLInputElement).value).toBe("");
        expect((screen.getByLabelText("Start Date end") as HTMLInputElement).value).toBe("");
        await expectUndatedResults();
    });

    it("exports all rows with the filters of the on-screen table", async () => {
        vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:export");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
        const purchases = () => sent().filter(request => request.resource === "widgets/bill-purchases-month-wise");
        const exportAllPurchases = async (calls: number) => {
            fireEvent.click(exportMenus()[1]);
            fireEvent.click(screen.getByRole("menuitem", { name: "All rows — CSV" }));
            await waitFor(() => expect(purchases()).toHaveLength(calls));
            return purchases().at(-1)!;
        };

        await loadInitial();
        await searchRange();
        const screenFilters = purchases().at(-1)!.filters;
        const exported = await exportAllPurchases(3);
        expect(exported.filters).toEqual(screenFilters);
        expect(exported.filters).toEqual([{ field: "GIN_Date", type: "daterange", operator: "BETWEEN", value: RANGE }]);

        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
        await waitFor(() => expect(appliedRange()).toBe("Showing results without a Start Date range."));
        const afterClear = purchases().length;
        expect((await exportAllPurchases(afterClear + 1)).filters).toEqual([]);
    });
});

describe("Bill dashboard export-all under a backend page-size maximum", () => {
    it("exports with each widget's applied filter in batches the backend accepts", async () => {
        const downloads: string[] = [];
        vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:export");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            downloads.push(this.download);
        });
        // Like a deployment whose runtime maxPageSize is 100.
        executeRequestMock.mockImplementation(async (request: { pagination?: { pageSize: number } }) => {
            if ((request.pagination?.pageSize ?? 0) > 100) {
                throw new ApiClientError("Invalid request.", 400, {
                    code: "INVALID_REQUEST",
                    details: [{ path: "pagination.pageSize", message: "Page size exceeds the configured maximum." }],
                });
            }
            return {
                success: true,
                message: "ok",
                data: [{ Month: "04", Category: "A", Sales: 2, Purchases: 1 }],
                meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
            };
        });

        renderDashboard("bill-dashboard");
        expect(exportMenus()).toHaveLength(0);
        enterDates(RANGE[0], RANGE[1]);
        search();
        await waitFor(() => expect(executeRequestMock).toHaveBeenCalledTimes(7));
        await waitFor(() => expect(exportMenus()).toHaveLength(5));
        const onScreen = filtersByResource(sent());

        for (const [index, resource, file] of [
            [1, "widgets/bill-purchases-month-wise", "purchases-month-wise.csv"],
            [0, "widgets/bill-sales-month-wise", "sales-month-wise.csv"],
            [3, "widgets/sales-top-10-month-wise-category-wise", "top-10-month-wise-category-wise.csv"],
        ] as const) {
            const before = executeRequestMock.mock.calls.length;
            fireEvent.click(exportMenus()[index]);
            fireEvent.click(screen.getByRole("menuitem", { name: "All rows — CSV" }));
            await waitFor(() => expect(downloads).toContain(file));
            const exportRequests = executeRequestMock.mock.calls.slice(before).map(call => call[0] as SentRequest & { pagination: { pageSize: number } });
            expect(exportRequests.map(request => request.pagination.pageSize)).toEqual([1000, 500, 250, 100]);
            expect(exportRequests.every(request => request.resource === resource)).toBe(true);
            expect(exportRequests.at(-1)!.filters).toEqual(onScreen[resource]);
            expect(exportRequests.at(-1)!.filters).toEqual(mappedRangeFilters(RANGE)[resource]);
        }
        expect(screen.queryByText(/Export failed/)).toBeNull();
    });
});

describe("Sales dashboard TOP-10 export", () => {
    it("exports the shared TOP-10 resource with the Sales dashboard's applied filters", async () => {
        const downloads: string[] = [];
        vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:export");
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            downloads.push(this.download);
        });
        const TOP_TEN = "widgets/sales-top-10-month-wise-category-wise";
        const topTen = () => sent().filter(request => request.resource === TOP_TEN) as (SentRequest & { database?: string; pagination?: unknown })[];
        const exportTopTen = async () => {
            const before = topTen().length;
            downloads.length = 0;
            fireEvent.click(exportMenus()[2]);
            fireEvent.click(screen.getByRole("menuitem", { name: "All rows — CSV" }));
            await waitFor(() => expect(downloads).toEqual(["top-10-month-wise-category-wise.csv"]));
            return topTen().slice(before);
        };

        renderDashboard("sales-dashboard");
        await waitFor(() => expect(topTen()).toHaveLength(1));
        expect(topTen()[0].filters).toEqual([]);
        expect(topTen()[0]).not.toHaveProperty("database");
        const undated = await exportTopTen();
        expect(undated.length).toBeGreaterThan(0);
        expect(undated.every(request => request.filters.length === 0 && !("database" in request))).toBe(true);

        enterDates(RANGE[0], RANGE[1]);
        search();
        await waitFor(() => expect(topTen().some(request => request.filters.length > 0)).toBe(true));
        const onScreen = topTen().at(-1)!.filters;
        expect(onScreen).toEqual([{ field: "Bill_Date", type: "daterange", operator: "BETWEEN", value: RANGE }]);
        const dated = await exportTopTen();
        expect(dated.every(request => JSON.stringify(request.filters) === JSON.stringify(onScreen))).toBe(true);
    });
});
