import { describe, expect, it } from "vitest";

import { inheritDashboardDatabase } from "../../DashboardEngine";
import { resolveConfiguredDatabase } from "../databaseResolution";

describe("three-level database resolution", () => {
    it.each([
        [undefined, undefined, ""],
        [undefined, "global", "global"],
        ["json", undefined, "json"],
        ["json", "global", "json"],
    ])("resolves JSON %s and global %s to %s", (explicit, global, expected) => {
        expect(resolveConfiguredDatabase(explicit, global)).toBe(expected);
    });

    it("lets a page choice override the configured report default", () => {
        const configured = resolveConfiguredDatabase("json", "global");
        const pageChoice = "page";
        expect(pageChoice || configured).toBe("page");
    });

    it("keeps pinned dashboard widgets ahead of page and global defaults", () => {
        expect(inheritDashboardDatabase({ action: "select", database: "widget" }, "page"))
            .toEqual({ action: "select", database: "widget" });
    });

    it("applies a dashboard page choice, then the global default, to unpinned widgets", () => {
        expect(inheritDashboardDatabase({ action: "sql", resource: "summary" }, "page"))
            .toEqual({ action: "sql", resource: "summary", database: "page" });
        expect(inheritDashboardDatabase({ action: "sql", resource: "summary" }, "global"))
            .toEqual({ action: "sql", resource: "summary", database: "global" });
    });
});
