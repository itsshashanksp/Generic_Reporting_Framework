import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ColumnDefinition } from "../../../types/column";
import {
    arrangeColumns,
    emptyColumnLayout,
    isEmptyColumnLayout,
    loadColumnLayout,
    saveColumnLayout,
} from "../layout";

const columns: ColumnDefinition[] = [
    { field: "A", header: "Alpha", width: 150, visible: true },
    { field: "B", header: "Beta", width: 200, visible: true },
    { field: "Secret", header: "Secret", width: 150, visible: false },
    { field: "C", header: "Gamma", width: 120, visible: true },
];
const fields = (arranged: { field: string }[]) => arranged.map(column => column.field);

describe("arrangeColumns", () => {
    it("keeps the configured order and widths without a layout, and never offers configuration-hidden columns", () => {
        const arranged = arrangeColumns(columns, emptyColumnLayout);
        expect(fields(arranged)).toEqual(["A", "B", "C"]);
        expect(arranged.map(column => column.width)).toEqual([150, 200, 120]);
        expect(arranged.every(column => !column.hiddenByUser)).toBe(true);
    });

    it("applies order, hidden fields and widths", () => {
        const arranged = arrangeColumns(columns, { order: ["C", "A", "B"], hidden: ["A"], widths: { B: 320 } });
        expect(fields(arranged)).toEqual(["C", "A", "B"]);
        expect(arranged.find(column => column.field === "A")?.hiddenByUser).toBe(true);
        expect(arranged.find(column => column.field === "B")?.width).toBe(320);
    });

    it("ignores fields the configuration no longer shows and appends new configured fields", () => {
        const arranged = arrangeColumns(columns, { order: ["Removed", "C", "Secret"], hidden: ["Removed", "Secret"], widths: {} });
        expect(fields(arranged)).toEqual(["C", "A", "B"]);
        expect(arranged.some(column => column.hiddenByUser)).toBe(false);
    });

    it("keeps one column visible when a stored layout hides them all", () => {
        const arranged = arrangeColumns(columns, { order: ["B", "A", "C"], hidden: ["A", "B", "C"], widths: {} });
        expect(arranged.filter(column => !column.hiddenByUser).map(column => column.field)).toEqual(["B"]);
    });
});

describe("column layout storage", () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it("stores layouts per user and per report", () => {
        saveColumnLayout("alice", "item", { order: ["B"], hidden: ["A"], widths: { B: 250 } });

        expect(loadColumnLayout("alice", "item")).toEqual({ order: ["B"], hidden: ["A"], widths: { B: 250 } });
        expect(loadColumnLayout("bob", "item")).toEqual(emptyColumnLayout);
        expect(loadColumnLayout("alice", "customer")).toEqual(emptyColumnLayout);
        expect(localStorage.getItem("generic-report-column-layout:user:alice:report:item")).not.toBeNull();
    });

    it("removes the stored entry when the layout is reset", () => {
        saveColumnLayout("alice", "item", { order: ["B"], hidden: [], widths: {} });
        saveColumnLayout("alice", "item", emptyColumnLayout);
        expect(localStorage.getItem("generic-report-column-layout:user:alice:report:item")).toBeNull();
        expect(isEmptyColumnLayout(loadColumnLayout("alice", "item"))).toBe(true);
    });

    it("falls back to the configured layout for corrupt or malformed entries", () => {
        localStorage.setItem("generic-report-column-layout:user:alice:report:item", "{not json");
        expect(loadColumnLayout("alice", "item")).toEqual(emptyColumnLayout);

        localStorage.setItem("generic-report-column-layout:user:alice:report:item", JSON.stringify({
            order: ["A", 3, "A"], hidden: "A", widths: { A: -5, B: 1.5, C: 90, D: "100" },
        }));
        expect(loadColumnLayout("alice", "item")).toEqual({ order: ["A"], hidden: [], widths: { C: 90 } });
    });

    it("keeps working when browser storage is unavailable", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });

        expect(loadColumnLayout("alice", "item")).toEqual(emptyColumnLayout);
        expect(() => saveColumnLayout("alice", "item", { order: ["B"], hidden: [], widths: {} })).not.toThrow();
    });
});
