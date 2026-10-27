import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Skeleton from "../Skeleton";

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

    it.each(["bar", "line", "pie"] as const)("renders a lightweight %s chart placeholder", chartType => {
        const { container } = render(<Skeleton kind="chart" chartType={chartType} label={`Loading ${chartType} chart…`} />);
        expect(container.querySelector(`.skeleton__chart--${chartType}`)).toBeTruthy();
        expect(container.querySelector("svg")).toBeNull();
    });
});
