import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../../styles/components/dashboard-widgets.css";
import ChartTooltip from "../ChartTooltip";

function rectangle(left: number, top: number, width: number, height: number): DOMRect {
    return {
        left, top, width, height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
    };
}

describe("ChartTooltip floating content", () => {
    let viewport: HTMLDivElement;
    let canvas: HTMLDivElement;

    beforeEach(() => {
        viewport = document.createElement("div");
        canvas = document.createElement("div");
        const legend = document.createElement("div");
        legend.className = "recharts-legend-wrapper";
        canvas.append(legend);
        viewport.append(canvas);
        document.body.append(viewport);

        viewport.getBoundingClientRect = () => rectangle(100, 100, 500, 300);
        canvas.getBoundingClientRect = () => rectangle(100, 100, 500, 300);
        legend.getBoundingClientRect = () => rectangle(300, 210, 200, 80);
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains("dashboard-chart-tooltip")) return rectangle(0, 0, 180, 112);
            return rectangle(0, 0, 0, 0);
        });
    });

    afterEach(() => viewport.remove());

    it("shows complete wrapped content at natural height without scrollbars and avoids the legend", () => {
        render(<ChartTooltip
            active
            coordinate={{ x: 200, y: 100 }}
            label="DEODORANT & FRAGRANCE WITH A LONG CATEGORY NAME"
            payload={[{ name: "Stock Value", value: 2641180, color: "#3274d9" }]}
            viewport={viewport}
            canvas={canvas}
            formatValue={() => "₹26,41,180.00"}
            formatPercentage={() => "6.29%"}
        />);

        const tooltip = screen.getByRole("status");
        expect(tooltip.textContent).toContain("DEODORANT & FRAGRANCE WITH A LONG CATEGORY NAME");
        expect(screen.getByText("₹26,41,180.00")).toBeTruthy();
        expect(screen.getByText("6.29%")).toBeTruthy();
        expect(tooltip.style.maxHeight).toBe("");
        expect(["auto", "scroll"]).not.toContain(getComputedStyle(tooltip).overflowY);
        expect(Number.parseFloat(tooltip.style.top) + 112).toBeLessThanOrEqual(210);
    });

    it("supports chart taps, outside-tap dismissal, and inactive mouse-leave state", () => {
        const properties = {
            active: true,
            coordinate: { x: 200, y: 100 },
            label: "Category",
            payload: [{ name: "Value", value: 10 }],
            viewport,
            canvas,
            formatValue: () => "10",
        };
        const view = render(<ChartTooltip {...properties} />);

        fireEvent.pointerDown(canvas);
        expect(screen.getByRole("status")).toBeTruthy();
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole("status")).toBeNull();

        fireEvent.pointerEnter(canvas);
        view.rerender(<ChartTooltip {...properties} coordinate={{ x: 220, y: 100 }} />);
        expect(screen.getByRole("status")).toBeTruthy();
        view.rerender(<ChartTooltip {...properties} active={false} />);
        expect(screen.queryByRole("status")).toBeNull();
    });
});
