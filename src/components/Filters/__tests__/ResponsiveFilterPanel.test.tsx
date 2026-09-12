import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterProvider } from "../../../engine/FilterContext";
import ResponsiveFilterPanel from "../ResponsiveFilterPanel";

describe("ResponsiveFilterPanel", () => {
    it("opens the existing search filters and closes after applying", () => {
        const onApply = vi.fn(() => true);
        const { container } = render(
            <FilterProvider>
                <ResponsiveFilterPanel
                    filters={[{ field: "name", label: "Name", type: "text" }]}
                    className="report-section"
                    onApply={onApply}
                    onClear={vi.fn()}
                />
            </FilterProvider>
        );

        const panel = container.querySelector(".responsive-filter-panel");
        expect(panel?.getAttribute("data-open")).toBe("false");

        fireEvent.click(screen.getByRole("button", { name: "Open search and filters" }));
        expect(panel?.getAttribute("data-open")).toBe("true");
        fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alpha" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));

        expect(onApply).toHaveBeenCalledTimes(1);
        expect(panel?.getAttribute("data-open")).toBe("false");
    });

    it("stays open when filter validation fails", () => {
        const { container } = render(
            <FilterProvider>
                <ResponsiveFilterPanel
                    filters={[{ field: "name", label: "Name", type: "text" }]}
                    className="report-section"
                    onApply={() => false}
                    onClear={vi.fn()}
                />
            </FilterProvider>
        );

        fireEvent.click(screen.getByRole("button", { name: "Open search and filters" }));
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        expect(container.querySelector(".responsive-filter-panel")?.getAttribute("data-open")).toBe("true");
    });
});
