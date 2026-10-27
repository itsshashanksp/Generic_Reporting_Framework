import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardProvider } from "../../../engine/DashboardContext";
import { clearRequestCache } from "../../../engine/RequestCache";
import TableWidget from "../TableWidget";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));

vi.mock("../../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../../api/request")>(),
    executeRequest: executeRequestMock,
}));

vi.mock("../../Grid/GenericGrid", () => ({
    default: () => <div data-testid="table-grid" />,
}));

function response(rows: number, totalRows = rows, firstRow = 0) {
    return {
        success: true,
        message: "ok",
        data: Array.from({ length: rows }, (_, index) => ({ Month: `2021-0${firstRow + index + 1}`, Sales: firstRow + index })),
        meta: { page: 1, pageSize: 10, totalRows, rowsReturned: rows, executionTime: 1 },
    };
}

let downloads: string[];
function mockBrowserDownloads({ fail = false } = {}) {
    downloads = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
        if (fail) throw new Error("internal: blob storage unavailable");
        return "blob:table";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
    });
}

async function renderTable() {
    render(
        <DashboardProvider>
            <TableWidget
                title="Sales Month Wise"
                request={{ action: "sql", resource: "widgets/sales-month-wise" }}
                exportConfig={{ enabled: true, formats: ["csv", "excel"], exportAll: true, exportCurrentView: true, filename: "sales" }}
            />
        </DashboardProvider>
    );
    await screen.findByTestId("table-grid");
}

function chooseExport(option: string) {
    fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);
    fireEvent.click(screen.getByRole("menuitem", { name: option }));
}

describe("TableWidget CSV export and export-all limits", () => {
    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset().mockResolvedValue(response(1));
    });

    afterEach(() => vi.restoreAllMocks());

    it.each(["Current page — CSV", "All rows — CSV"])("%s downloads the configured file", async option => {
        mockBrowserDownloads();
        await renderTable();

        chooseExport(option);

        await waitFor(() => expect(downloads).toEqual(["sales.csv"]));
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it.each(["Current page — CSV", "All rows — CSV"])("%s shows a friendly message when the file cannot be created", async option => {
        mockBrowserDownloads({ fail: true });
        await renderTable();

        chooseExport(option);

        expect((await screen.findByRole("alert")).textContent).toBe("Export failed: The CSV file could not be created.");
        expect(screen.queryByText(/internal|blob storage/i)).toBeNull();
    });

    it.each(["All rows — CSV", "All rows — Excel"])("%s refuses an export above the row limit after the first batch", async option => {
        mockBrowserDownloads();
        await renderTable();
        executeRequestMock.mockClear().mockResolvedValue(response(1, 250_000));

        chooseExport(option);

        expect((await screen.findByRole("alert")).textContent).toBe(
            "Export failed: This export has 250,000 rows, which exceeds the 100,000-row export limit. Narrow the filters and try again."
        );
        expect(executeRequestMock).toHaveBeenCalledTimes(1);
        expect(downloads).toEqual([]);
    });

    it("keeps current-page exports available regardless of the export-all limit", async () => {
        mockBrowserDownloads();
        executeRequestMock.mockResolvedValue(response(1, 250_000));
        await renderTable();

        chooseExport("Current page — CSV");

        await waitFor(() => expect(downloads).toEqual(["sales.csv"]));
    });

    it("exports exactly 100,000 rows across batches", async () => {
        mockBrowserDownloads();
        await renderTable();
        executeRequestMock.mockClear().mockImplementation(async (request: { pagination?: { page: number; pageSize: number } }) => {
            const pageNumber = request.pagination?.page ?? 1;
            const pageSize = request.pagination?.pageSize ?? 10;
            const firstRow = (pageNumber - 1) * pageSize;
            return response(Math.max(0, Math.min(pageSize, 100_000 - firstRow)), 100_000, firstRow);
        });

        chooseExport("All rows — CSV");

        await waitFor(() => expect(downloads).toEqual(["sales.csv"]), { timeout: 10_000 });
        expect(executeRequestMock).toHaveBeenCalledTimes(100);
        expect(screen.queryByRole("alert")).toBeNull();
    });

    it.each([
        ["a later batch fails", () => Promise.reject(new Error("The API returned HTTP 502.")), "Export failed: The API returned HTTP 502."],
        ["a later batch is short", () => Promise.resolve(response(2, 7_000)), "Export failed: The data service returned an incomplete export result."],
    ])("shows a message and saves nothing when %s", async (_label, secondBatch, message) => {
        mockBrowserDownloads();
        await renderTable();
        executeRequestMock.mockReset()
            .mockResolvedValueOnce(response(1_000, 7_000))
            .mockImplementationOnce(secondBatch);

        chooseExport("All rows — CSV");

        expect((await screen.findByRole("alert")).textContent).toBe(message);
        expect(downloads).toEqual([]);
    });

    it("cancels an all-rows export when an applied widget filter changes", async () => {
        mockBrowserDownloads();
        render(
            <DashboardProvider>
                <TableWidget
                    title="Sales"
                    request={{ action: "sql", resource: "widgets/sales" }}
                    runtimeFilters={[{ field: "Region", label: "Region", type: "text", operator: "equals" }]}
                    exportConfig={{ enabled: true, formats: ["csv"], exportAll: true, exportCurrentView: true }}
                />
            </DashboardProvider>
        );
        await screen.findByTestId("table-grid");
        executeRequestMock.mockImplementation((_request, options?: RequestInit) => new Promise((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
                const error = new Error("Aborted");
                error.name = "AbortError";
                reject(error);
            }, { once: true });
        }));

        chooseExport("All rows — CSV");
        fireEvent.click(screen.getByRole("button", { name: "Filter Sales" }));
        fireEvent.change(screen.getByLabelText("Region"), { target: { value: "West" } });
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));

        expect((await screen.findByRole("alert")).textContent).toContain("Export canceled");
        expect(downloads).toEqual([]);
    });
});
