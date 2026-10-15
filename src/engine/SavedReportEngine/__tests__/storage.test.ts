import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteSavedReport, loadSavedReports, removeUnscopedSavedReports, saveSavedReport } from "..";
import type { SavedReport } from "../../../types/savedReport";

function savedReport(id: string, filters: Record<string, string> = {}): SavedReport {
    return {
        id,
        reportId: "customer",
        name: "Customer Report",
        createdAt: "2026-10-10T00:00:00.000Z",
        updatedAt: "2026-10-10T00:00:00.000Z",
        state: { filters, sorting: [], pagination: { page: 1, pageSize: 10 } },
    };
}

describe("saved report user isolation", () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => vi.restoreAllMocks());

    it("never shows one user's saved views to another user of the same browser", () => {
        saveSavedReport("alice", savedReport("a1", { Cust_Name: "Confidential Customer" }));
        saveSavedReport("bob", savedReport("b1"));

        expect(loadSavedReports("alice").map(report => report.id)).toEqual(["a1"]);
        expect(loadSavedReports("bob").map(report => report.id)).toEqual(["b1"]);
        expect(JSON.stringify(loadSavedReports("bob"))).not.toContain("Confidential Customer");
        expect(loadSavedReports("carol")).toEqual([]);
    });

    it("keeps a user's saved views across sessions and only deletes that user's view", () => {
        saveSavedReport("alice", savedReport("shared-id"));
        saveSavedReport("bob", savedReport("shared-id"));

        deleteSavedReport("alice", "shared-id");

        expect(loadSavedReports("alice")).toEqual([]);
        expect(loadSavedReports("bob").map(report => report.id)).toEqual(["shared-id"]);
    });

    it("does not let a crafted username read another user's key", () => {
        saveSavedReport("alice", savedReport("a1"));
        expect(loadSavedReports("alice:user:x")).toEqual([]);
        expect(loadSavedReports("").length).toBe(0);
        expect(Object.keys(localStorage)).toEqual(["generic-report-saved-reports:user:alice"]);
    });

    it("removes views saved before per-user scoping, which cannot be attributed to a user", () => {
        localStorage.setItem("generic-report-saved-reports", JSON.stringify([savedReport("legacy")]));
        saveSavedReport("alice", savedReport("a1"));

        removeUnscopedSavedReports();

        expect(localStorage.getItem("generic-report-saved-reports")).toBeNull();
        expect(loadSavedReports("alice").map(report => report.id)).toEqual(["a1"]);
    });

    it("tolerates unavailable or corrupt storage", () => {
        localStorage.setItem("generic-report-saved-reports:user:alice", "{not json");
        expect(loadSavedReports("alice")).toEqual([]);

        vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
            throw new Error("storage blocked");
        });
        expect(() => removeUnscopedSavedReports()).not.toThrow();
    });
});
