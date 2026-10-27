import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Pagination from "../Pagination";
import { getPageTokens } from "../paginationTokens";

const config = { showTotalRecords: true, showPageNumbers: true, showFirstLast: false };

describe("Pagination", () => {
    it("renders a bounded numbered window for large totals", () => {
        const onPageChange = vi.fn();
        render(
            <Pagination page={2} pageSize={25} pageSizeOptions={[10, 25, 50, 100]} totalRows={97454} rowsOnPage={25}
                config={config} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />
        );

        expect(screen.getByText("Showing 26–50 of 97,454")).toBeTruthy();
        expect(screen.getAllByRole("button").length).toBeLessThanOrEqual(9);
        expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
        fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
        expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it("supports optional first/last controls and correct boundary states", () => {
        const onPageChange = vi.fn();
        render(
            <Pagination page={10} pageSize={10} totalRows={100} rowsOnPage={10}
                config={{ ...config, showFirstLast: true }} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />
        );
        expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", { name: "Last page" }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "First page" }));
        expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("changes page size and handles an unknown total without fabricating it", () => {
        const onPageSizeChange = vi.fn();
        render(
            <Pagination page={3} pageSize={25} pageSizeOptions={[10, 25, 50]} totalRows={null} rowsOnPage={12}
                config={{ ...config, showPageNumbers: false }} onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />
        );
        expect(screen.getByText("Showing 51–62")).toBeTruthy();
        expect(screen.queryByText(/ of /)).toBeNull();
        expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "50" } });
        expect(onPageSizeChange).toHaveBeenCalledWith(50);
    });

    it("handles empty results and hides configured sections", () => {
        render(
            <Pagination page={1} pageSize={10} totalRows={0} rowsOnPage={0}
                config={{ showTotalRecords: false, showPageNumbers: false, showFirstLast: false }}
                onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
        );
        expect(screen.queryByText(/Showing/)).toBeNull();
        expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("calculates compact page tokens", () => {
        expect(getPageTokens(1, 3)).toEqual([1, 2, 3]);
        expect(getPageTokens(50, 100)).toEqual([1, "ellipsis-left", 49, 50, 51, "ellipsis-right", 100]);
    });
});
