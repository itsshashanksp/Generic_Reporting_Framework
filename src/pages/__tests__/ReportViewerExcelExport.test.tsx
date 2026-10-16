import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { FilterProvider } from "../../engine/FilterContext";
import { GridProvider } from "../../engine/GridContext";
import { clearRequestCache } from "../../engine/RequestCache";
import ReportViewer from "../ReportViewer";

const { executeRequestMock } = vi.hoisted(() => ({ executeRequestMock: vi.fn() }));

vi.mock("../../api/request", async importOriginal => ({
    ...await importOriginal<typeof import("../../api/request")>(),
    executeRequest: executeRequestMock,
}));

vi.mock("../../components/Grid/GenericGrid", () => ({
    default: () => <div data-testid="report-grid" />,
}));

const FILE_ERROR = "The Excel file could not be created.";
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

// write-excel-file removes its temporary link 100 ms after the click.
const downloadCleanup = () => new Promise(resolve => setTimeout(resolve, 150));

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

describe("ReportViewer Excel export", () => {
    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset().mockResolvedValue({
            success: true,
            message: "ok",
            data: [{ Item_Code: "A1", Item_Desc: "Alpha", Item_MRP: 100 }],
            meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it("downloads the current view as the configured Excel file", async () => {
        mockBrowserDownloads();
        await renderItemReport();

        chooseExport("Current view — Excel");

        await waitFor(() => expect(downloads).toEqual(["item-report.xlsx"]));
        await downloadCleanup();
        expect(screen.queryByRole("status")).toBeNull();
        expect(document.querySelector("a[download]")).toBeNull();
    });

    it("shows a friendly message when the current-view Excel file cannot be created", async () => {
        mockBrowserDownloads({ fail: true });
        await renderItemReport();

        chooseExport("Current view — Excel");

        expect((await screen.findByRole("status")).textContent).toBe(FILE_ERROR);
        expect(screen.queryByText(/internal|blob storage/i)).toBeNull();
        expect(downloads).toEqual([]);
    });

    it("clears the previous current-view error when the next export succeeds", async () => {
        mockBrowserDownloads({ fail: true });
        await renderItemReport();
        chooseExport("Current view — Excel");
        await screen.findByText(FILE_ERROR);

        vi.restoreAllMocks();
        mockBrowserDownloads();
        chooseExport("Current view — Excel");

        await waitFor(() => expect(downloads).toEqual(["item-report.xlsx"]));
        await downloadCleanup();
        expect(screen.queryByText(FILE_ERROR)).toBeNull();
    });

    it("downloads all rows as the configured Excel file and clears the progress status", async () => {
        mockBrowserDownloads();
        await renderItemReport();

        chooseExport("All rows — Excel");

        await waitFor(() => expect(downloads).toEqual(["item-report.xlsx"]));
        await downloadCleanup();
        await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
        expect(executeRequestMock).toHaveBeenLastCalledWith(
            expect.objectContaining({ pagination: { page: 1, pageSize: 1000 } }),
            expect.anything()
        );
    });

    it("shows a friendly message when the all-rows Excel file cannot be created", async () => {
        mockBrowserDownloads({ fail: true });
        await renderItemReport();

        chooseExport("All rows — Excel");

        await waitFor(() => expect(screen.getByRole("status").textContent).toBe(FILE_ERROR));
        expect(screen.queryByText(/internal|blob storage/i)).toBeNull();
    });
});
