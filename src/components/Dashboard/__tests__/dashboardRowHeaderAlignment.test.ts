import { describe, expect, it } from "vitest";
import {
    resolveDashboardRowFooterHeights,
    resolveDashboardRowHeaderHeights,
    resolveDashboardRowRegionHeights,
    resolveDashboardRowTableHeights,
} from "../useDashboardRowHeaderAlignment";

function measurement(rowTop: number, naturalHeight: number, marginBottom = 0) {
    return {
        element: document.createElement("header"),
        rowTop,
        naturalHeight,
        marginBottom,
    };
}

describe("dashboard row header alignment", () => {
    it("uses the tallest footprint for two descriptions in the same row", () => {
        const short = measurement(100, 58);
        const long = measurement(100, 82);
        const heights = resolveDashboardRowHeaderHeights([short, long]);

        expect(heights.get(short.element)).toBe(82);
        expect(heights.get(long.element)).toBe(82);
    });

    it("aligns three widgets while accounting for each frame's header margin", () => {
        const table = measurement(100, 70, 0);
        const chart = measurement(100, 52, 10);
        const noDescription = measurement(100, 38, 10);
        const heights = resolveDashboardRowHeaderHeights([table, chart, noDescription]);

        expect(heights.get(table.element)).toBe(70);
        expect(heights.get(chart.element)).toBe(60);
        expect(heights.get(noDescription.element)).toBe(60);
    });

    it("keeps stacked responsive rows independently sized", () => {
        const first = measurement(100, 82);
        const second = measurement(500, 58);
        const heights = resolveDashboardRowHeaderHeights([first, second]);

        expect(heights.get(first.element)).toBe(82);
        expect(heights.get(second.element)).toBe(58);
    });

    it("rounds subpixel row positions into the same visual row", () => {
        const first = measurement(100.1, 58);
        const second = measurement(100.6, 74);
        const heights = resolveDashboardRowHeaderHeights([first, second]);

        expect(heights.get(first.element)).toBe(74);
        expect(heights.get(second.element)).toBe(74);
    });
});

describe("dashboard row footer alignment", () => {
    it("aligns one-row and responsive two-row pagination footprints", () => {
        const wideFooter = { element: document.createElement("div"), rowTop: 100, naturalHeight: 49 };
        const narrowFooter = { element: document.createElement("div"), rowTop: 100, naturalHeight: 93 };
        const heights = resolveDashboardRowFooterHeights([wideFooter, narrowFooter]);

        expect(heights.get(wideFooter.element)).toBe(93);
        expect(heights.get(narrowFooter.element)).toBe(93);
    });

    it("keeps pagination in unrelated responsive rows independent", () => {
        const first = { element: document.createElement("div"), rowTop: 100, naturalHeight: 93 };
        const second = { element: document.createElement("div"), rowTop: 700, naturalHeight: 49 };
        const heights = resolveDashboardRowFooterHeights([first, second]);

        expect(heights.get(first.element)).toBe(93);
        expect(heights.get(second.element)).toBe(49);
    });
});

describe("dashboard row table alignment", () => {
    it("reserves the native horizontal scrollbar footprint for its adjacent table", () => {
        const withoutScrollbar = { element: document.createElement("div"), rowTop: 100, naturalHeight: 466, alignmentKey: "natural:10" };
        const withScrollbar = { element: document.createElement("div"), rowTop: 100, naturalHeight: 481, alignmentKey: "natural:10" };
        const heights = resolveDashboardRowTableHeights([withoutScrollbar, withScrollbar]);

        expect(heights.get(withoutScrollbar.element)).toBe(481);
        expect(heights.get(withScrollbar.element)).toBe(481);
    });

    it("aligns different page-size footprints only within their rendered row", () => {
        const shortPage = { element: document.createElement("div"), rowTop: 100, naturalHeight: 256, alignmentKey: "bounded" };
        const longPage = { element: document.createElement("div"), rowTop: 100, naturalHeight: 466, alignmentKey: "bounded" };
        const stackedTable = { element: document.createElement("div"), rowTop: 700, naturalHeight: 298, alignmentKey: "bounded" };
        const heights = resolveDashboardRowTableHeights([shortPage, longPage, stackedTable]);

        expect(heights.get(shortPage.element)).toBe(466);
        expect(heights.get(longPage.element)).toBe(466);
        expect(heights.get(stackedTable.element)).toBe(298);
    });

    it("coordinates standard and Reporting Grid viewports in the same row", () => {
        const standard = { element: document.createElement("div"), rowTop: 100.2, naturalHeight: 450, alignmentKey: "bounded" };
        const reporting = { element: document.createElement("div"), rowTop: 100.8, naturalHeight: 466, alignmentKey: "bounded" };
        const heights = resolveDashboardRowTableHeights([standard, reporting]);

        expect(heights.get(standard.element)).toBe(466);
        expect(heights.get(reporting.element)).toBe(466);
    });

    it.each([
        ["seven-row", 355],
        ["one-row", 88],
        ["empty", 46],
    ])("stretches a %s viewport to match a ten-row viewport in the same dashboard row", (_label, naturalHeight) => {
        const shorterGrid = { element: document.createElement("div"), rowTop: 100, naturalHeight, alignmentKey: "natural" };
        const tenRows = { element: document.createElement("div"), rowTop: 100, naturalHeight: 466, alignmentKey: "natural:10" };
        const heights = resolveDashboardRowTableHeights([shorterGrid, tenRows]);

        expect(heights.get(shorterGrid.element)).toBe(466);
        expect(heights.get(tenRows.element)).toBe(466);
    });

    it.each([0, 1, 5, 7, 10, 50])("keeps a %i-row natural viewport content-sized", rowCount => {
        const table = {
            element: document.createElement("div"),
            rowTop: 100,
            naturalHeight: 46 + rowCount * 42,
            alignmentKey: `natural:${rowCount}`,
        };

        expect(resolveDashboardRowTableHeights([table]).get(table.element)).toBe(table.naturalHeight);
    });
});

describe("dashboard row table-region alignment", () => {
    it("aligns card regions for different row-count viewports", () => {
        const sevenRows = { element: document.createElement("div"), rowTop: 100, naturalHeight: 420, alignmentKey: "natural:7" };
        const tenRows = { element: document.createElement("div"), rowTop: 100, naturalHeight: 546, alignmentKey: "natural:10" };
        const heights = resolveDashboardRowRegionHeights([sevenRows, tenRows]);

        expect(heights.get(sevenRows.element)).toBe(546);
        expect(heights.get(tenRows.element)).toBe(546);
    });
});
