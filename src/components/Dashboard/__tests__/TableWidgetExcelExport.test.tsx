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

const okResponse = {
    success: true,
    message: "ok",
    data: [{ Month: "2021-06", Sales: 12.5 }],
    meta: { page: 1, pageSize: 10, totalRows: 1, rowsReturned: 1, executionTime: 1 },
};
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

// write-excel-file removes its temporary link 100 ms after the click.
const downloadCleanup = () => new Promise(resolve => setTimeout(resolve, 150));

async function renderTable() {
    render(
        <DashboardProvider>
            <TableWidget
                title="Sales Month Wise"
                request={{ action: "sql", resource: "widgets/sales-month-wise" }}
                exportConfig={{ enabled: true, formats: ["excel"], exportAll: true, exportCurrentView: true, filename: "sales" }}
            />
        </DashboardProvider>
    );
    await screen.findByTestId("table-grid");
}

function chooseExport(option: string) {
    fireEvent.click(screen.getAllByRole("button").find(button => button.getAttribute("aria-haspopup") === "menu")!);
    fireEvent.click(screen.getByRole("menuitem", { name: option }));
}

describe("TableWidget Excel export", () => {
    beforeEach(() => {
        clearRequestCache();
        executeRequestMock.mockReset().mockResolvedValue(okResponse);
    });

    afterEach(() => vi.restoreAllMocks());

    it.each(["Current page — Excel", "All rows — Excel"])("%s downloads the configured file", async option => {
        mockBrowserDownloads();
        await renderTable();

        chooseExport(option);

        await waitFor(() => expect(downloads).toEqual(["sales.xlsx"]));
        await downloadCleanup();
        expect(screen.queryByRole("alert")).toBeNull();
        expect(document.querySelector("a[download]")).toBeNull();
    });

    it.each(["Current page — Excel", "All rows — Excel"])("%s shows a friendly message when the file cannot be created", async option => {
        mockBrowserDownloads({ fail: true });
        await renderTable();

        chooseExport(option);

        expect((await screen.findByRole("alert")).textContent).toBe("Export failed: The Excel file could not be created.");
        expect(screen.queryByText(/internal|blob storage/i)).toBeNull();
    });

    it("reports a real network failure while fetching all rows as unreachable", async () => {
        mockBrowserDownloads();
        await renderTable();
        executeRequestMock.mockRejectedValue(new TypeError("Failed to fetch"));

        chooseExport("All rows — Excel");

        expect((await screen.findByRole("alert")).textContent).toBe(
            "Export failed: The data service could not be reached. Check the network connection and try again."
        );
        expect(downloads).toEqual([]);
    });

    it("does not report a local programming error as a network failure", async () => {
        mockBrowserDownloads();
        await renderTable();
        executeRequestMock.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'data')"));

        chooseExport("All rows — Excel");

        expect((await screen.findByRole("alert")).textContent).toBe("Export failed: Unable to prepare the table export.");
    });
});
