import { describe, expect, it } from "vitest";

import { clampChartTooltipPosition, placeChartTooltip, placeRadialChartTooltip } from "../chartTooltipPosition";

describe("chart tooltip boundary placement", () => {
    const bounds = { x: 100, y: 50, width: 400, height: 240 };
    const tooltip = { width: 160, height: 80 };

    it("uses the lower-right placement when it fits", () => {
        expect(clampChartTooltipPosition({ x: 180, y: 100 }, tooltip, bounds)).toEqual({ x: 192, y: 112 });
    });

    it("flips at the right and bottom edges", () => {
        expect(clampChartTooltipPosition({ x: 480, y: 270 }, tooltip, bounds)).toEqual({ x: 308, y: 178 });
    });

    it("clamps an oversized tooltip within the visible viewport", () => {
        const result = clampChartTooltipPosition({ x: 100, y: 50 }, { width: 600, height: 400 }, bounds);
        expect(result).toEqual({ x: 108, y: 58 });
    });

    it("places a pie tooltip beyond the hovered side of the radial plot", () => {
        expect(placeRadialChartTooltip(
            { x: 345, y: 150 },
            { width: 120, height: 60 },
            { x: 0, y: 0, width: 600, height: 360 },
            { x: 200, y: 80, width: 160, height: 160 },
        )).toEqual({ x: 372, y: 120 });
    });

    it("flips a radial tooltip vertically when the hovered edge has no room", () => {
        expect(placeRadialChartTooltip(
            { x: 340, y: 150 },
            { width: 100, height: 60 },
            { x: 0, y: 0, width: 400, height: 360 },
            { x: 40, y: 80, width: 320, height: 160 },
        )).toEqual({ x: 290, y: 8 });
    });

    it("uses viewport offsets after page scrolling and keeps long tooltips visible", () => {
        const result = placeRadialChartTooltip(
            { x: 560, y: 820 },
            { width: 280, height: 96 },
            { x: 240, y: 700, width: 520, height: 300 },
            { x: 430, y: 760, width: 180, height: 180 },
        );
        expect(result.x).toBeGreaterThanOrEqual(248);
        expect(result.y).toBeGreaterThanOrEqual(708);
        expect(result.x + 280).toBeLessThanOrEqual(752);
        expect(result.y + 96).toBeLessThanOrEqual(992);
    });

    it("re-evaluates placement against a resized narrow viewport", () => {
        const anchor = { x: 260, y: 150 };
        const tooltip = { width: 180, height: 84 };
        const radialBounds = { x: 140, y: 70, width: 160, height: 160 };
        const wide = placeRadialChartTooltip(anchor, tooltip, { x: 0, y: 0, width: 640, height: 320 }, radialBounds);
        const narrow = placeRadialChartTooltip(anchor, tooltip, { x: 80, y: 0, width: 300, height: 320 }, radialBounds);

        expect(wide).toEqual({ x: 312, y: 108 });
        expect(narrow.x).toBeGreaterThanOrEqual(88);
        expect(narrow.x + tooltip.width).toBeLessThanOrEqual(372);
        expect(narrow.y).toBeGreaterThanOrEqual(8);
        expect(narrow.y + tooltip.height).toBeLessThanOrEqual(312);
    });

    it("selects a pointer-relative alternative instead of covering the legend", () => {
        expect(placeChartTooltip(
            { x: 180, y: 100 },
            { width: 160, height: 80 },
            { x: 0, y: 0, width: 500, height: 300 },
            [{ x: 190, y: 110, width: 200, height: 100 }],
        )).toEqual({ x: 192, y: 8 });
    });
});
