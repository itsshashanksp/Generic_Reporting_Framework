import { describe, expect, it } from "vitest";

import { validateDashboard } from "../../DashboardValidator";
import { inheritDashboardDatabase, loadDashboardConfiguration } from "..";

const inheriting = {
    id: "total", type: "stat", title: "Total",
    queryDefinition: { format: "sql", resource: "widgets/total-sales" },
};
const pinned = {
    id: "pinned", type: "stat", title: "Pinned",
    queryDefinition: { format: "sql", database: "loyal-ibms", resource: "widgets/total-sales" },
};
const dashboard = (databaseSelection: unknown, widgets: unknown[] = [inheriting]) => ({
    id: "db-dashboard", title: "Database dashboard", databaseSelection, widgets,
});

describe("dashboard databaseSelection validation", () => {
    it("accepts at least two databases, with the same shape as reports", () => {
        expect(validateDashboard(dashboard({ databases: ["abc", "abc2"] })).errors).toEqual([]);
        expect(loadDashboardConfiguration(dashboard({ databases: ["abc", "abc2"] })).status).toBe("valid");
    });

    it.each([
        [["abc", "abc2"], "Dashboard databaseSelection must be an object."],
        [{ databases: ["abc"] }, "Dashboard databaseSelection databases must list at least two logical database ids."],
        [{ databases: ["abc", "abc"] }, "Dashboard databaseSelection databases must be unique."],
        [{ databases: ["abc", "ABC 2"] }, 'Dashboard databaseSelection database at index 1 must be a logical database id (lowercase letters, digits, "_" or "-", starting with a letter).'],
        // The backend registry decides the initial database; there is no `default`.
        [{ default: "abc", databases: ["abc", "abc2"] }, 'Dashboard databaseSelection contains unknown property "default".'],
        [{ databases: ["abc", "abc2"], labels: {} }, 'Dashboard databaseSelection contains unknown property "labels".'],
    ])("rejects %j", (databaseSelection, message) => {
        expect(validateDashboard(dashboard(databaseSelection)).errors).toEqual([message]);
    });

    it("rejects a selector that no widget would follow", () => {
        const result = loadDashboardConfiguration(dashboard({ databases: ["abc", "abc2"] }, [pinned]));
        expect(result.status).toBe("invalid");
        expect(result.validation.errors).toEqual([
            "Dashboard databaseSelection needs at least one visible widget whose request names no database; widgets with their own database never follow the selection.",
        ]);
    });

    it("counts a report-backed widget that names no database as inheriting only when the report has none", () => {
        // The checked-in Item report names loyal-ibms, so it does not inherit.
        const reportWidget = { id: "report", type: "report", title: "Items", reportId: "item" };
        expect(loadDashboardConfiguration(dashboard({ databases: ["abc", "abc2"] }, [reportWidget])).status).toBe("invalid");
    });

    it("rejects databaseSelection on a widget", () => {
        const errors = validateDashboard(dashboard(undefined, [{ ...inheriting, databaseSelection: { databases: ["abc", "abc2"] } }])).errors;
        expect(errors.some(error => error.includes('unknown property "databaseSelection"'))).toBe(true);
    });
});

describe("inheritDashboardDatabase", () => {
    it("fills only a missing database", () => {
        expect(inheritDashboardDatabase({ action: "sql" }, "abc2")).toEqual({ action: "sql", database: "abc2" });
        expect(inheritDashboardDatabase({ action: "sql", database: "loyal-ibms" }, "abc2")).toEqual({ action: "sql", database: "loyal-ibms" });
        const request = { action: "sql" };
        expect(inheritDashboardDatabase(request, "")).toBe(request);
    });
});
