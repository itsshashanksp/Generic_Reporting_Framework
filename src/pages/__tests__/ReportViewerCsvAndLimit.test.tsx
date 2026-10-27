import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { GridApi } from "ag-grid-community";

import { FilterProvider } from "../../engine/FilterContext";
import { GridProvider, useGrid } from "../../engine/GridContext";
import { clearRequestCache } from "../../engine/RequestCache";
import ReportViewer from "../ReportViewer";

const { executeRequestMock, gridApi } = vi.hoisted(() => ({
    executeRequestMock: vi.fn(),
    gridApi: { current: null as null | {
        exportDataAsCsv: ReturnType<typeof vi.fn>;
        getColumnState: ReturnType<typeof vi.fn>;
    } },
}));

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    // Checked-in reports/dashboards may enable databaseSelection, which first lists databases.
    executeRequest: (await import("../../test/databaseRegistry")).withTestDatabaseRegistry(executeRequestMock),
}));

vi.mock("../../components/Grid/GenericGrid", () => ({
    // Registers the grid API the way the real grid does once it is ready.
    default: function GridStandIn() {
        const { setApi } = useGrid();
        useEffect(() => {
            if (gridApi.current) setApi(gridApi.current as unknown as GridApi);
        }, [setApi]);
        return <div data-testid="report-grid" />;
    },
}));

function response(rows: Record<string, unknown>[], totalRows = rows.length) {
    return {
        success: true,
        message: "ok",
        data: rows,
        meta: { page: 1, pageSize: 10, totalRows, rowsReturned: rows.length, executionTime: 1 },
    };
}

/** Serves `available` distinct rows by page, as the backend pages a report request. */
function pagedServer(available: number) {
    return async (request: { pagination?: { page: number; pageSize: number } }) => {
        const { page, pageSize } = request.pagination ?? { page: 1, pageSize: available };
        const first = (page - 1) * pageSize;
        const count = Math.max(0, Math.min(pageSize, available - first));
        return {
            ...response(Array.from({ length: count }, (_, index) => ({ Item_Code: `I${first + index}` })), available),
            meta: { page, pageSize, totalRows: available, rowsReturned: count, executionTime: 1 },
        };
    };
}

let downloads: string[];
function mockBrowserDownloads({ fail = false } = {}) {
    downloads = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
        if (fail) throw new Error("internal: blob storage unavailable");
        return "blob:report";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
    });
}

async function renderItemReport() {
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
    await screen.findByTestId("report-grid");
}

function chooseExport(option: string) {
    fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);
    fireEvent.click(screen.getByRole("menuitem", { name: option }));
}

describe("ReportViewer CSV export and export-all limits", () => {
    beforeEach(() => {
        clearRequestCache();
        gridApi.current = { exportDataAsCsv: vi.fn(), getColumnState: vi.fn(() => []) };
        executeRequestMock.mockReset().mockResolvedValue(response([{ Item_Code: "A1", Item_Desc: "Alpha", Item_MRP: 100 }]));
    });

    afterEach(() => vi.restoreAllMocks());

    it("exports the current view as the configured CSV file", async () => {
        await renderItemReport();

        chooseExport("Current view — CSV");

        expect(gridApi.current!.exportDataAsCsv).toHaveBeenCalledWith(expect.objectContaining({ fileName: "item-report.csv" }));
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("shows a friendly message when the current-view CSV file cannot be created", async () => {
        gridApi.current!.exportDataAsCsv.mockImplementation(() => {
            throw new Error("internal: blob storage unavailable");
        });
        await renderItemReport();

        chooseExport("Current view — CSV");

        expect((await screen.findByRole("status")).textContent).toBe("The CSV file could not be created.");
        expect(screen.queryByText(/internal|blob storage/i)).toBeNull();
    });

    it("disables current-view CSV until the grid is ready", async () => {
        gridApi.current = null;
        await renderItemReport();

        fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);

        expect((screen.getByRole("menuitem", { name: "Current view — CSV" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("downloads all rows as the configured CSV file", async () => {
        mockBrowserDownloads();
        await renderItemReport();

        chooseExport("All rows — CSV");

        await waitFor(() => expect(downloads).toEqual(["item-report.csv"]));
        await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    });

    it("shows a friendly message when the all-rows CSV file cannot be created", async () => {
        mockBrowserDownloads({ fail: true });
        await renderItemReport();

        chooseExport("All rows — CSV");

        await waitFor(() => expect(screen.getByRole("status").textContent).toBe("The CSV file could not be created."));
        expect(screen.queryByText(/internal|blob storage/i)).toBeNull();
    });

    it.each(["All rows — CSV", "All rows — Excel"])("%s refuses an export above the row limit and saves nothing", async option => {
        mockBrowserDownloads();
        await renderItemReport();
        executeRequestMock.mockResolvedValue(response([{ Item_Code: "A1" }], 100_001));

        chooseExport(option);

        await waitFor(() => expect(screen.getByRole("status").textContent).toBe(
            "This export has 100,001 rows, which exceeds the 100,000-row export limit. Narrow the filters and try again."
        ));
        expect(downloads).toEqual([]);
    });

    it("refuses an incomplete export instead of saving partial data", async () => {
        mockBrowserDownloads();
        await renderItemReport();
        executeRequestMock.mockResolvedValue(response([{ Item_Code: "A1" }], 5));

        chooseExport("All rows — CSV");

        await waitFor(() => expect(screen.getByRole("status").textContent).toBe(
            "The data service returned an incomplete export result. Nothing was exported."
        ));
        expect(downloads).toEqual([]);
    });

    it("exports exactly 100,000 rows across 1,000-row pages", async () => {
        mockBrowserDownloads();
        await renderItemReport();
        const exportServer = pagedServer(100_000);
        executeRequestMock.mockClear().mockImplementation(exportServer);

        chooseExport("All rows — CSV");

        await waitFor(() => expect(downloads).toEqual(["item-report.csv"]), { timeout: 10_000 });
        await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
        expect(executeRequestMock).toHaveBeenCalledTimes(100);
    }, 15_000);

    it("rejects a response of 100,001 rows and saves nothing", async () => {
        mockBrowserDownloads();
        await renderItemReport();
        const rows = Array.from({ length: 100_001 }, (_, index) => ({ Item_Code: `I${index}` }));
        executeRequestMock.mockResolvedValue(response(rows));

        chooseExport("All rows — Excel");

        await waitFor(() => expect(screen.getByRole("status").textContent).toBe(
            "This export has 100,001 rows, which exceeds the 100,000-row export limit. Narrow the filters and try again."
        ));
        expect(downloads).toEqual([]);
    });

    it("keeps current-view Excel export available when the full result exceeds the limit", async () => {
        mockBrowserDownloads();
        executeRequestMock.mockResolvedValue(response([{ Item_Code: "A1" }], 250_000));
        await renderItemReport();

        chooseExport("Current view — Excel");

        await waitFor(() => expect(downloads).toEqual(["item-report.xlsx"]));
        await new Promise(resolve => setTimeout(resolve, 150));
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("cancels an all-rows export when report filters are applied", async () => {
        mockBrowserDownloads();
        await renderItemReport();
        executeRequestMock.mockImplementation((_request, options?: RequestInit) => new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
                const error = new Error("Aborted");
                error.name = "AbortError";
                reject(error);
            }, { once: true });
        }));

        chooseExport("All rows — CSV");
        fireEvent.click(screen.getByRole("button", { name: "Open search and filters" }));
        fireEvent.change(screen.getByLabelText("Item Code"), { target: { value: "100" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        await screen.findByText(/Export canceled because the report filters/);
        expect(downloads).toEqual([]);
    });
});
