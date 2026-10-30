import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GenericGrid from "../GenericGrid";
import ReportingGrid from "../ReportingGrid";

const columns = [
    { field: "Month", header: "Month", visible: true, sortable: true },
    { field: "Category", header: "Category", visible: true, sortable: true },
    { field: "Sales", header: "Sales", visible: true, sortable: true, dataType: "currency" as const },
];
const grouping = {
    enabled: true as const,
    groups: [{ field: "Month" }],
    aggregates: [{ field: "Sales", function: "SUM" as const }],
    expandedByDefault: true,
    showSubtotals: true,
    showGrandTotal: true,
    subtotalPosition: "bottom" as const,
};
const gridConfig = {
    pagination: { enabled: true, pageSize: 10, pageSizeOptions: [10, 25], showTotalRecords: true },
    rowSelection: "multiple" as const,
    grouping,
};

describe("ReportingGrid", () => {
    it("shows formatted aggregate values in both expanded and collapsed group headers", () => {
        render(<ReportingGrid rows={[
            { Month: "April", Category: "Grocery", Sales: 15000 },
            { Month: "April", Category: "Electronics", Sales: 25000 },
        ]} columns={columns} grouping={{ ...grouping, showGroupTotalsInHeader: true }} gridConfig={gridConfig} />);
        expect(screen.getAllByText("40,000.00")).toHaveLength(3);
        fireEvent.click(screen.getByRole("button", { name: "Collapse April group" }));
        expect(screen.getAllByText("40,000.00")).toHaveLength(2);
        expect(screen.queryByLabelText("April subtotal")).toBeNull();
    });

    it("aligns multiple aggregate values in nested group headers without changing totals", () => {
        const nestedColumns = [...columns, { field: "Quantity", header: "Quantity", visible: true, dataType: "number" as const, align: "right" as const }];
        render(<ReportingGrid rows={[
            { Month: "April", Category: "Grocery", Sales: 10, Quantity: 2 },
            { Month: "April", Category: "Grocery", Sales: 20, Quantity: 3 },
        ]} columns={nestedColumns} grouping={{
            ...grouping,
            groups: [{ field: "Month" }, { field: "Category" }],
            aggregates: [{ field: "Sales", function: "SUM" }, { field: "Quantity", function: "COUNT" }],
            showGroupTotalsInHeader: true,
        }} gridConfig={gridConfig} />);
        expect(screen.getByRole("button", { name: "Collapse April group" })).not.toBeNull();
        expect(screen.getByRole("button", { name: "Collapse Grocery group" })).not.toBeNull();
        expect(screen.getAllByText("30.00").length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2);
        expect(screen.getByLabelText("Grand Total")).not.toBeNull();
    });

    it("uses a stable supplied dashboard viewport for the table region, not pagination", () => {
        const { container } = render(<ReportingGrid rows={[]} columns={columns} grouping={grouping} gridConfig={gridConfig} height={466} stableViewport />);
        expect((container.querySelector(".reporting-grid__scroll") as HTMLElement).style.height).toBe("466px");
        expect((container.firstElementChild as HTMLElement).style.height).toBe("");
    });

    it("keeps dashboard height stable while eight groups expand and collapse", () => {
        const rows = Array.from({ length: 8 }, (_, index) => ({
            Month: `Month ${index + 1}`,
            Category: "Category",
            Sales: index + 1,
        }));
        const { container } = render(<ReportingGrid
            rows={rows}
            columns={columns}
            grouping={{ ...grouping, expandedByDefault: false, showGroupTotalsInHeader: true }}
            gridConfig={{ ...gridConfig, pagination: { ...gridConfig.pagination, pageSize: 50, pageSizeOptions: [10, 25, 50] } }}
            height={466}
            stableViewport
        />);
        expect(screen.getAllByRole("button", { name: /Expand Month .* group/ })).toHaveLength(8);
        expect(screen.getByLabelText("Grand Total")).not.toBeNull();
        expect((screen.getByLabelText("Rows per page") as HTMLSelectElement).value).toBe("50");
        const scroll = container.querySelector(".reporting-grid__scroll") as HTMLElement;
        expect(scroll.style.height).toBe("466px");
        expect(scroll.querySelectorAll("tbody tr")).toHaveLength(8);
        fireEvent.click(screen.getByRole("button", { name: "Expand Month 1 group" }));
        expect(scroll.style.height).toBe("466px");
        fireEvent.click(screen.getByRole("button", { name: "Expand Month 2 group" }));
        expect(scroll.style.height).toBe("466px");
        fireEvent.change(screen.getByLabelText("Rows per page"), { target: { value: "25" } });
        expect(scroll.style.height).toBe("466px");
        expect((screen.getByLabelText("Rows per page") as HTMLSelectElement).value).toBe("25");
        fireEvent.click(screen.getByRole("button", { name: "Collapse Month 1 group" }));
        expect(scroll.style.height).toBe("466px");
    });

    it("applies updated authored page size and expansion defaults after configuration refresh", () => {
        const { rerender } = render(<GenericGrid
            rows={[{ Month: "April", Category: "Grocery", Sales: 1 }]}
            columns={columns}
            gridConfig={{ ...gridConfig, grouping: { ...grouping, expandedByDefault: false } }}
        />);
        expect(screen.getByRole("button", { name: "Expand April group" })).not.toBeNull();
        expect((screen.getByLabelText("Rows per page") as HTMLSelectElement).value).toBe("10");

        rerender(<GenericGrid
            rows={[{ Month: "April", Category: "Grocery", Sales: 1 }]}
            columns={columns}
            gridConfig={{
                ...gridConfig,
                pagination: { ...gridConfig.pagination, pageSize: 50, pageSizeOptions: [10, 25, 50] },
                grouping: { ...grouping, expandedByDefault: true },
            }}
        />);

        expect(screen.getByRole("button", { name: "Collapse April group" })).not.toBeNull();
        expect((screen.getByLabelText("Rows per page") as HTMLSelectElement).value).toBe("50");
    });

    it("keeps standalone reporting grids at natural height", () => {
        const { container } = render(<ReportingGrid rows={[{ Month: "April", Category: "Grocery", Sales: 1 }]} columns={columns} grouping={grouping} gridConfig={gridConfig} />);
        const scroll = container.querySelector(".reporting-grid__scroll") as HTMLElement;
        expect(scroll.style.height).toBe("");
        expect(scroll.style.maxHeight).toBe("");
    });

    it("keeps an explicitly bounded standalone reporting grid natural until its maximum", () => {
        const { container } = render(<ReportingGrid rows={[{ Month: "April", Category: "Grocery", Sales: 1 }]} columns={columns} grouping={grouping} gridConfig={gridConfig} height={466} />);
        const scroll = container.querySelector(".reporting-grid__scroll") as HTMLElement;
        expect(scroll.style.height).toBe("");
        expect(scroll.style.maxHeight).toBe("466px");
    });

    it("uses content-aware columns without the former forced desktop table width", () => {
        const longCategory = "A descriptive category name that should remain available to assistive and pointer users";
        const longSales = 1234567890123.45;
        const { container } = render(<ReportingGrid rows={[{ Month: "April", Category: longCategory, Sales: longSales }]} columns={columns} grouping={{ ...grouping, showGroupTotalsInHeader: true }} gridConfig={gridConfig} />);
        const table = container.querySelector("table") as HTMLTableElement;
        const cols = [...container.querySelectorAll("col")];
        expect(cols).toHaveLength(3);
        expect(table.style.getPropertyValue("--reporting-grid-min-width")).not.toBe("620px");
        expect((cols[2] as HTMLElement).style.width).not.toBe("");
        expect(screen.getByTitle(longCategory)).not.toBeNull();
        expect(screen.getByTitle("12,34,56,78,90,123.45")).not.toBeNull();
        expect(screen.getAllByText("12,34,56,78,90,123.45").length).toBeGreaterThanOrEqual(2);
    });

    it("renders formatted details, subtotals, and a grand total with accessible expansion", () => {
        render(<ReportingGrid rows={[
            { Month: "April", Category: "Grocery", Sales: 15000 },
            { Month: "April", Category: "Electronics", Sales: 25000 },
        ]} columns={columns} grouping={grouping} gridConfig={gridConfig} />);
        const toggle = screen.getByRole("button", { name: "Collapse April group" });
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        expect(screen.getAllByText("40,000.00")).toHaveLength(2);
        expect(screen.getByLabelText("April subtotal")).not.toBeNull();
        expect(screen.getByLabelText("Grand Total")).not.toBeNull();
        fireEvent.click(toggle);
        expect(screen.queryByText("Grocery")).toBeNull();
        expect(screen.getByRole("button", { name: "Expand April group" }).getAttribute("aria-expanded")).toBe("false");
    });

    it("paginates visible reporting rows and keeps the grand total outside ordinary pages", () => {
        render(<ReportingGrid rows={Array.from({ length: 20 }, (_, index) => ({ Month: "April", Category: `Item ${index}`, Sales: 1 }))} columns={columns} grouping={grouping} gridConfig={gridConfig} />);
        expect(screen.getByText("Showing 1–10 of 22")).not.toBeNull();
        expect(screen.getByRole("button", { name: "Page 3" })).not.toBeNull();
        expect(screen.getByLabelText("Grand Total")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Next page" }));
        expect(screen.getByText("April (continued)")).not.toBeNull();
        expect(screen.queryByRole("button", { name: "Collapse April group" })).toBeNull();
        expect(screen.getByLabelText("Grand Total")).not.toBeNull();
    });

    it("removes hidden details from pagination when a group is collapsed", () => {
        render(<ReportingGrid rows={Array.from({ length: 20 }, (_, index) => ({ Month: "April", Category: `Item ${index}`, Sales: 1 }))} columns={columns} grouping={grouping} gridConfig={gridConfig} />);
        fireEvent.click(screen.getByRole("button", { name: "Collapse April group" }));
        expect(screen.getByText("Showing 1–1 of 1")).not.toBeNull();
        expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();
        expect(screen.getByLabelText("Grid pagination")).not.toBeNull();
        expect(screen.getByLabelText("Grand Total")).not.toBeNull();
    });

    it("renders subtotals before details when configured at the top", () => {
        const { container } = render(<ReportingGrid rows={[{ Month: "April", Category: "Grocery", Sales: 10 }]} columns={columns} grouping={{ ...grouping, subtotalPosition: "top" }} gridConfig={gridConfig} />);
        const bodyRows = [...container.querySelectorAll("tbody tr")];
        expect(bodyRows[1].classList.contains("reporting-grid__subtotal")).toBe(true);
        expect(bodyRows[2].classList.contains("reporting-grid__detail")).toBe(true);
    });

    it("keeps numeric group sorting inside the reporting structure", () => {
        render(<ReportingGrid
            rows={[{ Month: 10, Category: "Ten", Sales: 1 }, { Month: 2, Category: "Two", Sales: 1 }]}
            columns={[{ ...columns[0], dataType: "number" }, columns[1], columns[2]]}
            grouping={grouping}
            gridConfig={gridConfig}
        />);
        const labels = screen.getAllByRole("button", { name: /Collapse .* group/ }).map(button => button.getAttribute("aria-label"));
        expect(labels).toEqual(["Collapse 2 group", "Collapse 10 group"]);
        fireEvent.click(screen.getByRole("button", { name: "Month" }));
        fireEvent.click(screen.getByRole("button", { name: /Month.*sorted ascending/ }));
        const descendingLabels = screen.getAllByRole("button", { name: /Collapse .* group/ }).map(button => button.getAttribute("aria-label"));
        expect(descendingLabels).toEqual(["Collapse 10 group", "Collapse 2 group"]);
    });
});
