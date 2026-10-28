import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Skeleton from "../Skeleton";
import { resolveTableLayout } from "../../Grid/tableLayout";

describe("Skeleton", () => {
    it("renders an accessible status with decorative shapes hidden", () => {
        const { container } = render(<Skeleton kind="stat" label="Loading statistic…" />);
        expect(screen.getByRole("status", { name: "Loading statistic…" })).toBeTruthy();
        expect(container.querySelector(".skeleton__content")?.getAttribute("aria-hidden")).toBe("true");
    });

    it("renders visual table placeholders without creating data-grid records", () => {
        const { container } = render(<Skeleton kind="table" label="Loading rows…" columns={3} rows={4} />);
        expect(container.querySelectorAll(".skeleton__table-row")).toHaveLength(5);
        expect(container.querySelectorAll("[role='row']")).toHaveLength(0);
        expect(container.querySelector(".ag-row")).toBeNull();
    });

    it.each([10, 25, 50, 100])("uses the effective page size for %i logical rows", rows => {
        const { container } = render(<Skeleton kind="table" rows={rows} showPagination />);
        expect(container.querySelectorAll(".skeleton__table-row:not(.skeleton__table-row--header)")).toHaveLength(rows);
        expect(container.querySelector(".skeleton__pagination")).toBeTruthy();
    });

    it("caps large pages to viewport capacity and preserves configured column proportions", () => {
        const { container } = render(
            <Skeleton
                kind="table"
                rows={50}
                tableLayout={resolveTableLayout(50, { fixedViewport: true })}
                tableColumns={[{ width: 100 }, { width: 300 }, { width: 200, visible: false }]}
            />
        );
        expect(container.querySelectorAll(".skeleton__table-row:not(.skeleton__table-row--header)")).toHaveLength(10);
        expect((container.querySelector(".skeleton__table") as HTMLElement).style.getPropertyValue("--skeleton-columns")).toBe("100fr 300fr");
        expect(container.querySelector(".skeleton__table")?.classList.contains("skeleton__table")).toBe(true);
    });

    it("uses the same header, row, pagination, and total heights as the resolved layout", () => {
        const layout = resolveTableLayout(25);
        const { container } = render(<Skeleton kind="table" rows={25} tableLayout={layout} showPagination />);
        const table = container.querySelector(".skeleton__table") as HTMLElement;
        expect(table.style.getPropertyValue("--skeleton-header-height")).toBe("44px");
        expect(table.style.getPropertyValue("--skeleton-row-height")).toBe("42px");
        expect(table.style.getPropertyValue("--skeleton-pagination-height")).toBe("58px");
        expect(layout.totalHeight).toBe(1154);
    });

    it.each(["bar", "line", "pie"] as const)("renders a lightweight %s chart placeholder", chartType => {
        const { container } = render(<Skeleton kind="chart" chartType={chartType} label={`Loading ${chartType} chart…`} />);
        expect(container.querySelector(`.skeleton__chart--${chartType}`)).toBeTruthy();
        expect(container.querySelector("svg")).toBeNull();
    });
});
