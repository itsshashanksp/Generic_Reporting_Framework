import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { FilterProvider } from "../../engine/FilterContext";
import { GridProvider } from "../../engine/GridContext";
import { clearRequestCache } from "../../engine/RequestCache";
import ReportViewer from "../ReportViewer";

const { executeRequestMock, exportRowsCSVMock, exportExcelMock } = vi.hoisted(() => ({
    executeRequestMock: vi.fn(),
    exportRowsCSVMock: vi.fn(),
    exportExcelMock: vi.fn(),
}));

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    // Checked-in reports/dashboards may enable databaseSelection, which first lists databases.
    executeRequest: (await import("../../test/databaseRegistry")).withTestDatabaseRegistry(executeRequestMock),
}));

// The real paging helper runs; only the file writers are replaced so the
// exported rows can be inspected.
vi.mock("../../engine/ExportEngine", async importOriginal => ({
    ...await importOriginal<typeof import("../../engine/ExportEngine")>(),
    exportRowsCSV: exportRowsCSVMock,
    exportExcel: exportExcelMock,
}));

vi.mock("../../components/Grid/GenericGrid", () => ({
    default: () => <div data-testid="report-grid" />,
}));

type PagedRequest = {
    action: string;
    groupBy?: unknown;
    pagination?: { page: number; pageSize: number };
    [key: string]: unknown;
};

const EXPORT_PAGE_SIZE = 1000;

function envelope(rows: Record<string, unknown>[], totalRows: number, pagination?: { page: number; pageSize: number }) {
    return {
        success: true,
        message: "ok",
        data: rows,
        meta: {
            page: pagination?.page ?? null,
            pageSize: pagination?.pageSize ?? null,
            totalRows,
            rowsReturned: rows.length,
            executionTime: 1,
        },
    };
}

const itemRow = (index: number) => ({ Item_Code: index + 1, Item_Desc: `Item ${index + 1}`, Item_MRP: index });

/**
 * A backend holding `available` matching rows, paged by `pagination` as the
 * Generic SQL API pages a report request (`meta.page`/`pageSize` echo the
 * request; `totalRows` is the full count). Dynamic filter options get none.
 */
function backend(available: number, override?: (request: PagedRequest) => unknown) {
    return vi.fn(async (request: PagedRequest) => {
        if (request.groupBy) return envelope([], 0);
        const overridden = override?.(request);
        if (overridden) return overridden;
        const pagination = request.pagination ?? { page: 1, pageSize: available };
        const first = (pagination.page - 1) * pagination.pageSize;
        const count = Math.max(0, Math.min(pagination.pageSize, available - first));
        return envelope(Array.from({ length: count }, (_, index) => itemRow(first + index)), available, request.pagination);
    });
}

const exportRequests = () => executeRequestMock.mock.calls
    .map(call => call[0] as PagedRequest)
    .filter(request => request.pagination?.pageSize === EXPORT_PAGE_SIZE);

async function renderItemReport({ empty = false } = {}) {
    render(
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
    if (empty) await screen.findByText("No data available");
    else await screen.findByTestId("report-grid");
}

function chooseExport(option: string) {
    fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);
    fireEvent.click(screen.getByRole("menuitem", { name: option }));
}

const exportedRows = () => exportRowsCSVMock.mock.calls[0][0] as ReturnType<typeof itemRow>[];

describe("ReportViewer paginated export of all rows (R3)", () => {
    beforeEach(() => {
        clearRequestCache();
        exportRowsCSVMock.mockReset();
        exportExcelMock.mockReset().mockResolvedValue(undefined);
    });

    afterEach(() => vi.restoreAllMocks());

    it.each([
        ["fewer rows than one page", 3, [1]],
        ["exactly two full pages", 2_000, [1, 2]],
        ["a final partial page", 2_500, [1, 2, 3]],
        ["more than 10,000 rows", 12_345, Array.from({ length: 13 }, (_, index) => index + 1)],
    ])("exports %s, every row once and in order", async (_label, available, pages) => {
        executeRequestMock.mockReset().mockImplementation(backend(available));
        await renderItemReport();

        chooseExport("All rows — CSV");

        await waitFor(() => expect(exportRowsCSVMock).toHaveBeenCalledTimes(1));
        expect(exportRequests().map(request => request.pagination!.page)).toEqual(pages);
        const rows = exportedRows();
        expect(rows).toHaveLength(available);
        expect(rows.map(row => row.Item_Code)).toEqual(Array.from({ length: available }, (_, index) => index + 1));
        expect(exportRowsCSVMock).toHaveBeenCalledWith(expect.any(Array), "item-report.csv");
        await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    });

    it("does not change ordinary paged viewing", async () => {
        executeRequestMock.mockReset().mockImplementation(backend(12_345));
        await renderItemReport();

        // Report data requests only (not filter options or a database listing).
        const gridRequests = executeRequestMock.mock.calls.map(call => call[0] as PagedRequest)
            .filter(request => request.action === "select" && !request.groupBy);
        expect(gridRequests).toHaveLength(1);
        expect(gridRequests[0].pagination).toEqual({ page: 1, pageSize: 10 });
    });

    it("disables all-row export when the known total is zero", async () => {
        executeRequestMock.mockReset().mockImplementation(backend(0));
        await renderItemReport({ empty: true });

        fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);
        expect((screen.getByRole("menuitem", { name: "All rows — CSV" }) as HTMLButtonElement).disabled).toBe(true);
        expect(exportRequests()).toHaveLength(0);
        expect(exportRowsCSVMock).not.toHaveBeenCalled();
    });

    it("fails without writing a partial file when a later page fails", async () => {
        executeRequestMock.mockReset().mockImplementation(backend(5_000, request =>
            request.pagination?.pageSize === EXPORT_PAGE_SIZE && request.pagination.page === 3
                ? Promise.reject(new Error("The API returned HTTP 502."))
                : undefined
        ));
        await renderItemReport();

        chooseExport("All rows — Excel");

        expect((await screen.findByRole("status")).textContent).toBe("The API returned HTTP 502.");
        expect(exportRequests().map(request => request.pagination!.page)).toEqual([1, 2, 3]);
        expect(exportExcelMock).not.toHaveBeenCalled();
    });

    it("sends the applied filters, sort, fields and database unchanged on every page", async () => {
        executeRequestMock.mockReset().mockImplementation(backend(2_500));
        await renderItemReport();
        fireEvent.change(screen.getByLabelText("Item Description"), { target: { value: "pen" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(executeRequestMock.mock.calls.some(call => Array.isArray(call[0].filters) && call[0].filters.length > 0)).toBe(true));

        chooseExport("All rows — CSV");

        await waitFor(() => expect(exportRowsCSVMock).toHaveBeenCalledTimes(1));
        const requests = exportRequests();
        expect(requests).toHaveLength(3);
        requests.forEach(({ pagination, ...request }) => {
            expect(pagination?.pageSize).toBe(EXPORT_PAGE_SIZE);
            expect(request).toEqual({
                action: "select",
                database: "loyal-ibms",
                source: { table: "ItemMasterTable" },
                fields: ["Item_Code", "Item_Desc", "Item_MRP"],
                filters: [{ field: "Item_Desc", operator: "LIKE", value: "%pen%" }],
                sort: [{ field: "Item_Code", direction: "ASC" }],
            });
        });
    });

    it.each([
        [
            "the backend ignores the page and repeats the first page",
            (request: PagedRequest) => request.pagination?.pageSize === EXPORT_PAGE_SIZE
                ? envelope(Array.from({ length: EXPORT_PAGE_SIZE }, (_, index) => itemRow(index)), 2_000, request.pagination)
                : undefined,
            "The data service returned the same rows for consecutive pages. Nothing was exported.",
            2,
        ],
        [
            "a page overruns the reported total",
            // Stable total of 1,500, but page 2 holds 1,000 rows where only 500 remain.
            (request: PagedRequest) => request.pagination?.pageSize === EXPORT_PAGE_SIZE
                ? envelope(Array.from({ length: EXPORT_PAGE_SIZE }, (_, index) => itemRow((request.pagination!.page - 1) * 1_000 + index)), 1_500, request.pagination)
                : undefined,
            "The data service returned more rows than the reported total. Nothing was exported.",
            2,
        ],
        [
            "the total changes between pages",
            (request: PagedRequest) => request.pagination?.pageSize === EXPORT_PAGE_SIZE && request.pagination.page === 2
                ? envelope(Array.from({ length: EXPORT_PAGE_SIZE }, (_, index) => itemRow(1_000 + index)), 3_100, request.pagination)
                : undefined,
            "The matching rows changed while the export was running. Try again. Nothing was exported.",
            2,
        ],
    ])("stops and saves nothing when %s", async (_label, override, message, requestCount) => {
        executeRequestMock.mockReset().mockImplementation(backend(3_000, override));
        await renderItemReport();

        chooseExport("All rows — CSV");

        expect((await screen.findByRole("status")).textContent).toBe(message);
        expect(exportRequests()).toHaveLength(requestCount);
        expect(exportRowsCSVMock).not.toHaveBeenCalled();
    });

    it("writes Excel with the same paged rows and the configured file name", async () => {
        executeRequestMock.mockReset().mockImplementation(backend(1_200));
        await renderItemReport();

        chooseExport("All rows — Excel");

        await waitFor(() => expect(exportExcelMock).toHaveBeenCalledTimes(1));
        const [rows, filename] = exportExcelMock.mock.calls[0];
        expect(filename).toBe("item-report.xlsx");
        expect(rows).toHaveLength(1_200);
        expect(exportRequests().map(request => request.pagination!.page)).toEqual([1, 2]);
    });
});
