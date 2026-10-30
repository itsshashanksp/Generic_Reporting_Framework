import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Pagination from "../Pagination";
import { getPageTokens } from "../paginationTokens";

const config = { showTotalRecords: true, showPageNumbers: true, showFirstLast: false };

describe("Pagination", () => {
    it("renders record count, page size, and navigation as separate shared layout regions", () => {
        const { container } = render(
            <Pagination page={1} pageSize={10} pageSizeOptions={[10, 25, 50]} totalRows={80} rowsOnPage={10}
                config={config} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} className="universal-grid__pagination--client" />
        );

        const footer = container.querySelector(".universal-grid__pagination");
        expect(footer?.classList.contains("universal-grid__pagination--client")).toBe(true);
        expect(footer?.children).toHaveLength(3);
        expect(footer?.children[0].classList.contains("universal-grid__range")).toBe(true);
        expect(footer?.children[1].classList.contains("universal-grid__page-size")).toBe(true);
        expect(footer?.children[2].classList.contains("universal-grid__page-buttons")).toBe(true);
    });

    it("renders a bounded numbered window for large totals", () => {
        const onPageChange = vi.fn();
        render(
            <Pagination page={2} pageSize={25} pageSizeOptions={[10, 25, 50, 100]} totalRows={97454} rowsOnPage={25}
                config={config} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />
        );

        expect(screen.getByText("Showing 26–50 of 97,454")).toBeTruthy();
        expect(screen.getAllByRole("button").length).toBeLessThanOrEqual(9);
        expect(screen.getByRole("button", { name: "Page 2" }).getAttribute("aria-current")).toBe("page");
        expect((screen.getByLabelText("Current page") as HTMLInputElement).value).toBe("2");
        expect(document.querySelector(".universal-grid__page-indicator")?.textContent).toContain("of 3,899");
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
        expect(screen.getByRole("button", { name: "First page" }).classList.contains("universal-grid__page-button--first")).toBe(true);
        expect(screen.getByRole("button", { name: "Previous page" }).classList.contains("universal-grid__page-button--previous")).toBe(true);
        expect(screen.getByRole("button", { name: "Next page" }).classList.contains("universal-grid__page-button--next")).toBe(true);
        expect(screen.getByRole("button", { name: "Last page" }).classList.contains("universal-grid__page-button--last")).toBe(true);
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
        expect((screen.getByLabelText("Current page") as HTMLInputElement).value).toBe("3");
        expect(document.querySelector(".universal-grid__page-indicator")?.textContent).not.toContain("of");
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

    it("keeps every navigation action in the shared compactable region", () => {
        render(
            <Pagination page={50} pageSize={10} totalRows={1_000} rowsOnPage={10}
                config={{ ...config, showFirstLast: true }} onPageChange={vi.fn()} onPageSizeChange={vi.fn()} />
        );

        const navigation = screen.getByRole("navigation", { name: "Page navigation" });
        expect(navigation.querySelectorAll(".universal-grid__page-number")).toHaveLength(5);
        expect((screen.getByLabelText("Current page") as HTMLInputElement).value).toBe("50");
        expect(navigation.querySelector(".universal-grid__page-indicator")?.textContent).toContain("of 100");
        ["First page", "Previous page", "Next page", "Last page"].forEach(name => {
            expect(screen.getByRole("button", { name })).toBeTruthy();
        });
    });

    it("commits compact direct navigation once on blur and clamps the last page", () => {
        const onPageChange = vi.fn();
        render(
            <Pagination page={2} pageSize={10} totalRows={95} rowsOnPage={10}
                config={config} onPageChange={onPageChange} onPageSizeChange={vi.fn()} />
        );
        const input = screen.getByLabelText("Current page");
        fireEvent.change(input, { target: { value: "999" } });
        expect(onPageChange).not.toHaveBeenCalled();
        fireEvent.blur(input);
        expect(onPageChange).toHaveBeenCalledTimes(1);
        expect(onPageChange).toHaveBeenCalledWith(10);
    });
});
